/**
 * 04 — Context Engineering: New vs Returning Prospect
 *
 * TRACE Layer: C — Context Engineering
 * "The model wasn't wrong — it was uninformed."
 *
 * Same agent. Same base system prompt. Different injected context.
 * The new prospect gets [NEW PROSPECT] — no history, no name.
 * The returning prospect gets [RETURNING PROSPECT. Name: Mike, Business: Johnson HVAC]
 * plus conversation history about pricing.
 *
 * The test asserts the behavioral difference. Context in → behavior out.
 *
 * Demo 3 in the masterclass.
 *
 * REQUIRES: ANTHROPIC_API_KEY
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

// =============================================================================
// Judge Harness (same pattern as llm-judge.test.ts)
// =============================================================================

type JudgeResult = {
  pass: boolean
  reasoning: string
}

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

async function judgeResponse(
  criteria: string,
  agentResponse: string,
  context?: string,
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
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    return JSON.parse(cleaned) as JudgeResult
  } catch {
    return { pass: false, reasoning: `Failed to parse judge response: ${text}` }
  }
}

// =============================================================================
// Demo 3: Context engineering — same agent, different context, different behavior
// =============================================================================

describeWithApi('context engineering — the C layer', () => {

  /**
   * NEW PROSPECT: "hey" with no contact history.
   * Context: [NEW PROSPECT — first time texting this number]
   * Expected: introduces itself, explains the product.
   */
  describe('new prospect — no contact context', () => {
    let result: AgentResponse

    beforeAll(async () => {
      clearToolLog()
      const fixture = loadFixture('terse-opener')
      result = await replayTrace(fixture)
    }, 45000)

    it('introduces itself or explains the product', () => {
      const content = result.content.toLowerCase()
      const introducesOrExplains =
        /relay/i.test(content) ||
        /welcome/i.test(content) ||
        /help/i.test(content) ||
        /business/i.test(content) ||
        /how can/i.test(content)
      expect(introducesOrExplains).toBe(true)
    })

    it('does not reference any prior conversation', () => {
      const content = result.content.toLowerCase()
      expect(content).not.toMatch(/last time/i)
      expect(content).not.toMatch(/we (spoke|talked|discussed|chatted)/i)
      expect(content).not.toMatch(/following up/i)
    })

    it('treats the person as a stranger', async () => {
      const judgment = await judgeResponse(
        'The response treats the recipient as someone the agent has never spoken to before. It introduces itself or the product, and does NOT assume any prior relationship or knowledge of who they are.',
        result.content,
        'A new prospect texted "hey" with no prior conversation history. The agent has no name, no business, no context about this person.',
      )

      console.log('Judge result (new prospect):', JSON.stringify(judgment, null, 2))
      expect(judgment.pass).toBe(true)
    }, 30000)
  })

  /**
   * RETURNING PROSPECT: Mike from Johnson HVAC, back after a pricing conversation.
   * Context: [RETURNING PROSPECT. Name: Mike, Business: Johnson HVAC] + history
   * Expected: picks up where they left off, answers the trial question.
   */
  describe('returning prospect — with contact context', () => {
    let result: AgentResponse

    beforeAll(async () => {
      clearToolLog()
      const fixture = loadFixture('returning-prospect')
      result = await replayTrace(fixture)
    }, 45000)

    it('does not re-ask what business they run', () => {
      const content = result.content.toLowerCase()
      expect(content).not.toMatch(/what('s| is) your (business|company)/i)
      expect(content).not.toMatch(/what (do you|does your).*(do|run|operate)/i)
      expect(content).not.toMatch(/tell me about your (business|company)/i)
    })

    it('references pricing or trial', () => {
      const content = result.content.toLowerCase()
      const referencesPriorTopic =
        /trial/i.test(content) ||
        /pric/i.test(content) ||
        /free/i.test(content) ||
        /sign.?up/i.test(content)
      expect(referencesPriorTopic).toBe(true)
    })

    it('treats the person as someone it already knows', async () => {
      const judgment = await judgeResponse(
        'The response treats the recipient as a returning contact the agent has spoken to before. It does NOT re-introduce itself, does NOT re-explain what the product is, and picks up naturally from a prior conversation about pricing.',
        result.content,
        'Mike from Johnson HVAC asked about pricing 3 days ago. He is back asking "How does the trial work?" The agent has his name, business, and full conversation history.',
      )

      console.log('Judge result (returning prospect):', JSON.stringify(judgment, null, 2))
      expect(judgment.pass).toBe(true)
    }, 30000)
  })
})

/**
 * TEACHING NOTE:
 *
 * Same agent, same model, same tools. The only variable is the context:
 *
 *   New prospect:       [NEW PROSPECT — first time texting this number]
 *   Returning prospect: [RETURNING PROSPECT. Name: Mike, Business: Johnson HVAC]
 *                       + conversation history about pricing
 *
 * The behavioral difference is entirely driven by what the model sees.
 * The model wasn't wrong — it was uninformed. Context in → behavior out.
 */
