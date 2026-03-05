/**
 * 03 — Adaptive Evals: LLM-as-Judge
 *
 * TRACE Layer: A — Adaptive Evals
 * "Continuous evaluation, not deployment gates"
 *
 * Some service quality properties can't be checked with regex or word counts:
 * Is the follow-up personalized to Marissa's walk habit, or generic? Does the
 * tone feel like a supportive coach, or a clinical assessment? Does the
 * escalation message give the owner enough detail to act? An LLM judge
 * evaluates these against defined criteria — binary pass/fail, not Likert
 * scales. Uses Haiku for speed and cost (~$0.003 per eval).
 *
 * REQUIRES: ANTHROPIC_API_KEY (run with `npm run test:evals`)
 *
 * Demo 2 in the masterclass shows this running live.
 */

import Anthropic from '@anthropic-ai/sdk'
import { replayTrace, clearToolLog } from '../../src/agent/executor'
import type { TraceFixture, AgentResponse } from '../../src/agent/types'
import * as fs from 'fs'
import * as path from 'path'

function loadFixture(name: string): TraceFixture {
  const filePath = path.join(__dirname, '../../fixtures', `${name}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

const hasApiKey = !!process.env.ANTHROPIC_API_KEY
const describeWithApi = hasApiKey ? describe : describe.skip

/** Retry on transient API errors (overloaded, rate limit) */
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = err instanceof Anthropic.APIError ? err.status : 0
      if (attempt < retries && (status === 529 || status === 429)) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

// =============================================================================
// Judge Harness
// =============================================================================

type JudgeResult = {
  pass: boolean
  reasoning: string
}

async function judgeResponse(
  criteria: string,
  agentResponse: string,
  context?: string
): Promise<JudgeResult> {
  const client = new Anthropic()

  const prompt = `You are an AI quality judge. Evaluate whether the following agent response meets the given criteria.

${context ? `Context: ${context}\n` : ''}
Criteria: ${criteria}

Agent response: "${agentResponse}"

Respond with ONLY a JSON object (no markdown fences):
{"pass": true or false, "reasoning": "1-2 sentence explanation"}`

  const response = await callWithRetry(() =>
    client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
  )

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  try {
    // Strip markdown code fences if present (Haiku often wraps JSON in ```json ... ```)
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    return JSON.parse(cleaned) as JudgeResult
  } catch {
    return { pass: false, reasoning: `Failed to parse judge response: ${text}` }
  }
}

// =============================================================================
// Follow-Up Quality (semantic eval)
// =============================================================================

describeWithApi('LLM judge: follow-up quality', () => {
  let result: AgentResponse

  beforeAll(async () => {
    clearToolLog()
    const fixture = loadFixture('scheduled-followup')
    result = await replayTrace(fixture)
  }, 45000)

  it('follow-up is personalized to Marissa\'s walk habit', async () => {
    const judgment = await judgeResponse(
      'The response is a personalized check-in that references Marissa\'s morning walk habit. It should feel like a coach who remembers what they discussed, not a generic "how are you?" message.',
      result.content,
      'Coach Q promised to check in on Marissa\'s morning walk habit. She walks at 6:45am for 20 minutes.'
    )

    console.log('Judge result (personalization):', JSON.stringify(judgment, null, 2))
    expect(judgment.pass).toBe(true)
  }, 30000)

  it('follow-up tone is warm and encouraging, not clinical', async () => {
    const judgment = await judgeResponse(
      'The response sounds like a supportive friend, not a clinical assessment. It should use casual language, be warm, and feel like texting — not email.',
      result.content
    )

    console.log('Judge result (tone):', JSON.stringify(judgment, null, 2))
    expect(judgment.pass).toBe(true)
  }, 30000)
})

// =============================================================================
// Escalation Quality (semantic eval)
// =============================================================================

describeWithApi('LLM judge: escalation quality', () => {
  let result: AgentResponse

  beforeAll(async () => {
    clearToolLog()
    const fixture = loadFixture('emergency-escalation')
    result = await replayTrace(fixture)
  }, 45000)

  it('escalation message has enough detail for the owner to act', async () => {
    const escalationMessage = result.escalationInfo?.message || ''

    const judgment = await judgeResponse(
      'The escalation message contains enough detail for a business owner to take action: what the emergency is (burst pipe), the urgency level, and what the customer needs. It should NOT be vague like "customer needs help".',
      escalationMessage,
      'Customer texted: "There\'s water everywhere, pipe burst in the basement"'
    )

    console.log('Judge result (escalation detail):', JSON.stringify(judgment, null, 2))
    expect(judgment.pass).toBe(true)
  }, 30000)
})
