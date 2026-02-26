/**
 * 05 — Enforcement: Business Hours Scheduling
 *
 * TRACE Layer: E — Enforcement
 * "Compliance and safety rules that never become model decisions"
 *
 * Business hours are deterministic constraints:
 * - 7am-7pm local time
 * - No Sunday before noon
 *
 * These tests verify the scheduling logic that determines WHEN a message
 * can be sent. The model decides WHAT to say; the enforcement layer
 * decides WHEN it's allowed to send.
 *
 * OFFLINE — no API key needed.
 */

import {
  getNextSendTime,
  isWithinBusinessHours,
} from '../../src/scheduling/business-hours'

describe('business hours enforcement', () => {
  // Helper: create a Date from a specific local time in a timezone
  function localDate(
    year: number, month: number, day: number,
    hour: number, minute: number,
    timezone: string
  ): Date {
    // Create a date string and find the UTC equivalent
    const base = new Date(Date.UTC(year, month - 1, day, hour, minute))
    // Adjust for timezone offset by iteration
    for (let offset = -12; offset <= 14; offset++) {
      const candidate = new Date(Date.UTC(year, month - 1, day, hour - offset, minute))
      const localHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false,
        }).format(candidate),
        10
      )
      const localWeekday = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
      }).format(candidate)
      const localDay = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          day: 'numeric',
        }).format(candidate),
        10
      )

      if (localHour === hour && localDay === day) {
        return candidate
      }
    }
    // Fallback
    return base
  }

  describe('isWithinBusinessHours', () => {
    it('10am on a Tuesday is within business hours', () => {
      // Feb 25, 2026 is a Wednesday
      const date = localDate(2026, 2, 25, 10, 0, 'America/Chicago')
      expect(isWithinBusinessHours(date, 'America/Chicago')).toBe(true)
    })

    it('6am is before business hours', () => {
      const date = localDate(2026, 2, 25, 6, 0, 'America/Chicago')
      expect(isWithinBusinessHours(date, 'America/Chicago')).toBe(false)
    })

    it('7pm (19:00) is after business hours', () => {
      const date = localDate(2026, 2, 25, 19, 0, 'America/Chicago')
      expect(isWithinBusinessHours(date, 'America/Chicago')).toBe(false)
    })

    it('11pm is after business hours', () => {
      const date = localDate(2026, 2, 25, 23, 0, 'America/Chicago')
      expect(isWithinBusinessHours(date, 'America/Chicago')).toBe(false)
    })

    it('Sunday at 10am is blocked (before noon on Sundays)', () => {
      // Mar 1, 2026 is a Sunday
      const date = localDate(2026, 3, 1, 10, 0, 'America/Chicago')
      expect(isWithinBusinessHours(date, 'America/Chicago')).toBe(false)
    })

    it('Sunday at 1pm is allowed', () => {
      const date = localDate(2026, 3, 1, 13, 0, 'America/Chicago')
      expect(isWithinBusinessHours(date, 'America/Chicago')).toBe(true)
    })
  })

  describe('getNextSendTime', () => {
    it('returns the same time if already within business hours', () => {
      const date = localDate(2026, 2, 25, 10, 0, 'America/Chicago')
      const result = getNextSendTime(date, 'America/Chicago')
      expect(result.getTime()).toBe(date.getTime())
    })

    it('advances past midnight to the next morning', () => {
      const late = localDate(2026, 2, 25, 22, 0, 'America/Chicago')
      const result = getNextSendTime(late, 'America/Chicago')

      // Should be pushed to next valid business hour
      expect(result.getTime()).toBeGreaterThan(late.getTime())
      expect(isWithinBusinessHours(result, 'America/Chicago')).toBe(true)
    })

    it('advances Sunday morning to Sunday afternoon', () => {
      const sundayMorning = localDate(2026, 3, 1, 9, 0, 'America/Chicago')
      const result = getNextSendTime(sundayMorning, 'America/Chicago')

      expect(result.getTime()).toBeGreaterThan(sundayMorning.getTime())
      expect(isWithinBusinessHours(result, 'America/Chicago')).toBe(true)
    })

    it('defaults to America/Chicago when timezone is null', () => {
      const date = localDate(2026, 2, 25, 10, 0, 'America/Chicago')
      const result = getNextSendTime(date, null)
      // Should not throw and should return a valid time
      expect(result).toBeInstanceOf(Date)
    })

    it('never returns a time outside business hours', () => {
      // Property test: try several times, all results should be valid
      const testTimes = [
        localDate(2026, 2, 25, 3, 0, 'America/Chicago'),   // 3am
        localDate(2026, 2, 25, 6, 30, 'America/Chicago'),   // 6:30am
        localDate(2026, 2, 25, 20, 0, 'America/Chicago'),   // 8pm
        localDate(2026, 3, 1, 8, 0, 'America/Chicago'),     // Sunday 8am
      ]

      for (const time of testTimes) {
        const result = getNextSendTime(time, 'America/Chicago')
        expect(isWithinBusinessHours(result, 'America/Chicago')).toBe(true)
      }
    })
  })

  describe('timezone handling', () => {
    it('respects the contact timezone for business hours', () => {
      // 7pm Eastern = 5pm Mountain — still within business hours in Mountain
      const sevenpmEastern = localDate(2026, 2, 25, 19, 0, 'America/New_York')

      expect(isWithinBusinessHours(sevenpmEastern, 'America/New_York')).toBe(false)
      expect(isWithinBusinessHours(sevenpmEastern, 'America/Denver')).toBe(true)
    })
  })
})
