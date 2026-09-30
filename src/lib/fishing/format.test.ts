import { describe, expect, it } from 'vitest'
import {
  UNIT_SPACE as S,
  berlinLocalToIso,
  catchesPerHour,
  elapsedMinutes,
  formatAccuracy,
  formatCatchesPerHour,
  formatCoordinates,
  formatDate,
  formatDateTime,
  formatDuration,
  formatEndLabel,
  formatEndTime,
  formatLength,
  formatNumber,
  formatShortDate,
  formatShortDateTime,
  formatTime,
  formatWeight,
  isLongRunning,
  isSameBerlinDay,
  isoToBerlinLocal,
  toBerlinIso,
} from './format'

const minutesLater = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000)

describe('UNIT_SPACE', () => {
  it('is the narrow no-break space the design system prescribes before units', () => {
    expect(S).toBe(' ')
  })
})

describe('dates and times in Europe/Berlin (EC-8)', () => {
  it('formats a summer instant in Berlin time, whatever offset it arrives with', () => {
    expect(formatDate('2026-09-12T12:05:00Z')).toBe('12.09.2026')
    expect(formatTime('2026-09-12T12:05:00Z')).toBe('14:05')
    expect(formatTime(new Date('2026-09-12T14:05:00+02:00'))).toBe('14:05')
    expect(formatShortDate('2026-09-12T12:05:00Z')).toBe('12.09.')
    expect(formatDateTime('2026-09-12T12:05:00Z')).toBe('12.09.2026, 14:05')
    expect(formatShortDateTime('2026-09-12T12:05:00Z')).toBe('12.09., 14:05')
  })

  it('uses winter time (+01:00) in January', () => {
    expect(formatTime('2026-01-05T13:05:00Z')).toBe('14:05')
  })

  it('puts a start shortly after Berlin midnight on the Berlin date, not the UTC date', () => {
    expect(formatDate('2026-09-12T22:30:00Z')).toBe('13.09.2026')
    expect(formatTime('2026-09-12T22:30:00Z')).toBe('00:30')
    expect(formatDate('2026-12-31T23:30:00Z')).toBe('01.01.2027')
  })

  it('shows 00:xx, never 24:xx, around midnight', () => {
    expect(formatTime('2026-09-12T22:00:00Z')).toBe('00:00')
  })

  it('shows local time on both DST switch days', () => {
    expect(formatTime('2026-03-29T00:59:00Z')).toBe('01:59') // last minute of CET
    expect(formatTime('2026-03-29T01:00:00Z')).toBe('03:00') // first minute of CEST
    expect(formatTime('2026-10-25T00:30:00Z')).toBe('02:30') // first 02:30 (CEST)
    expect(formatTime('2026-10-25T01:30:00Z')).toBe('02:30') // second 02:30 (CET)
  })

  it('rejects an invalid instant instead of printing „NaN"', () => {
    expect(() => formatDate('kein Datum')).toThrow(RangeError)
    expect(() => formatDuration('kein Datum', '2026-09-12T14:05:00Z')).toThrow(RangeError)
    expect(() => catchesPerHour(1, '2026-09-12T14:05:00Z', null, new Date('kein Datum'))).toThrow(RangeError)
  })
})

describe('end label (design.md → Detailansicht, Zeiten)', () => {
  it('shows only the time when the end is on the start day', () => {
    expect(formatEndTime('2026-09-12T16:00:00+02:00', '2026-09-12T20:00:00+02:00')).toBe('20:00')
    expect(formatEndLabel('2026-09-12T16:00:00+02:00', '2026-09-12T20:00:00+02:00')).toBe('bis 20:00')
  })

  it('adds the date when the session goes over Berlin midnight', () => {
    expect(formatEndLabel('2026-09-12T20:00:00+02:00', '2026-09-13T02:10:00+02:00')).toBe('bis 13.09., 02:10')
  })

  it('compares Berlin days, not UTC days', () => {
    // 23:30 and 00:30 Berlin are the same UTC day (21:30Z / 22:30Z) but different Berlin days.
    expect(isSameBerlinDay('2026-09-12T21:30:00Z', '2026-09-12T22:30:00Z')).toBe(false)
    // 00:30 and 01:30 Berlin are different UTC days (22:30Z / 23:30Z) but the same Berlin day.
    expect(isSameBerlinDay('2026-09-12T22:30:00Z', '2026-09-12T23:30:00Z')).toBe(true)
    expect(formatEndTime('2026-09-12T22:30:00Z', '2026-09-12T23:30:00Z')).toBe('01:30')
  })
})

