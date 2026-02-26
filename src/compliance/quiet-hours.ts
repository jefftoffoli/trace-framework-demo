/**
 * TRACE Framework Demo — Quiet Hours Enforcement (TCPA Compliance)
 *
 * TCPA restricts automated texts between 9pm and 8am in the consumer's
 * local timezone. Penalty: $500-$1,500 per violation.
 *
 * This is deterministic enforcement — never a model decision.
 * Pure functions, no DB calls.
 */

export const QUIET_START = 21 // 9pm
export const QUIET_END = 8   // 8am

/**
 * Check if a given time falls within quiet hours (9pm-8am)
 * in the given IANA timezone.
 *
 * Accepts an optional `now` parameter for testing.
 */
export function isQuietHours(timezone?: string, now?: Date): boolean {
  const tz = timezone || 'America/Denver'
  const hour = getHourInTimezone(now || new Date(), tz)
  return hour >= QUIET_START || hour < QUIET_END
}

/**
 * Returns the next time quiet hours end (8:00 AM) as a UTC Date.
 * Call during quiet hours to determine when to schedule a deferred message.
 */
export function getNextQuietHoursEnd(timezone?: string, now?: Date): Date {
  const tz = timezone || 'America/Denver'
  const currentTime = now || new Date()
  const hour = getHourInTimezone(currentTime, tz)

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(currentTime)

  const minute = parseInt(
    parts.find((p) => p.type === 'minute')?.value || '0',
    10
  )

  // Hours until 8am: evening (>=21) wraps past midnight
  const hoursUntilEnd =
    hour >= QUIET_START
      ? 24 - hour + QUIET_END
      : QUIET_END - hour

  const msUntilEnd = (hoursUntilEnd * 60 - minute) * 60 * 1000
  return new Date(currentTime.getTime() + msUntilEnd)
}

/**
 * Get the hour (0-23) for a given Date in the specified IANA timezone.
 */
function getHourInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const hourPart = parts.find((p) => p.type === 'hour')
  return parseInt(hourPart?.value || '0', 10)
}
