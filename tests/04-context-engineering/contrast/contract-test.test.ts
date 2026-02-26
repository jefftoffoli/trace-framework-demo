/**
 * 04 — Context Engineering: Contract Test (THE DURABLE WAY)
 *
 * TRACE Layer: C — Context Engineering
 * "What the model sees at each decision point"
 *
 * This test demonstrates the DURABLE approach: testing at the boundary.
 * Same feature as mock-chain.test.ts (scheduled follow-up), but no mocks
 * of internal modules. Instead, we test the contract:
 *   "Given this input, the system produces the right output."
 *
 * In production, this test survived every refactor. The mock-chain version
 * broke 16 times in 7 weeks.
 *
 * Demo 3 in the masterclass shows this side-by-side with mock-chain.test.ts.
 *
 * OFFLINE — no API key needed. Uses the tool handlers directly.
 */

import { getTool, clearToolLog, getToolLog } from '../../../src/agent/tools'
import type { TraceFixture } from '../../../src/agent/types'
import * as fs from 'fs'
import * as path from 'path'

function loadFixture(name: string): TraceFixture {
  const filePath = path.join(__dirname, '../../../fixtures', `${name}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

describe('scheduled follow-up (contract test approach)', () => {
  beforeEach(() => {
    clearToolLog()
  })

  /**
   * Contract: When the schedule_followup tool is called with a message
   * and a time, it records the scheduling in the tool log.
   *
   * This tests the BOUNDARY — the tool's input/output contract.
   * It doesn't care how the executor calls it, how context is assembled,
   * or how messages are formatted internally.
   */
  it('schedule_followup records the correct context and timing', async () => {
    const tool = getTool('schedule_followup')!

    await tool.handler({
      message: 'Check on morning walk habit',
      scheduled_for: '2026-02-28T09:00',
    })

    const log = getToolLog()
    expect(log).toHaveLength(1)
    expect(log[0].name).toBe('schedule_followup')
    expect(log[0].params.message).toContain('walk')
    expect(log[0].params.scheduled_for).toBe('2026-02-28T09:00')
  })

  /**
   * Contract: The fixture format matches what the replay system expects.
   * If someone creates a new fixture, it must have the right shape.
   */
  it('fixture has the required fields for trace replay', () => {
    const fixture = loadFixture('scheduled-followup')

    // Required top-level fields
    expect(fixture.id).toBeDefined()
    expect(fixture.systemPrompt).toBeTruthy()
    expect(fixture.userMessage).toBeTruthy()
    expect(fixture.conversationHistory).toBeInstanceOf(Array)
    expect(fixture.tools).toBeInstanceOf(Array)

    // Agent config
    expect(fixture.agent.id).toBeTruthy()
    expect(fixture.agent.model).toMatch(/^(haiku|sonnet|opus)$/)

    // Tools have the right schema shape
    for (const tool of fixture.tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.input_schema.type).toBe('object')
    }
  })

  /**
   * Contract: Conversation history entries have the right shape.
   * This prevents malformed fixtures from causing cryptic API errors.
   */
  it('conversation history entries are valid messages', () => {
    const fixture = loadFixture('scheduled-followup')

    for (const msg of fixture.conversationHistory) {
      expect(msg.role).toMatch(/^(user|assistant)$/)
      expect(msg.content).toBeTruthy()
    }
  })

  /**
   * Contract: escalate tool records actionable information.
   * Tested at the boundary — input in, log entry out.
   */
  it('escalate records enough context for human action', async () => {
    const tool = getTool('escalate')!

    await tool.handler({
      message: 'EMERGENCY: Customer reports burst pipe, water flooding basement. Needs immediate dispatch.',
    })

    const log = getToolLog()
    expect(log).toHaveLength(1)
    // The escalation should contain actionable keywords
    expect(log[0].params.message).toMatch(/burst pipe|flood|emergency/i)
  })
})

/**
 * TEACHING NOTE:
 *
 * Same feature. Same assertions. But zero mocks of internal modules.
 *
 * What happens when:
 * - loadConversationHistory gets renamed? → This test doesn't care.
 * - assembleSystemPrompt changes its API? → This test doesn't care.
 * - The executor is rewritten from scratch? → This test still passes.
 *
 * The test is coupled to BEHAVIOR (tool contracts, fixture format),
 * not IMPLEMENTATION (which modules call which functions).
 *
 * This is why Section 5 says: "test boundaries, not internals."
 */
