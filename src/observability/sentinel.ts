/**
 * TRACE Framework Demo — Lightweight Sentinel (Anomaly Detection)
 *
 * TRACE Layer: R — Runtime Observability
 * "Even lightweight anomaly detection — a cron job scanning recent traces
 * for repeated timeouts, response repetition, or sudden context size
 * spikes — transforms 'human stumbles across it' into 'system flags it.'"
 *
 * This is the "sensor on the machine" discussed in Section 3.
 * The detection is automated; the diagnosis stays human.
 *
 * Pure functions, no DB, no API calls.
 */

// =============================================================================
// Types
// =============================================================================

export type TraceSummary = {
  agentId: string
  traceId: string
  timestamp: Date
  timedOut: boolean
  responseContent: string
  inputTokens: number
}

export type Anomaly = {
  type: 'timeout_spike' | 'repetition' | 'context_bloat'
  agentId: string
  detail: string
  traceIds: string[]
}

export type SentinelThresholds = {
  maxTimeoutsPerDay: number
  repetitionThreshold: number
  tokenSpikeMultiplier: number
}

const DEFAULT_THRESHOLDS: SentinelThresholds = {
  maxTimeoutsPerDay: 2,
  repetitionThreshold: 3,
  tokenSpikeMultiplier: 2,
}

// =============================================================================
// Detection
// =============================================================================

/**
 * Scan a batch of recent traces for anomalies.
 * Returns an array of flagged anomalies — empty means all clear.
 *
 * In production, this runs as a cron job. The output goes to a text
 * or Slack message, not a dashboard. "Agent [plumber-denver] had 3
 * timeouts today. Trace ID: abc123."
 */
export function detectAnomalies(
  traces: TraceSummary[],
  thresholds?: Partial<SentinelThresholds>,
): Anomaly[] {
  const config = { ...DEFAULT_THRESHOLDS, ...thresholds }
  const anomalies: Anomaly[] = []

  // Group traces by agent — anomalies are per-agent, not global
  const byAgent = new Map<string, TraceSummary[]>()
  for (const trace of traces) {
    const existing = byAgent.get(trace.agentId) || []
    existing.push(trace)
    byAgent.set(trace.agentId, existing)
  }

  for (const [agentId, agentTraces] of byAgent) {
    // 1. Timeout spikes — too many timeouts in a batch
    const timeouts = agentTraces.filter((t) => t.timedOut)
    if (timeouts.length > config.maxTimeoutsPerDay) {
      anomalies.push({
        type: 'timeout_spike',
        agentId,
        detail: `${timeouts.length} timeouts in batch (threshold: ${config.maxTimeoutsPerDay})`,
        traceIds: timeouts.map((t) => t.traceId),
      })
    }

    // 2. Response repetition — same phrase across multiple traces
    const responseCounts = new Map<string, string[]>()
    for (const trace of agentTraces) {
      const normalized = trace.responseContent.toLowerCase().trim().replace(/\s+/g, ' ')
      if (normalized.length > 10) {
        const existing = responseCounts.get(normalized) || []
        existing.push(trace.traceId)
        responseCounts.set(normalized, existing)
      }
    }
    for (const [, traceIds] of responseCounts) {
      if (traceIds.length >= config.repetitionThreshold) {
        anomalies.push({
          type: 'repetition',
          agentId,
          detail: `Same response repeated ${traceIds.length} times`,
          traceIds,
        })
      }
    }

    // 3. Context bloat — token count far above the agent's average
    if (agentTraces.length >= 3) {
      const avgTokens = agentTraces.reduce((sum, t) => sum + t.inputTokens, 0) / agentTraces.length
      for (const trace of agentTraces) {
        if (trace.inputTokens > avgTokens * config.tokenSpikeMultiplier) {
          anomalies.push({
            type: 'context_bloat',
            agentId,
            detail: `${trace.inputTokens} input tokens (${config.tokenSpikeMultiplier}x avg of ${Math.round(avgTokens)})`,
            traceIds: [trace.traceId],
          })
        }
      }
    }
  }

  return anomalies
}