describe('formatDuration (AC-1, AC-10, EC-8)', () => {
  it('formats elapsed time as h:mm h', () => {
    expect(formatDuration('2026-09-12T14:05:00+02:00', '2026-09-12T15:47:00+02:00')).toBe(`1:42${S}h`)
    expect(formatDuration('2026-09-12T14:05:00+02:00', '2026-09-12T14:10:00+02:00')).toBe(`0:05${S}h`)
    expect(formatDuration('2026-09-12T14:05:00+02:00', '2026-09-13T16:10:00+02:00')).toBe(`26:05${S}h`)
  })

  it('counts over midnight', () => {
    expect(formatDuration('2026-09-12T23:50:00+02:00', '2026-09-13T02:10:00+02:00')).toBe(`2:20${S}h`)
  })

  it('counts real elapsed time across the March switch (clock jumps 02:00 → 03:00)', () => {
    // 01:30 → 03:30 on the wall clock is one real hour.
    expect(formatDuration('2026-03-29T01:30:00+01:00', '2026-03-29T03:30:00+02:00')).toBe(`1:00${S}h`)
  })

  it('counts real elapsed time across the October switch (clock goes back 03:00 → 02:00)', () => {
    // 01:30 → 02:30 (second occurrence) on the wall clock is two real hours.
    expect(formatDuration('2026-10-25T01:30:00+02:00', '2026-10-25T02:30:00+01:00')).toBe(`2:00${S}h`)
  })

  it('drops seconds (minute precision) and never goes negative', () => {
    expect(formatDuration('2026-09-12T14:05:00Z', '2026-09-12T14:06:59Z')).toBe(`0:01${S}h`)
    expect(formatDuration('2026-09-12T14:05:00Z', '2026-09-12T14:05:59Z')).toBe(`0:00${S}h`)
    expect(elapsedMinutes('2026-09-12T14:05:00Z', '2026-09-12T14:00:00Z')).toBe(0)
  })

  it('works for a running session measured to now', () => {
    const now = new Date('2026-09-12T15:47:30+02:00')
    expect(formatDuration('2026-09-12T14:05:00+02:00', now)).toBe(`1:42${S}h`)
  })
})

describe('catches per hour (AC-30, AC-31, EC-8)', () => {
  const now = new Date('2026-09-13T12:00:00Z')

  it('divides the count by the duration in hours, one decimal, German format', () => {
    // 3 catches in 1:45 h = 1.714…
    expect(formatCatchesPerHour(3, '2026-09-12T14:00:00+02:00', '2026-09-12T15:45:00+02:00', now)).toBe('1,7')
  })

  it('shows 0,0 for a session without catches (AC-31)', () => {
    expect(formatCatchesPerHour(0, '2026-09-12T14:00:00+02:00', '2026-09-12T18:00:00+02:00', now)).toBe('0,0')
    expect(formatCatchesPerHour(0, minutesLater(now.toISOString(), -0.2), null, now)).toBe('0,0')
  })

  it('measures a running session to now', () => {
    const start = minutesLater(now.toISOString(), -120)
    expect(catchesPerHour(3, start, null, now)).toBe(1.5)
    expect(formatCatchesPerHour(3, start, null, now)).toBe('1,5')
  })

  it('counts a running session under 1 minute as 1 minute', () => {
    const start = minutesLater(now.toISOString(), -0.5) // 30 s ago
    expect(catchesPerHour(1, start, null, now)).toBe(60)
    expect(formatCatchesPerHour(1, start, null, now)).toBe('60,0')
  })

  it('counts a start slightly after now (tolerated phone clock skew) as 1 minute', () => {
    const start = minutesLater(now.toISOString(), 1)
    expect(catchesPerHour(1, start, null, now)).toBe(60)
  })

  it('does not floor a duration of exactly 1 minute or more', () => {
    const start = minutesLater(now.toISOString(), -2)
    expect(catchesPerHour(1, start, null, now)).toBe(30)
  })

  it('rounds half up to one decimal', () => {
    // 3 catches in 4 h = 0.75
    expect(formatCatchesPerHour(3, '2026-09-12T14:00:00+02:00', '2026-09-12T18:00:00+02:00', now)).toBe('0,8')
    // 1 catch in 40 min = 1.5
    expect(formatCatchesPerHour(1, '2026-09-12T14:00:00+02:00', '2026-09-12T14:40:00+02:00', now)).toBe('1,5')
  })

  it('uses real elapsed time across the October switch', () => {
    // wall clock 01:30 → 02:30 (second) = 2 real hours, 4 catches → 2,0 (not 4,0)
    expect(formatCatchesPerHour(4, '2026-10-25T01:30:00+02:00', '2026-10-25T02:30:00+01:00', now)).toBe('2,0')
  })

  it('ignores now for an ended session', () => {
    expect(catchesPerHour(2, '2026-09-12T14:00:00+02:00', '2026-09-12T15:00:00+02:00', now)).toBe(2)
  })
})

