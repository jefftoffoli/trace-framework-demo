/**
 * 04 — Context Engineering: Mock-Chain Test (THE FRAGILE WAY)
 *
 * TRACE Layer: C — Context Engineering
 * "What the model sees at each decision point"
 *
 * This test demonstrates the FRAGILE approach: mocking internal modules
 * to test a feature. It passes — but it's coupled to implementation details.
 *
 * In the production codebase, a file like this was modified 16 times in
 * 7 weeks. Every time the internals changed — renamed a function, moved
 * a module, changed a return type — this test broke.
 *
 * Demo 3 in the masterclass shows this side-by-side with contract-test.test.ts.
 *
 * OFFLINE — no API key needed.
 */

// ---------------------------------------------------------------------------
// Mock declarations — THIS IS THE PROBLEM
// ---------------------------------------------------------------------------
// In a real codebase, these would be:
//   jest.mock('../../lib/agent-sdk/executor')
//   jest.mock('../../lib/agent-sdk/tools')
//   jest.mock('../../lib/agent-sdk/context')
//   jest.mock('../../lib/sms/quiet-hours')
//
// Every time any of those modules changes shape, this test file breaks.
// Here we simulate the pattern with local mocks to illustrate the point.

// Simulated internal modules (what you'd be mocking in production)
const mockExecutor = {
  executeAgent: jest.fn(),
}

const mockToolRegistry = {
  getToolHandler: jest.fn(),
}

const mockContextLoader = {
  loadConversationHistory: jest.fn(),
  assembleSystemPrompt: jest.fn(),
}

const mockMessageFormatter = {
  formatOutbound: jest.fn(),
}

describe('scheduled follow-up (mock-chain approach)', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Wire up the mock chain — 4 mocks, all coupled to internal signatures
    mockContextLoader.loadConversationHistory.mockResolvedValue([
      { role: 'user', content: 'I want to start walking in the morning' },
      { role: 'assistant', content: "I'll check in tomorrow morning" },
    ])

    mockContextLoader.assembleSystemPrompt.mockReturnValue(
      'You are Coach Q, a wellness coach...'
    )

    mockToolRegistry.getToolHandler.mockReturnValue(
      async (args: Record<string, unknown>) => ({
        success: true,
        message: `Follow-up scheduled: ${args.message}`,
      })
    )

    mockExecutor.executeAgent.mockResolvedValue({
      content: 'Hey Marissa! How did the walk go this morning?',
      toolCalls: [
        {
          name: 'schedule_followup',
          params: { message: 'Check on walk habit', scheduled_for: '2026-02-28T09:00' },
          result: 'Follow-up scheduled',
        },
      ],
    })

    mockMessageFormatter.formatOutbound.mockReturnValue(
      'Hey Marissa! How did the walk go this morning?'
    )
  })

  it('loads conversation history', async () => {
    // Call the mock chain
    const history = await mockContextLoader.loadConversationHistory()
    const systemPrompt = mockContextLoader.assembleSystemPrompt()
    const result = await mockExecutor.executeAgent({
      systemPrompt,
      messages: history,
    })
    const formatted = mockMessageFormatter.formatOutbound(result.content)

    expect(mockContextLoader.loadConversationHistory).toHaveBeenCalled()
    expect(formatted).toContain('Marissa')
  })

  it('calls schedule_followup with the right parameters', async () => {
    const history = await mockContextLoader.loadConversationHistory()
    const systemPrompt = mockContextLoader.assembleSystemPrompt()
    const result = await mockExecutor.executeAgent({
      systemPrompt,
      messages: history,
    })

    const scheduleCalls = result.toolCalls.filter(
      (tc: { name: string }) => tc.name === 'schedule_followup'
    )
    expect(scheduleCalls).toHaveLength(1)
    expect(scheduleCalls[0].params.message).toContain('walk')
  })

  it('formats the outbound message', async () => {
    const result = await mockExecutor.executeAgent({})
    const formatted = mockMessageFormatter.formatOutbound(result.content)

    expect(mockMessageFormatter.formatOutbound).toHaveBeenCalledWith(result.content)
    expect(formatted).toBeTruthy()
  })
})

/**
 * TEACHING NOTE:
 *
 * This test passes. It tests the right FEATURE (scheduled follow-up).
 * But it's testing by mocking 4 internal modules.
 *
 * What happens when:
 * - loadConversationHistory gets renamed to getMessageHistory? → Test breaks.
 * - assembleSystemPrompt adds a required parameter? → Test breaks.
 * - executeAgent changes its return shape? → Test breaks.
 * - formatOutbound moves to a different module? → Test breaks.
 *
 * None of those changes affect the BEHAVIOR the test is supposed to verify.
 * The test is coupled to implementation, not behavior.
 *
 * See contract-test.test.ts for the durable alternative.
 */
