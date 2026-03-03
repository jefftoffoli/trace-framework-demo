/**
 * 02 — Runtime Observability: Sentinel (Anomaly Detection)
 *
 * TRACE Layer: R — Runtime Observability
 * "The detection is automated; the diagnosis stays human."
 *
 * The sentinel scans recent traces for anomaly signals: timeout spikes,
 * response repetition, and context bloat. It doesn't fix anything — it
 * tells you when to look. Same pattern as infrastructure alerting.
 *
 * OFFLINE — no API key needed.
 */

import { detectAnomalies, TraceSummary } from '../../src/observability/sentinel'

// Helper: create a trace summary with sensible defaults
function trace(overrides: Partial<TraceSummary> & { traceId: string }): TraceSummary {
  return {
    agentId: 'test-agent',
    timestamp: new Date(),
    timedOut: false,
    responseContent: '',
    inputTokens: 500,
    ...overrides,
  }
}

// =============================================================================
// Timeout Spikes
// =============================================================================

describe('timeout spike detection', () => {
  it('flags agents with excessive timeouts', () => {
    const traces = [
      trace({ traceId: 't1', timedOut: true }),
      trace({ traceId: 't2', timedOut: true }),
      trace({ traceId: 't3', timedOut: true }),
      trace({ traceId: 't4', timedOut: false }),
    ]

    const anomalies = detectAnomalies(traces)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].type).toBe('timeout_spike')
    expect(anomalies[0].traceIds).toHaveLength(3)
  })

  it('does not flag normal timeout rates', () => {
    const traces = [
      trace({ traceId: 't1', timedOut: true }),
      trace({ traceId: 't2', timedOut: false }),
      trace({ traceId: 't3', timedOut: false }),
    ]

    const anomalies = detectAnomalies(traces)
    expect(anomalies).toHaveLength(0)
  })
})

// =============================================================================
// Response Repetition
// =============================================================================

describe('response repetition detection', () => {
  it('flags repeated identical responses', () => {
    const repeated = 'I apologize for the confusion. Let me help you with that.'
    const traces = [
      trace({ traceId: 't1', responseContent: repeated }),
      trace({ traceId: 't2', responseContent: repeated }),
      trace({ traceId: 't3', responseContent: repeated }),
      trace({ traceId: 't4', responseContent: 'A unique, normal response to the customer.' }),
    ]

    const anomalies = detectAnomalies(traces)
    const repetitions = anomalies.filter((a) => a.type === 'repetition')
    expect(repetitions).toHaveLength(1)
    expect(repetitions[0].traceIds).toHaveLength(3)
  })

  it('ignores short responses (trivial matches)', () => {
    const traces = [
      trace({ traceId: 't1', responseContent: 'ok' }),
      trace({ traceId: 't2', responseContent: 'ok' }),
      trace({ traceId: 't3', responseContent: 'ok' }),
    ]

    const anomalies = detectAnomalies(traces)
    expect(anomalies).toHaveLength(0)
  })
})

// =============================================================================
// Context Bloat
// =============================================================================

describe('context bloat detection', () => {
  it('flags traces with token counts far above the agent average', () => {
    const traces = [
      trace({ traceId: 't1', inputTokens: 500 }),
      trace({ traceId: 't2', inputTokens: 480 }),
      trace({ traceId: 't3', inputTokens: 520 }),
      trace({ traceId: 't4', inputTokens: 2000 }),
    ]

    const anomalies = detectAnomalies(traces)
    const bloat = anomalies.filter((a) => a.type === 'context_bloat')
    expect(bloat).toHaveLength(1)
    expect(bloat[0].traceIds).toContain('t4')
  })

  it('needs at least 3 traces for a meaningful average', () => {
    const traces = [
      trace({ traceId: 't1', inputTokens: 500 }),
      trace({ traceId: 't2', inputTokens: 5000 }),
    ]

    const anomalies = detectAnomalies(traces)
    const bloat = anomalies.filter((a) => a.type === 'context_bloat')
    expect(bloat).toHaveLength(0)
  })
})

// =============================================================================
// Clean Traces & Edge Cases
// =============================================================================

describe('clean traces', () => {
  it('returns empty array when all traces are normal', () => {
    const traces = [
      trace({ traceId: 't1', responseContent: 'Hi, how can I help you today?' }),
      trace({ traceId: 't2', responseContent: 'I can schedule that for tomorrow morning.' }),
      trace({ traceId: 't3', responseContent: "I'll have someone call you back shortly." }),
    ]

    const anomalies = detectAnomalies(traces)
    expect(anomalies).toHaveLength(0)
  })
})

describe('custom thresholds', () => {
  it('respects custom timeout threshold', () => {
    const traces = [
      trace({ traceId: 't1', timedOut: true }),
      trace({ traceId: 't2', timedOut: true }),
      trace({ traceId: 't3', timedOut: true }),
    ]

    // Default threshold (2) flags this
    expect(detectAnomalies(traces)).toHaveLength(1)
    // Raised threshold (5) does not
    expect(detectAnomalies(traces, { maxTimeoutsPerDay: 5 })).toHaveLength(0)
  })
})

describe('multi-agent isolation', () => {
  it('detects anomalies per agent, not globally', () => {
    const traces = [
      trace({ traceId: 'a1', agentId: 'agent-a', timedOut: true }),
      trace({ traceId: 'a2', agentId: 'agent-a', timedOut: true }),
      trace({ traceId: 'a3', agentId: 'agent-a', timedOut: true }),
      trace({ traceId: 'b1', agentId: 'agent-b', timedOut: false }),
      trace({ traceId: 'b2', agentId: 'agent-b', timedOut: false }),
    ]

    const anomalies = detectAnomalies(traces)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0].agentId).toBe('agent-a')
  })
})