describe('isLongRunning (AC-11)', () => {
  const now = new Date('2026-09-13T02:05:00+02:00')

  it('is true for a running session started exactly 12 hours ago', () => {
    expect(isLongRunning('2026-09-12T14:05:00+02:00', null, now)).toBe(true)
  })

  it('is false one minute before the 12 hours are reached', () => {
    expect(isLongRunning('2026-09-12T14:06:00+02:00', null, now)).toBe(false)
  })

  it('is false for an ended session, however long it was', () => {
    expect(isLongRunning('2026-09-11T14:05:00+02:00', '2026-09-13T01:00:00+02:00', now)).toBe(false)
  })

  it('counts real hours across the March switch', () => {
    // 20:00 CET → 09:00 CEST on the wall is 13 wall hours but only 12 real hours.
    expect(isLongRunning('2026-03-28T20:00:00+01:00', null, new Date('2026-03-29T09:00:00+02:00'))).toBe(true)
    expect(isLongRunning('2026-03-28T20:00:00+01:00', null, new Date('2026-03-29T08:59:00+02:00'))).toBe(false)
  })
})

describe('numbers and units (design-system → Typografie)', () => {
  it('formats numbers the German way', () => {
    expect(formatNumber(1250)).toBe('1.250')
    expect(formatNumber(150000)).toBe('150.000')
    expect(formatNumber(1.7, 1)).toBe('1,7')
    expect(formatNumber(2, 1)).toBe('2,0')
    expect(formatNumber(31)).toBe('31')
  })

  it('never shows „-0,0"', () => {
    expect(formatNumber(-0.01, 1)).toBe('0,0')
    expect(formatNumber(-1.25, 1)).toBe('-1,3')
  })

  it('formats length and weight with a narrow space before the unit', () => {
    expect(formatLength(31)).toBe(`31${S}cm`)
    expect(formatWeight(1250)).toBe(`1.250${S}g`)
    expect(formatWeight(850)).toBe(`850${S}g`)
  })
})

describe('formatAccuracy (AC-29, EC-7)', () => {
  it('shows meters below 1.000 m', () => {
    expect(formatAccuracy(12)).toBe(`±${S}12${S}m`)
    expect(formatAccuracy(800)).toBe(`±${S}800${S}m`)
    expect(formatAccuracy(999)).toBe(`±${S}999${S}m`)
    expect(formatAccuracy(0)).toBe(`±${S}0${S}m`)
  })

  it('rounds to whole meters', () => {
    expect(formatAccuracy(12.4)).toBe(`±${S}12${S}m`)
    expect(formatAccuracy(12.5)).toBe(`±${S}13${S}m`)
  })

  it('switches to km with one decimal from 1.000 m on', () => {
    expect(formatAccuracy(1000)).toBe(`±${S}1,0${S}km`)
    expect(formatAccuracy(1234)).toBe(`±${S}1,2${S}km`)
    expect(formatAccuracy(100000)).toBe(`±${S}100,0${S}km`)
  })

  it('does not show „± 1.000 m" for a value that rounds up to 1.000', () => {
    expect(formatAccuracy(999.6)).toBe(`±${S}1,0${S}km`)
  })
})

describe('formatCoordinates (AC-29)', () => {
  it('shows 5 decimals and N / O for positive values', () => {
    expect(formatCoordinates(54.085123, 13.387414)).toBe(`54,08512°${S}N · 13,38741°${S}O`)
  })

  it('shows S / W for negative values, without a minus sign', () => {
    expect(formatCoordinates(-33.86882, -151.20929)).toBe(`33,86882°${S}S · 151,20929°${S}W`)
  })

  it('rounds to 5 decimals and pads with zeros', () => {
    expect(formatCoordinates(54.085126, 13.4)).toBe(`54,08513°${S}N · 13,40000°${S}O`)
  })

  it('does not group digits in longitudes over 100', () => {
    expect(formatCoordinates(0, 179.99999)).toBe(`0,00000°${S}N · 179,99999°${S}O`)
  })

  it('gives a value that rounds to zero the positive hemisphere', () => {
    expect(formatCoordinates(-0.000001, -0.000004)).toBe(`0,00000°${S}N · 0,00000°${S}O`)
  })
})

