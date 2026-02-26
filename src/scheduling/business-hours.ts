/**
 * TRACE Framework Demo — Business Hours Scheduling
 *
 * Simplified from production. Pure functions, no DB.
 * Enforces: 7am-7pm local time, no Sunday before noon.
 */

const BUSINESS_HOURS_START = 7  // 7:00 AM
const BUSINESS_HOURS_END = 19   // 7:00 PM
const DEFAULT_TIMEZONE = 'America/Chicago'

/**
 * Determines the next valid send time respecting:
 * - Contact/client timezone (falls back to America/Chicago)
 * - Business hours (7am-7pm local time)
 * - No Sunday before noon
 */
export function getNextSendTime(
  requestedAt: Date,
  timezone: string | null
): Date {
  const tz = timezone || DEFAULT_TIMEZONE
  const localTime = getLocalTime(requestedAt, tz)

  if (isValidSendTime(localTime)) {
    return requestedAt
  }

  return findNextValidTime(requestedAt, tz)
}

/**
 * Check if a given date falls within business hours in the given timezone.
 */
export function isWithinBusinessHours(
  date: Date,
  timezone: string | null
): boolean {
  const tz = timezone || DEFAULT_TIMEZONE
  return isValidSendTime(getLocalTime(date, tz))
}

// =============================================================================
// Internal helpers
// =============================================================================

interface LocalTime {
  hour: number
  dayOfWeek: number // 0 = Sunday, 6 = Saturday
}

function getLocalTime(date: Date, timezone: string): LocalTime {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }
  const weekdayOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'short',
  }

  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', options).format(date),
    10
  )
  const weekday = new Intl.DateTimeFormat('en-US', weekdayOptions).format(date)

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  return { hour, dayOfWeek: dayMap[weekday] ?? 1 }
}

function isValidSendTime(local: LocalTime): boolean {
  if (local.hour < BUSINESS_HOURS_START || local.hour >= BUSINESS_HOURS_END) {
    return false
  }
  if (local.dayOfWeek === 0 && local.hour < 12) {
    return false
  }
  return true
}

function findNextValidTime(requestedAt: Date, timezone: string): Date {
  const maxIterations = 48
  const candidate = new Date(requestedAt)

  for (let i = 0; i < maxIterations; i++) {
    candidate.setHours(candidate.getHours() + 1)
    candidate.setMinutes(0, 0, 0)

    const local = getLocalTime(candidate, timezone)
    if (isValidSendTime(local)) {
      return candidate
    }
  }

  return new Date(requestedAt.getTime() + 24 * 60 * 60 * 1000)
}
