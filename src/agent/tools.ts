/**
 * TRACE Framework Demo — Tool Definitions
 *
 * 4 simplified tools that mirror production patterns.
 * In production these write to Supabase. Here they write to an in-memory
 * ToolLog[] so tests can assert on tool call behavior.
 */

import { ToolDefinition, ToolLogEntry } from './types'

// In-memory log — tests read this to assert tool behavior
let toolLog: ToolLogEntry[] = []

export function getToolLog(): ToolLogEntry[] {
  return toolLog
}

export function clearToolLog(): void {
  toolLog = []
}

// =============================================================================
// Escalation
// =============================================================================

const escalate: ToolDefinition = {
  name: 'escalate',
  description:
    'Escalate to a human when the AI can\'t or shouldn\'t handle something alone. ' +
    'Use for emergencies, frustrated customers, or when you\'re unsure.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Natural language message with full context, urgency, and suggested action',
      },
    },
    required: ['message'],
  },
  handler: async (args) => {
    const entry: ToolLogEntry = {
      name: 'escalate',
      params: args,
      result: `Escalation recorded: ${args.message}`,
      timestamp: new Date(),
    }
    toolLog.push(entry)
    return entry.result
  },
}

// =============================================================================
// Follow-up Scheduling
// =============================================================================

const schedule_followup: ToolDefinition = {
  name: 'schedule_followup',
  description:
    'Schedule a follow-up message. The message param is a context hint ' +
    '(not sent literally). Pass scheduled_for as local time.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Context hint for follow-up composition',
      },
      scheduled_for: {
        type: 'string',
        description: 'When to fire, in local timezone (e.g. "2026-02-20T09:00")',
      },
      delay_hours: {
        type: 'number',
        description: 'Hours from now to fire (alternative to scheduled_for)',
      },
    },
    required: ['message'],
  },
  handler: async (args) => {
    const entry: ToolLogEntry = {
      name: 'schedule_followup',
      params: args,
      result: `Follow-up scheduled: ${args.message}`,
      timestamp: new Date(),
    }
    toolLog.push(entry)
    return entry.result
  },
}

// =============================================================================
// Check Schedule
// =============================================================================

const check_schedule: ToolDefinition = {
  name: 'check_schedule',
  description: 'Check scheduled follow-ups for the current contact.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  handler: async () => {
    const entry: ToolLogEntry = {
      name: 'check_schedule',
      params: {},
      result: 'No active follow-ups scheduled.',
      timestamp: new Date(),
    }
    toolLog.push(entry)
    return entry.result
  },
}

// =============================================================================
// Send SMS (for double-reply testing)
// =============================================================================

const send_sms: ToolDefinition = {
  name: 'send_sms',
  description: 'Send an SMS message to the contact.',
  input_schema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The SMS message to send',
      },
    },
    required: ['message'],
  },
  handler: async (args) => {
    const entry: ToolLogEntry = {
      name: 'send_sms',
      params: args,
      result: `SMS sent: ${args.message}`,
      timestamp: new Date(),
    }
    toolLog.push(entry)
    return entry.result
  },
}

// =============================================================================
// Registry
// =============================================================================

const ALL_TOOLS: ToolDefinition[] = [
  escalate,
  schedule_followup,
  check_schedule,
  send_sms,
]

const toolRegistry = new Map<string, ToolDefinition>(
  ALL_TOOLS.map((t) => [t.name, t])
)

export function getToolRegistry(): Map<string, ToolDefinition> {
  return toolRegistry
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name)
}
