/**
 * 05 — Enforcement: Quiet Hours (TCPA Compliance)
 *
 * TRACE Layer: E — Enforcement
 * "Compliance and safety rules that never become model decisions"
 *
 * TCPA restricts automated texts between 9pm and 8am in the consumer's
 * local timezone. Penalty: $500-$1,500 per violation.
 *
 * These are deterministic tests for deterministic rules. They will never
 * become non-deterministic. The model never gets a vote on compliance.
 *
 * OFFLINE — no API key needed.
 */

import {
  isQuietHours,
  getNextQuietHoursEnd,
  QUIET_START,
  QUIET_END,
} from '../../src/compliance/quiet-hours'

describe('quiet hours enforcement', () => {
  // Helper: create a Date that's a specific hour in a given timezone
  function dateAtHour(hour: number, timezone: string): Date {
    // Work backwards from the desired local hour to find UTC time
    // We iterate to find a UTC time that maps to the target local hour
    const base = new Date('2026-02-26T00:00:00Z')
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const candidate = new Date(base)
      candidate.setUTCHours(utcHour)
      const localHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false,
        }).format(candidate),
        10
      )
      if (localHour === hour) {
        return candidate
      }
    }
    throw new Error(`Could not find UTC time for hour ${hour} in ${timezone}`)
  }

  describe('isQuietHours', () => {
    it('9pm is quiet hours', () => {
      const ninepm = dateAtHour(21, 'America/Denver')
      expect(isQuietHours('America/Denver', ninepm)).toBe(true)
    })

    it('10pm is quiet hours', () => {
      const tenpm = dateAtHour(22, 'America/Denver')
      expect(isQuietHours('America/Denver', tenpm)).toBe(true)
    })

    it('midnight is quiet hours', () => {
      const midnight = dateAtHour(0, 'America/Denver')
      expect(isQuietHours('America/Denver', midnight)).toBe(true)
    })

    it('3am is quiet hours', () => {
      const threeam = dateAtHour(3, 'America/Denver')
      expect(isQuietHours('America/Denver', threeam)).toBe(true)
    })

    it('7:59am is quiet hours', () => {
      const earlyMorning = dateAtHour(7, 'America/Denver')
      expect(isQuietHours('America/Denver', earlyMorning)).toBe(true)
    })

    it('8am is NOT quiet hours', () => {
      const eightam = dateAtHour(8, 'America/Denver')
      expect(isQuietHours('America/Denver', eightam)).toBe(false)
    })

    it('noon is NOT quiet hours', () => {
      const noon = dateAtHour(12, 'America/Denver')
      expect(isQuietHours('America/Denver', noon)).toBe(false)
    })

    it('8:59pm is NOT quiet hours', () => {
      const eightpm = dateAtHour(20, 'America/Denver')
      expect(isQuietHours('America/Denver', eightpm)).toBe(false)
    })
  })

  describe('multi-timezone enforcement', () => {
    // When it's 9pm in New York, it's only 7pm in Denver.
    // A message should be blocked for NYC but allowed for Denver.

    it('respects the contact timezone, not the server timezone', () => {
      // 9pm Eastern = 7pm Mountain
      const ninepmEastern = dateAtHour(21, 'America/New_York')

      expect(isQuietHours('America/New_York', ninepmEastern)).toBe(true)
      // Same absolute time, different local time
      expect(isQuietHours('America/Denver', ninepmEastern)).toBe(false)
    })

    it('8am Pacific is allowed while same moment is 6am Hawaii (blocked)', () => {
      // 8am PST (UTC-8) = 16:00 UTC = 6am HST (UTC-10)
      const eightamPacific = dateAtHour(8, 'America/Los_Angeles')
      expect(isQuietHours('America/Los_Angeles', eightamPacific)).toBe(false)
      // Same absolute time is 6am in Hawaii — still quiet hours
      expect(isQuietHours('Pacific/Honolulu', eightamPacific)).toBe(true)
    })
  })

  describe('boundary conditions', () => {
    it('QUIET_START is 9pm', () => {
      expect(QUIET_START).toBe(21)
    })

    it('QUIET_END is 8am', () => {
      expect(QUIET_END).toBe(8)
    })

    it('defaults to America/Denver when no timezone provided', () => {
      const noon = dateAtHour(12, 'America/Denver')
      // Without timezone arg, should use Denver default
      expect(isQuietHours(undefined, noon)).toBe(false)
    })
  })

  describe('getNextQuietHoursEnd', () => {
    it('returns a future date', () => {
      const now = dateAtHour(22, 'America/Denver')
      const end = getNextQuietHoursEnd('America/Denver', now)
      expect(end.getTime()).toBeGreaterThan(now.getTime())
    })

    it('returns a date within 12 hours', () => {
      const now = dateAtHour(22, 'America/Denver')
      const end = getNextQuietHoursEnd('America/Denver', now)
      const hoursUntil = (end.getTime() - now.getTime()) / (1000 * 60 * 60)
      expect(hoursUntil).toBeLessThanOrEqual(12)
      expect(hoursUntil).toBeGreaterThan(0)
    })
  })
})
