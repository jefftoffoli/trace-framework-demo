/**
 * TRACE Framework Demo — Simplified Agent Executor
 *
 * ~100 lines. Single-turn tool loop with no DB, no routing, no middleware.
 * Production version: 823 lines with routing, guardrails, timeouts, cost tracking.
 *
 * This is the "thin harness" discussed in Section 5 (Context Engineering):
 * an LLM running in a loop with good tools, good context, and good guardrails.
 */

import Anthropic from '@anthropic-ai/sdk'
import {
  AgentResponse,
  TraceFixture,
  ToolCall,
  ToolLogEntry,
} from './types'
import { getToolRegistry, clearToolLog, getToolLog } from './tools'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic()
  }
  return client
}

/**
 * Replay a trace fixture through the agent and return the response.
 * This is the core of trace-based testing: same context, same tools,
 * fresh model call — then assert on properties of the output.
 */
export async function replayTrace(fixture: TraceFixture): Promise<AgentResponse> {
  const anthropic = getClient()
  clearToolLog()

  const startTime = Date.now()
  const toolRegistry = getToolRegistry()
  const allToolCalls: ToolCall[] = []

  // Build the messages array from conversation history + user message
  const messages: Anthropic.MessageParam[] = [
    ...fixture.conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: fixture.userMessage },
  ]

  // Build tool definitions for the API
  const tools: Anthropic.Tool[] = fixture.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }))

  // Agent loop: call model, execute tools, repeat until text response
  const maxTurns = 5
  let finalContent = ''

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await anthropic.messages.create({
      model: fixture.agent.model === 'haiku' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: fixture.systemPrompt,
      messages,
      tools: tools.length > 0 ? tools : undefined,
    })

    // Collect text and tool use blocks
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === 'text'
    )
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    if (textBlocks.length > 0) {
      finalContent = textBlocks.map((b) => b.text).join('\n')
    }

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0) break

    // Execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolUseBlocks) {
      const tool = toolRegistry.get(block.name)
      const params = block.input as Record<string, unknown>
      let result: string

      if (tool) {
        result = await tool.handler(params)
      } else {
        result = `Unknown tool: ${block.name}`
      }

      allToolCalls.push({ name: block.name, params, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
      })
    }

    // Add assistant response and tool results to messages for next turn
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  const durationMs = Date.now() - startTime
  const escalationCall = allToolCalls.find((tc) => tc.name === 'escalate')

  return {
    content: finalContent,
    toolCalls: allToolCalls,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    escalated: !!escalationCall,
    escalationInfo: escalationCall
      ? {
          target: 'owner',
          message: String(escalationCall.params.message || ''),
        }
      : null,
    durationMs,
  }
}

/**
 * Get the tool log for assertion.
 * Re-exported from tools.ts for test convenience.
 */
export { getToolLog, clearToolLog }
