/**
 * 02 — Runtime Observability: Trace Replay Tests
 *
 * TRACE Layer: R — Runtime Observability
 * "Every decision logged, traced, and queryable"
 *
 * Trace-based replay: record real production interactions as fixtures,
 * then replay them as test cases. The model gets the same context and tools,
 * but makes a fresh decision. We assert on properties of the output —
 * not exact content.
 *
 * REQUIRES: ANTHROPIC_API_KEY (run with `npm run test:replay`)
 *
 * Demo 1 in the masterclass uses the "scheduled-followup" fixture.
 */

import { replayTrace, getToolLog, clearToolLog } from '../../src/agent/executor'
import type { TraceFixture } from '../../src/agent/types'
import type { AgentResponse } from '../../src/agent/types'
import * as fs from 'fs'
import * as path from 'path'

function loadFixture(name: string): TraceFixture {
  const filePath = path.join(__dirname, '../../fixtures', `${name}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

const hasApiKey = !!process.env.ANTHROPIC_API_KEY
const describeWithApi = hasApiKey ? describe : describe.skip

// =============================================================================
// Demo 1: Scheduled Follow-up (shown live in the masterclass)
// =============================================================================

describeWithApi('scheduled-followup trace replay', () => {
  let result: AgentResponse

  beforeAll(async () => {
    clearToolLog()
    const fixture = loadFixture('scheduled-followup')
    result = await replayTrace(fixture)
  }, 45000)

  it('references the walk', () => {
    // The agent should mention the specific habit from the conversation
    expect(result.content.toLowerCase()).toMatch(/walk/)
  })

  it('is under 40 words (SMS brevity)', () => {
    const wordCount = result.content.split(/\s+/).filter(Boolean).length
    expect(wordCount).toBeLessThan(40)
  })

  it('does not re-introduce itself', () => {
    // A scheduled follow-up should NOT say "Hey, this is Coach Q" again
    const lower = result.content.toLowerCase()
    expect(lower).not.toMatch(/this is coach|i'm coach|my name is/)
  })

  it('does not SKIP the follow-up', () => {
    // The agent should compose a message, not skip
    expect(result.content.toUpperCase()).not.toContain('SKIP')
    expect(result.content.length).toBeGreaterThan(5)
  })
})

// =============================================================================
// Emergency Escalation
// =============================================================================

describeWithApi('emergency-escalation trace replay', () => {
  let result: AgentResponse

  beforeAll(async () => {
    clearToolLog()
    const fixture = loadFixture('emergency-escalation')
    result = await replayTrace(fixture)
  }, 45000)

  it('escalates', () => {
    expect(result.escalated).toBe(true)
  })

  it('escalation message mentions the emergency', () => {
    expect(result.escalationInfo).not.toBeNull()
    const message = result.escalationInfo!.message.toLowerCase()
    // Should include actionable context, not just "customer needs help"
    expect(message).toMatch(/pipe|burst|water|flood|emergency/)
  })

  it('acknowledges urgency in the response', () => {
    const lower = result.content.toLowerCase()
    expect(lower).toMatch(/right away|immediately|asap|urgent|emergency|getting.*help/)
  })
})

// =============================================================================
// Terse Opener
// =============================================================================

describeWithApi('terse-opener trace replay', () => {
  let result: AgentResponse

  beforeAll(async () => {
    clearToolLog()
    const fixture = loadFixture('terse-opener')
    result = await replayTrace(fixture)
  }, 45000)

  it('responds meaningfully to "hey"', () => {
    // Should not just say "hey" back — should welcome and explain
    expect(result.content.length).toBeGreaterThan(20)
  })

  it('keeps it brief (SMS)', () => {
    const wordCount = result.content.split(/\s+/).filter(Boolean).length
    expect(wordCount).toBeLessThan(80)
  })

  it('does not use exclamation marks (per system prompt)', () => {
    expect(result.content).not.toContain('!')
  })
})
