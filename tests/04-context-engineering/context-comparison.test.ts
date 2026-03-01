/**
 * 04 — Context Engineering: Context Comparison
 *
 * TRACE Layer: C — Context Engineering
 * "What the model sees at each decision point"
 *
 * The C insight: most "model errors" are context errors. The model makes
 * reasonable decisions given what it can see — the fix is better context
 * assembly, not better prompts or hard-coded rules.
 *
 * Same model, same tools, same conversation. Only the system prompt differs:
 * the "before" has no temporal data, the "after" includes timestamps.
 * The model can't reason about timing if timing isn't in the context.
 *
 * Demo 3 in the masterclass.
 *
 * REQUIRES: ANTHROPIC_API_KEY
 */

import { replayTrace, getToolLog, clearToolLog } from '../../src/agent/executor'
import type { TraceFixture, AgentResponse } from '../../src/agent/types'

const hasApiKey = !!process.env.ANTHROPIC_API_KEY
const describeWithApi = hasApiKey ? describe : describe.skip

// =============================================================================
// Shared scenario: customer asked about water heater repair, went quiet
// =============================================================================

const conversationHistory = [
  {
    role: 'assistant' as const,
    content:
      "Hi! This is the AI assistant for Denver Pro Plumbing. We noticed you tried calling — how can we help?",
  },
  {
    role: 'user' as const,
    content: "Yeah I need someone to look at my water heater. It's making a weird noise",
  },
  {
    role: 'assistant' as const,
    content:
      'We can definitely help with that. Are you available this week for someone to take a look?',
  },
  // Customer goes quiet here
]

const tools = [
  {
    name: 'schedule_followup',
    description:
      'Schedule a follow-up message. The message param is a context hint ' +
      '(not sent literally). Pass scheduled_for as local time or delay_hours ' +
      'as hours from now. Minimum reasonable follow-up delay is 2 hours for ' +
      'active conversations, 24 hours for cold outreach.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Context hint for follow-up composition' },
        scheduled_for: { type: 'string', description: 'When to fire, in local timezone' },
        delay_hours: { type: 'number', description: 'Hours from now to fire' },
      },
      required: ['message'],
    },
  },
  {
    name: 'send_sms',
    description: 'Send an SMS message to the contact right now.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'The SMS message to send' },
      },
      required: ['message'],
    },
  },
]

const basePrompt = `You are an AI assistant for Denver Pro Plumbing, a plumbing company in Denver, CO.

## Communication Style
- Keep messages SHORT — this is texting. 1-3 sentences max.
- Be helpful and professional.

## Follow-Up Rules
- If a customer goes quiet, you may schedule a follow-up.
- Don't be pushy or aggressive. Give people time to respond.
- Use schedule_followup to check in later — don't send an immediate message if they just went quiet.`

const userMessage = [
  '[CUSTOMER WENT QUIET]',
  'The customer has not responded to your last message.',
  'Decide whether to follow up and when.',
  '',
  'If following up later, use schedule_followup with an appropriate delay.',
  'If the customer just went quiet moments ago, waiting is usually better than following up immediately.',
].join('\n')

// =============================================================================
// Demo 3: Context comparison — before and after temporal data
// =============================================================================

