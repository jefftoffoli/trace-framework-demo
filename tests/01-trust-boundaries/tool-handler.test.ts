/**
 * 01 — Trust Boundaries: Tool Handler Tests
 *
 * TRACE Layer: T — Trust Boundaries
 * "What the agent does alone vs. what needs human approval"
 *
 * Tool handler tests have the highest durability and ROI in any agent system.
 * Tools are the stable interface — they survived every rewrite of the production
 * system. Test outcomes ("did escalate record the right information?"), not wiring.
 *
 * These tests run OFFLINE — no API key needed.
 */

import { getTool, clearToolLog, getToolLog } from '../../src/agent/tools'

beforeEach(() => {
  clearToolLog()
})

describe('escalate tool', () => {
  const escalate = getTool('escalate')!

  it('exists in the registry', () => {
    expect(escalate).toBeDefined()
    expect(escalate.name).toBe('escalate')
  })

  it('records the escalation message in the tool log', async () => {
    const message = 'EMERGENCY: Customer reports burst pipe in basement, water actively flooding. Needs immediate dispatch.'

    await escalate.handler({ message })

    const log = getToolLog()
    expect(log).toHaveLength(1)
    expect(log[0].name).toBe('escalate')
    expect(log[0].params.message).toBe(message)
  })

  it('returns a confirmation string', async () => {
    const result = await escalate.handler({
      message: 'Customer wants to speak with a real person',
    })

    expect(result).toContain('Escalation recorded')
  })

  it('requires a message parameter', () => {
    // Schema enforcement — the input_schema defines message as required
    expect(escalate.input_schema.required).toContain('message')
  })
})

describe('schedule_followup tool', () => {
  const scheduleTool = getTool('schedule_followup')!

  it('exists in the registry', () => {
    expect(scheduleTool).toBeDefined()
  })

  it('records the scheduling context in the tool log', async () => {
    await scheduleTool.handler({
      message: 'Check on morning walk habit',
      scheduled_for: '2026-02-28T09:00',
    })

    const log = getToolLog()
    expect(log).toHaveLength(1)
    expect(log[0].name).toBe('schedule_followup')
    expect(log[0].params.message).toBe('Check on morning walk habit')
    expect(log[0].params.scheduled_for).toBe('2026-02-28T09:00')
  })

  it('accepts delay_hours as an alternative to scheduled_for', async () => {
    await scheduleTool.handler({
      message: 'Follow up on appointment interest',
      delay_hours: 24,
    })

    const log = getToolLog()
    expect(log[0].params.delay_hours).toBe(24)
  })
})

describe('check_schedule tool', () => {
  const checkTool = getTool('check_schedule')!

  it('exists in the registry', () => {
    expect(checkTool).toBeDefined()
  })

  it('returns schedule status', async () => {
    const result = await checkTool.handler({})
    expect(result).toContain('No active follow-ups')
  })
})

describe('send_sms tool', () => {
  const sendTool = getTool('send_sms')!

  it('exists in the registry', () => {
    expect(sendTool).toBeDefined()
  })

  it('records the outbound message', async () => {
    await sendTool.handler({ message: 'Hey Marissa, how did the walk go?' })

    const log = getToolLog()
    expect(log).toHaveLength(1)
    expect(log[0].name).toBe('send_sms')
    expect(log[0].params.message).toContain('Marissa')
  })

  it('requires a message parameter', () => {
    expect(sendTool.input_schema.required).toContain('message')
  })
})

describe('tool isolation', () => {
  it('clearToolLog resets between tests', async () => {
    const escalate = getTool('escalate')!
    await escalate.handler({ message: 'test' })
    expect(getToolLog()).toHaveLength(1)

    clearToolLog()
    expect(getToolLog()).toHaveLength(0)
  })

  it('multiple tool calls accumulate in order', async () => {
    const escalate = getTool('escalate')!
    const schedule = getTool('schedule_followup')!

    await escalate.handler({ message: 'first' })
    await schedule.handler({ message: 'second' })

    const log = getToolLog()
    expect(log).toHaveLength(2)
    expect(log[0].name).toBe('escalate')
    expect(log[1].name).toBe('schedule_followup')
  })
})
