/**
 * TRACE Framework Demo — Core Types
 *
 * Simplified from a production agent system.
 * In production these types bridge domain models (SMS, clients, contacts)
 * with the Claude Agent SDK. Here they're standalone for teaching.
 */

// =============================================================================
// Domain Context
// =============================================================================

export type ContactInfo = {
  phone: string
  name?: string | null
  timezone?: string | null
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

// =============================================================================
// Agent Context (what the model sees)
// =============================================================================

export type AgentContext = {
  systemPrompt: string
  conversationHistory: Message[]
  contact: ContactInfo
}

// =============================================================================
// Response Types
// =============================================================================

export type ToolCall = {
  name: string
  params: Record<string, unknown>
  result: unknown
}

export type AgentResponse = {
  content: string
  toolCalls: ToolCall[]
  usage: {
    inputTokens: number
    outputTokens: number
    costUsd: number
  }
  escalated: boolean
  escalationInfo: { target: string; message: string } | null
  durationMs: number
}

// =============================================================================
// Tool Definitions
// =============================================================================

export type ToolDefinition = {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  handler: (args: Record<string, unknown>) => Promise<string>
}

// =============================================================================
// Trace Fixture (for replay testing)
// =============================================================================

export type TraceFixture = {
  id: string
  description: string
  agent: {
    id: string
    model: 'haiku' | 'sonnet' | 'opus'
  }
  systemPrompt: string
  conversationHistory: Message[]
  userMessage: string
  tools: Array<{
    name: string
    description: string
    input_schema: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }>
}

// =============================================================================
// Tool Log (in-memory, for test assertions)
// =============================================================================

export type ToolLogEntry = {
  name: string
  params: Record<string, unknown>
  result: string
  timestamp: Date
}
