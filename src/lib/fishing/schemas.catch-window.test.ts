import { describe, expect, it } from 'vitest'
import { checkCatchTime, firstCatchOutside, sessionTimeErrors, truncateToMinute } from './schemas'

// Written by /qa (PROJ-2, re-verification after BUG-1): the catch window of a running session and the
// end-time rules must fit together — every catch the app accepts in a running session leaves at least
// one end time that the end-time rules accept (AC-24, EC-6).

const MIN = 60_000
const HOUR = 60 * MIN
const at = (iso: string) => new Date(iso)
const fmt = (d: Date) => d.toISOString()

const start = at('2026-09-10T12:05:00Z')
const running = { startedAt: start, endedAt: null }
const mark = new Date(start.getTime() + 48 * HOUR) // start + 48 h

describe('catch window of a running session vs. the 48-hour limit (AC-24, EC-6)', () => {
  it('every accepted catch time leaves a valid end — also long after the 48-hour mark', () => {
    const nows = [1 * HOUR, 47 * HOUR + 59 * MIN, 48 * HOUR, 48 * HOUR + 1 * MIN, 72 * HOUR, 200 * HOUR].map(
      (offset) => new Date(start.getTime() + offset + 30_000), // 30 s into the minute, like a real clock
    )
    let accepted = 0
    for (const now of nows) {
      // every minute from the start to 3 minutes after „now", plus the minutes around the 48-hour mark
      const last = Math.min(now.getTime() + 3 * MIN, start.getTime() + 60 * HOUR)
      for (let t = start.getTime(); t <= last; t += t < mark.getTime() - 5 * MIN ? 37 * MIN : MIN) {
        const caughtAt = new Date(t)
        if (!checkCatchTime(caughtAt, running, now).ok) continue
        accepted++
        expect(caughtAt.getTime()).toBeLessThanOrEqual(mark.getTime())
        // „Zeit des letzten Fangs" (or start + 1 min for a catch at the very start) is a valid end …
        const end = new Date(Math.max(t, start.getTime() + MIN))
        expect(sessionTimeErrors({ startedAt: start, endedAt: end, now }, fmt)).toEqual({})
        // … and it keeps the catch inside the ended session.
        expect(firstCatchOutside([{ caughtAt }], { startedAt: start, endedAt: end }, now)).toBeNull()
      }
    }
    expect(accepted).toBeGreaterThan(100)
  })

  it('near the mark, „now + 2 minutes" never reaches past start + 48 h', () => {
    const now = new Date(mark.getTime() - 1 * MIN + 30_000) // 47:59:30 after the start
    expect(checkCatchTime(mark, running, now)).toEqual({ ok: true })
    expect(checkCatchTime(new Date(mark.getTime() + 1 * MIN), running, now)).toEqual({
      ok: false,
      from: start,
      to: truncateToMinute(now),
      running: true,
    })
  })

  it('after the mark, the refusal names the window up to start + 48 h, never „now"', () => {
    const now = new Date(start.getTime() + 70 * HOUR)
    const refused = checkCatchTime(now, running, now)
    expect(refused).toEqual({ ok: false, from: start, to: mark, running: true })
  })

  it('an ended session keeps its own end as the limit (the 48-hour cap is for running sessions)', () => {
    const ended = { startedAt: start, endedAt: mark }
    const now = new Date(start.getTime() + 100 * HOUR)
    expect(checkCatchTime(mark, ended, now)).toEqual({ ok: true })
    expect(checkCatchTime(new Date(mark.getTime() + MIN), ended, now)).toEqual({
      ok: false,
      from: start,
      to: mark,
      running: false,
    })
  })

  it('moving the start of a running session back past 48 h is refused while a recent catch exists', () => {
    const now = new Date(start.getTime() + 50 * HOUR)
    const catches = [{ caughtAt: new Date(now.getTime() - 10 * MIN) }]
    // the recent catch lies after the new start + 48 h
    expect(firstCatchOutside(catches, { startedAt: start, endedAt: null }, now)).toBe(catches[0])
    // with a start 2 h before the catch, it fits
    const laterStart = new Date(now.getTime() - 2 * HOUR)
    expect(firstCatchOutside(catches, { startedAt: laterStart, endedAt: null }, now)).toBeNull()
  })
})