describeWithApi('context comparison — the C insight', () => {
  /**
   * WITHOUT temporal context: the model has no idea how long ago the
   * customer's last message was. It has to guess when to follow up.
   *
   * Teaching point: "The model has a schedule_followup tool. It knows the
   * customer went quiet. But it has no temporal data. It can't reason about
   * HOW LONG they've been quiet."
   */
  describe('WITHOUT temporal context (the bug)', () => {
    let result: AgentResponse

    beforeAll(async () => {
      clearToolLog()

      const fixture: TraceFixture = {
        id: 'context-comparison-before',
        description:
          'Customer went quiet. No temporal data — model cannot reason about timing.',
        agent: { id: 'plumber-assistant', model: 'haiku' },
        systemPrompt:
          basePrompt +
          '\n\nCurrent time: Thursday, 02/27/2026, 2:07 PM (America/Denver)',
        conversationHistory,
        userMessage,
        tools,
      }

      result = await replayTrace(fixture)
    }, 45000)

    it('takes some action (follow-up or message)', () => {
      const log = getToolLog()
      const hasAction = log.some(
        (e) => e.name === 'schedule_followup' || e.name === 'send_sms'
      )
      // Model should do something — but whatever it does is an uninformed guess
      expect(hasAction).toBe(true)
    })

    it('cannot reference timing (because it has none)', () => {
      // The model's response should NOT mention "7 minutes" — it doesn't know
      expect(result.content).not.toMatch(/7 minutes/)
    })
  })

  /**
   * WITH temporal context: the system prompt now includes when the customer
   * last messaged. The model can reason: "It's only been 7 minutes — that's
   * not going quiet, that's a normal pause."
   *
   * Teaching point: "Same model, same tools, different context, different
   * outcome. The model wasn't wrong before — it was uninformed."
   */
  describe('WITH temporal context (the fix)', () => {
    let result: AgentResponse

    beforeAll(async () => {
      clearToolLog()

      const fixture: TraceFixture = {
        id: 'context-comparison-after',
        description:
          'Customer went quiet. Temporal context enriched — model can reason about recency.',
        agent: { id: 'plumber-assistant', model: 'haiku' },
        systemPrompt:
          basePrompt +
          '\n\nCurrent time: Thursday, 02/27/2026, 2:07 PM (America/Denver)' +
          '\n\n--- CONVERSATION TIMING ---' +
          '\nLast customer message: 7 minutes ago (2:00 PM)' +
          '\nConversation started: 12 minutes ago (1:55 PM)' +
          '\nThis is an active, recent conversation — the customer may still be typing or stepped away briefly.',
        conversationHistory,
        userMessage,
        tools,
      }

      result = await replayTrace(fixture)
    }, 45000)

    it('does NOT send an immediate SMS (7 minutes is too soon)', () => {
      const log = getToolLog()
      const sms = log.find((e) => e.name === 'send_sms')
      // With temporal context, model recognizes 7 minutes is not "going quiet"
      expect(sms).toBeUndefined()
    })

    it('schedules a follow-up with a reasonable delay (hours, not minutes)', () => {
      const log = getToolLog()
      const followup = log.find((e) => e.name === 'schedule_followup')

      expect(followup).toBeDefined()

      // The delay should be at least an hour from now, not minutes
      if (followup?.params.delay_hours) {
        expect(Number(followup.params.delay_hours)).toBeGreaterThanOrEqual(1)
      }
      if (followup?.params.scheduled_for) {
        // If using absolute time, should NOT be in the next 30 minutes (2:07-2:37 PM)
        const time = String(followup.params.scheduled_for)
        expect(time).not.toMatch(/14:[0-3]\d/)
      }
    })
  })
})

/**
 * TEACHING NOTE:
 *
 * Same model. Same tools. Same conversation history. Same user message.
 * The ONLY difference is what the system prompt contains.
 *
 * "Before" — the model schedules a follow-up but has no basis for timing.
 *   It's guessing. Sometimes it guesses well, sometimes it doesn't.
 *   This is the 7-minute follow-up bug from Section 1.
 *
 * "After" — the model sees "last message: 7 minutes ago" and recognizes
 *   this is too soon to follow up. It schedules hours out, not minutes.
 *   Not because we added a rule — because we added data.
 *
 * This is the C insight: most "model errors" in production are actually
 * context errors. The fix isn't a better prompt or a hard-coded minimum
 * delay. It's better context assembly.
 *
 * The companion repo also has tests/04-context-engineering/contrast/ with
 * a mock-chain vs. contract test comparison — a different C lesson about
 * what to test when the harness is thin.
 */