describe('berlinLocalToIso (form → instant)', () => {
  it('uses +02:00 in summer and +01:00 in winter', () => {
    expect(berlinLocalToIso('2026-09-12', '14:05')).toBe('2026-09-12T14:05:00+02:00')
    expect(berlinLocalToIso('2026-01-05', '14:05')).toBe('2026-01-05T14:05:00+01:00')
    expect(new Date(berlinLocalToIso('2026-09-12', '14:05')!).toISOString()).toBe('2026-09-12T12:05:00.000Z')
  })

  it('handles midnight and the minute before it', () => {
    expect(berlinLocalToIso('2026-09-13', '00:00')).toBe('2026-09-13T00:00:00+02:00')
    expect(berlinLocalToIso('2026-09-12', '23:59')).toBe('2026-09-12T23:59:00+02:00')
  })

  it('gets the offsets right on the March switch day', () => {
    expect(berlinLocalToIso('2026-03-29', '01:59')).toBe('2026-03-29T01:59:00+01:00')
    expect(berlinLocalToIso('2026-03-29', '03:00')).toBe('2026-03-29T03:00:00+02:00')
    expect(berlinLocalToIso('2026-03-29', '00:30')).toBe('2026-03-29T00:30:00+01:00')
    expect(berlinLocalToIso('2026-03-29', '23:00')).toBe('2026-03-29T23:00:00+02:00')
  })

  it('moves a time that does not exist (March, 02:xx) forward by the skipped hour', () => {
    expect(berlinLocalToIso('2026-03-29', '02:30')).toBe('2026-03-29T03:30:00+02:00')
    expect(berlinLocalToIso('2026-03-29', '02:00')).toBe('2026-03-29T03:00:00+02:00')
  })

  it('takes the first of two identical times (October, 02:xx) and the right offset around it', () => {
    expect(berlinLocalToIso('2026-10-25', '02:30')).toBe('2026-10-25T02:30:00+02:00')
    expect(berlinLocalToIso('2026-10-25', '01:59')).toBe('2026-10-25T01:59:00+02:00')
    expect(berlinLocalToIso('2026-10-25', '03:00')).toBe('2026-10-25T03:00:00+01:00')
    expect(berlinLocalToIso('2026-10-25', '23:00')).toBe('2026-10-25T23:00:00+01:00')
  })

  it('returns null for malformed or impossible input', () => {
    expect(berlinLocalToIso('2026-02-30', '14:05')).toBeNull()
    expect(berlinLocalToIso('2026-13-01', '14:05')).toBeNull()
    expect(berlinLocalToIso('2026-09-12', '24:00')).toBeNull()
    expect(berlinLocalToIso('2026-09-12', '14:60')).toBeNull()
    expect(berlinLocalToIso('2026-09-12', '14:5')).toBeNull()
    expect(berlinLocalToIso('12.09.2026', '14:05')).toBeNull()
    expect(berlinLocalToIso('', '')).toBeNull()
  })

  it('accepts 29 February in a leap year only', () => {
    expect(berlinLocalToIso('2028-02-29', '10:00')).toBe('2028-02-29T10:00:00+01:00')
    expect(berlinLocalToIso('2026-02-29', '10:00')).toBeNull()
  })
})

describe('isoToBerlinLocal (instant → form values)', () => {
  it('returns the Berlin date and time for the inputs', () => {
    expect(isoToBerlinLocal('2026-09-12T12:05:00Z')).toEqual({ date: '2026-09-12', time: '14:05' })
    expect(isoToBerlinLocal(new Date('2026-09-12T22:30:00Z'))).toEqual({ date: '2026-09-13', time: '00:30' })
  })

  it('shows both October 02:30s as 02:30', () => {
    expect(isoToBerlinLocal('2026-10-25T00:30:00Z')).toEqual({ date: '2026-10-25', time: '02:30' })
    expect(isoToBerlinLocal('2026-10-25T01:30:00Z')).toEqual({ date: '2026-10-25', time: '02:30' })
  })

  it('round-trips with berlinLocalToIso on ordinary and switch days', () => {
    for (const [date, time] of [
      ['2026-09-12', '14:05'],
      ['2026-01-05', '00:00'],
      ['2026-03-29', '03:00'],
      ['2026-10-25', '02:30'],
      ['2026-10-25', '03:00'],
    ]) {
      expect(isoToBerlinLocal(berlinLocalToIso(date, time)!)).toEqual({ date, time })
    }
  })
})

describe('toBerlinIso', () => {
  it('writes an instant with Berlin offset, keeping seconds', () => {
    expect(toBerlinIso('2026-09-12T12:05:30Z')).toBe('2026-09-12T14:05:30+02:00')
    expect(toBerlinIso(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25T02:30:00+01:00')
    expect(toBerlinIso(Date.UTC(2026, 0, 5, 13, 5))).toBe('2026-01-05T14:05:00+01:00')
  })
})
