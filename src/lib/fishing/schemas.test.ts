import { describe, expect, it } from 'vitest'
import {
  backfillSessionSchema,
  checkCatchTime,
  createCatchSchema,
  editCatchSchema,
  editSessionSchema,
  endSessionSchema,
  fieldErrors,
  firstCatchOutside,
  isInFuture,
  parseInput,
  sessionTimeErrors,
  startSessionSchema,
  timeSchema,
  toPosition,
  truncateToMinute,
} from './schemas'
import {
  catchOutsideSession,
  catchTimeRange,
  deleteSessionDescription,
  MESSAGES,
  NOTICES,
  noticeFor,
  overlapsRunningSession,
  overlapsSession,
  sessionEndedMeanwhile,
  sessionEndedNotice,
  sessionTooLong,
} from './messages'
import { catchSpeciesName, isSpeciesId, SPECIES, SPECIES_IDS, speciesLabel } from './species'
import { mapDbError } from './db-errors'

const ID = '0b7e5d5c-2f0e-4c3a-9d7a-3b1f2a4c5d6e'
const ID2 = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const MIN = 60_000
const HOUR = 60 * MIN
const at = (iso: string) => new Date(iso)
const fmt = (d: Date) => d.toISOString().slice(0, 16) // stand-in for format.ts

function errorsOf(schema: { safeParse: (v: unknown) => unknown }, input: unknown) {
  const r = parseInput(schema as never, input)
  return r.ok ? {} : r.fieldErrors
}

const validCatch = {
  id: ID,
  sessionId: ID2,
  caughtAt: '2026-09-12T17:20:00+02:00',
  species: 'pike',
  lengthCm: 72,
  released: true,
}

describe('species (AC-21)', () => {
  it('has the 17 ids in picker order with German labels', () => {
    expect(SPECIES_IDS).toEqual([
      'perch', 'pike', 'zander', 'eel', 'carp', 'tench', 'bream', 'roach', 'wels_catfish',
      'brown_trout', 'rainbow_trout', 'sea_trout', 'cod', 'herring', 'garfish', 'flatfish', 'other',
    ])
    expect(SPECIES.map((s) => s.label)).toEqual([
      'Barsch', 'Hecht', 'Zander', 'Aal', 'Karpfen', 'Schleie', 'Brasse', 'Rotauge', 'Wels',
      'Bachforelle', 'Regenbogenforelle', 'Meerforelle', 'Dorsch', 'Hering', 'Hornhecht', 'Plattfisch', 'Sonstige',
    ])
  })

  it('looks labels up safely', () => {
    expect(speciesLabel('wels_catfish')).toBe('Wels')
    expect(speciesLabel('shark')).toBeNull()
    expect(speciesLabel('toString')).toBeNull()
    expect(isSpeciesId('constructor')).toBe(false)
  })

  it('names a catch by label, or by the typed name for „Sonstige"', () => {
    expect(catchSpeciesName({ species: 'pike', species_other: null })).toBe('Hecht')
    expect(catchSpeciesName({ species: 'other', species_other: 'Quappe' })).toBe('Quappe')
    expect(catchSpeciesName({ species: 'other', species_other: null })).toBe('Sonstige')
  })
})

describe('text rules (AC-7, AC-22)', () => {
  it('trims and turns empty optional texts into undefined', () => {
    const r = startSessionSchema.parse({ id: ID, waterName: '  Peenestrom ', note: '   ', position: null })
    expect(r.waterName).toBe('Peenestrom')
    expect(r.note).toBeUndefined()
  })

  it('accepts 80 / 500 characters and rejects 81 / 501', () => {
    expect(errorsOf(startSessionSchema, { id: ID, waterName: 'a'.repeat(80), note: 'b'.repeat(500) })).toEqual({})
    expect(errorsOf(startSessionSchema, { id: ID, waterName: 'a'.repeat(81), note: 'b'.repeat(501) })).toEqual({
      waterName: 'Höchstens 80 Zeichen.',
      note: 'Höchstens 500 Zeichen.',
    })
  })

  it('counts length after trimming', () => {
    expect(errorsOf(startSessionSchema, { id: ID, waterName: `  ${'a'.repeat(80)}  ` })).toEqual({})
  })

  it('accepts 60 bait characters and rejects 61', () => {
    expect(errorsOf(createCatchSchema, { ...validCatch, bait: 'x'.repeat(60) })).toEqual({})
    expect(errorsOf(createCatchSchema, { ...validCatch, bait: 'x'.repeat(61) })).toEqual({ bait: 'Höchstens 60 Zeichen.' })
  })
})

describe('ids and malformed requests', () => {
  it('rejects a non-UUID id with the general message under form', () => {
    expect(errorsOf(startSessionSchema, { id: 'abc' })).toEqual({ form: 'Bitte prüfe deine Eingaben.' })
  })

  it('turns a non-object payload into the general message, never English Zod text', () => {
    for (const raw of [null, 'x', 42, [], undefined]) {
      expect(errorsOf(createCatchSchema, raw)).toEqual({ form: 'Bitte prüfe deine Eingaben.' })
    }
  })

  it('turns wrong field types into German messages', () => {
    const errors = errorsOf(createCatchSchema, { ...validCatch, waterName: 1, bait: 5, released: 'ja', species: 7 })
    expect(errors).toEqual({
      form: 'Bitte prüfe deine Eingaben.',
      released: MESSAGES.releasedRequired,
      species: 'Bitte wähle eine Fischart.',
    })
    for (const text of Object.values(errors)) expect(text).not.toMatch(/Invalid|expected/i)
  })
})

describe('timestamps', () => {
  it('parses an ISO time with offset and truncates it to the minute', () => {
    expect(timeSchema.parse('2026-09-12T16:05:59.999+02:00').toISOString()).toBe('2026-09-12T14:05:00.000Z')
    expect(timeSchema.parse('2026-09-12T14:05:30Z').toISOString()).toBe('2026-09-12T14:05:00.000Z')
    expect(timeSchema.parse(at('2026-09-12T14:05:30Z')).toISOString()).toBe('2026-09-12T14:05:00.000Z')
  })

  it('rejects a time without offset or garbage as malformed', () => {
    expect(timeSchema.safeParse('2026-09-12T16:05').error?.issues[0].message).toBe(MESSAGES.invalidInput)
    expect(timeSchema.safeParse('gestern').error?.issues[0].message).toBe(MESSAGES.invalidInput)
  })

  it('asks for a missing time', () => {
    expect(timeSchema.safeParse('').error?.issues[0].message).toBe('Bitte gib Datum und Uhrzeit ein.')
    expect(errorsOf(createCatchSchema, { ...validCatch, caughtAt: undefined })).toEqual({
      caughtAt: 'Bitte gib die Uhrzeit ein.',
    })
  })
})

describe('position (lenient, AC-8, AC-25)', () => {
  it('keeps a valid position and rounds / caps the accuracy', () => {
    expect(toPosition({ latitude: 54.08512, longitude: 13.38741, accuracy: 12.4 })).toEqual({
      latitude: 54.08512,
      longitude: 13.38741,
      accuracy: 12,
    })
    expect(toPosition({ latitude: 0, longitude: 0, accuracy: 0 })?.accuracy).toBe(0)
    expect(toPosition({ latitude: 90, longitude: -180, accuracy: 250_000 })?.accuracy).toBe(100_000)
    expect(toPosition({ latitude: '54.1', longitude: '13.4', accuracy: '8' })).toEqual({
      latitude: 54.1,
      longitude: 13.4,
      accuracy: 8,
    })
  })

  it('turns anything invalid or partial into null, never an error', () => {
    const bad = [
      undefined, null, 'x', [], {},
      { latitude: 54, longitude: 13 },
      { latitude: 91, longitude: 13, accuracy: 5 },
      { latitude: 54, longitude: -181, accuracy: 5 },
      { latitude: 54, longitude: 13, accuracy: -1 },
      { latitude: NaN, longitude: 13, accuracy: 5 },
      { latitude: 54, longitude: Infinity, accuracy: 5 },
      { latitude: '', longitude: 13, accuracy: 5 },
    ]
    for (const position of bad) {
      const r = startSessionSchema.safeParse({ id: ID, position })
      expect(r.success).toBe(true)
      expect(r.data?.position).toBeNull()
    }
  })
})

describe('backfillSessionSchema (AC-13, AC-14)', () => {
  const base = {
    id: ID,
    startedAt: '2026-09-12T16:00:00+02:00',
    endedAt: '2026-09-12T20:00:00+02:00',
    position: { latitude: 54, longitude: 13, accuracy: 5 },
  }

  it('drops the position without the switch', () => {
    expect(backfillSessionSchema.parse(base).position).toBeNull()
    expect(backfillSessionSchema.parse({ ...base, useCurrentPosition: false }).position).toBeNull()
  })

  it('keeps the position with the switch', () => {
    expect(backfillSessionSchema.parse({ ...base, useCurrentPosition: true }).position).toEqual(base.position)
  })

  it('requires both times', () => {
    expect(errorsOf(backfillSessionSchema, { id: ID })).toEqual({
      startedAt: MESSAGES.timeRequired,
      endedAt: MESSAGES.timeRequired,
    })
  })
})

describe('editSessionSchema (AC-17)', () => {
  it('allows a missing end (running session) and never carries a position', () => {
    const r = editSessionSchema.parse({ id: ID, startedAt: '2026-09-12T16:00:00+02:00', position: { latitude: 1 } })
    expect(r.endedAt).toBeUndefined()
    expect('position' in r).toBe(false)
  })
})

describe('endSessionSchema (AC-10, AC-12)', () => {
  it('accepts „now" and „last-catch" and drops a stray time', () => {
    expect(endSessionSchema.parse({ id: ID, mode: 'now', endedAt: '2026-09-12T18:40:00Z' }).endedAt).toBeUndefined()
    expect(endSessionSchema.parse({ id: ID, mode: 'last-catch' }).mode).toBe('last-catch')
  })

  it('requires a time for „custom"', () => {
    expect(errorsOf(endSessionSchema, { id: ID, mode: 'custom' })).toEqual({ endedAt: MESSAGES.timeRequired })
    expect(endSessionSchema.parse({ id: ID, mode: 'custom', endedAt: '2026-09-12T18:40:10Z' }).endedAt?.toISOString()).toBe(
      '2026-09-12T18:40:00.000Z',
    )
  })

  it('rejects an unknown mode as malformed', () => {
    expect(errorsOf(endSessionSchema, { id: ID, mode: 'later' })).toEqual({ form: MESSAGES.invalidInput })
  })
})

describe('catch schemas (AC-21, AC-22, AC-27)', () => {
  it('accepts a valid catch and parses form strings', () => {
    const r = createCatchSchema.parse({ ...validCatch, lengthCm: ' 72 ', weightG: '3400', bait: '', position: undefined })
    expect(r).toMatchObject({ lengthCm: 72, weightG: 3400, bait: undefined, position: null, speciesOther: undefined })
  })

  it('length: 1 and 250 ok, 0 / 251 / decimals / empty rejected', () => {
    expect(errorsOf(createCatchSchema, { ...validCatch, lengthCm: 1 })).toEqual({})
    expect(errorsOf(createCatchSchema, { ...validCatch, lengthCm: '250' })).toEqual({})
    for (const lengthCm of [0, 251, 12.5, '12,5', '', undefined, 'abc', -3]) {
      expect(errorsOf(createCatchSchema, { ...validCatch, lengthCm })).toEqual({
        lengthCm: 'Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).',
      })
    }
  })

  it('weight: optional, 1 and 150000 ok, 0 / 150001 / decimals rejected', () => {
    expect(createCatchSchema.parse({ ...validCatch, weightG: '' }).weightG).toBeUndefined()
    expect(createCatchSchema.parse({ ...validCatch, weightG: null }).weightG).toBeUndefined()
    expect(errorsOf(createCatchSchema, { ...validCatch, weightG: 1 })).toEqual({})
    expect(errorsOf(createCatchSchema, { ...validCatch, weightG: 150_000 })).toEqual({})
    for (const weightG of [0, 150_001, 2.5, '150.000']) {
      expect(errorsOf(createCatchSchema, { ...validCatch, weightG })).toEqual({
        weightG: 'Bitte gib das Gewicht in ganzen Gramm ein (1 bis 150.000).',
      })
    }
  })

  it('species: required, one of the 17 ids', () => {
    expect(errorsOf(createCatchSchema, { ...validCatch, species: undefined })).toEqual({ species: MESSAGES.speciesRequired })
    expect(errorsOf(createCatchSchema, { ...validCatch, species: 'shark' })).toEqual({ species: MESSAGES.speciesRequired })
  })

  it('„Sonstige" needs a name (≤ 40), other species drop it', () => {
    expect(errorsOf(createCatchSchema, { ...validCatch, species: 'other' })).toEqual({
      speciesOther: 'Bitte gib die Fischart ein.',
    })
    expect(errorsOf(createCatchSchema, { ...validCatch, species: 'other', speciesOther: '   ' })).toEqual({
      speciesOther: 'Bitte gib die Fischart ein.',
    })
    expect(errorsOf(createCatchSchema, { ...validCatch, species: 'other', speciesOther: 'q'.repeat(41) })).toEqual({
      speciesOther: 'Höchstens 40 Zeichen.',
    })
    expect(createCatchSchema.parse({ ...validCatch, species: 'other', speciesOther: ` ${'q'.repeat(40)} ` }).speciesOther).toBe(
      'q'.repeat(40),
    )
    expect(createCatchSchema.parse({ ...validCatch, speciesOther: 'x'.repeat(99) }).speciesOther).toBeUndefined()
  })

  it('reports the missing name together with other field errors', () => {
    expect(errorsOf(createCatchSchema, { ...validCatch, species: 'other', lengthCm: 0 })).toEqual({
      speciesOther: MESSAGES.speciesOtherRequired,
      lengthCm: MESSAGES.lengthInvalid,
    })
  })

  it('released is required', () => {
    expect(errorsOf(createCatchSchema, { ...validCatch, released: undefined })).toEqual({ released: MESSAGES.releasedRequired })
    expect(createCatchSchema.parse({ ...validCatch, released: false }).released).toBe(false)
  })

  it('edit carries no position and applies the same rules', () => {
    const r = editCatchSchema.parse({ ...validCatch, position: { latitude: 1, longitude: 1, accuracy: 1 } })
    expect('position' in r).toBe(false)
    expect(errorsOf(editCatchSchema, { ...validCatch, lengthCm: 251 })).toEqual({ lengthCm: MESSAGES.lengthInvalid })
  })
})

describe('fieldErrors', () => {
  it('keeps the first message per field', () => {
    const r = createCatchSchema.safeParse({ ...validCatch, lengthCm: 0, weightG: 0 })
    expect(r.success).toBe(false)
    expect(fieldErrors(r.error!)).toEqual({ lengthCm: MESSAGES.lengthInvalid, weightG: MESSAGES.weightInvalid })
  })
})

describe('sessionTimeErrors (AC-12, AC-15, EC-9)', () => {
  const now = at('2026-09-14T12:00:00Z')
  const start = at('2026-09-12T06:00:00Z')

  it('accepts exactly 1 minute and exactly 48 hours', () => {
    expect(sessionTimeErrors({ startedAt: start, endedAt: new Date(start.getTime() + MIN), now }, fmt)).toEqual({})
    expect(sessionTimeErrors({ startedAt: start, endedAt: new Date(start.getTime() + 48 * HOUR), now }, fmt)).toEqual({})
  })

  it('rejects an end at or before the start', () => {
    expect(sessionTimeErrors({ startedAt: start, endedAt: start, now }, fmt)).toEqual({ endedAt: 'Das Ende muss nach dem Start liegen.' })
    expect(sessionTimeErrors({ startedAt: start, endedAt: new Date(start.getTime() - MIN), now }, fmt)).toEqual({
      endedAt: MESSAGES.endBeforeStart,
    })
  })

  it('rejects less than 1 minute', () => {
    expect(sessionTimeErrors({ startedAt: start, endedAt: new Date(start.getTime() + 59_000), now }, fmt)).toEqual({
      endedAt: MESSAGES.sessionTooShort,
    })
  })

  it('rejects more than 48 hours and names the latest end', () => {
    expect(sessionTimeErrors({ startedAt: start, endedAt: new Date(start.getTime() + 48 * HOUR + MIN), now }, fmt)).toEqual({
      endedAt: 'Eine Session dauert höchstens 48 Stunden (bis 2026-09-14T06:00).',
    })
  })

  it('tolerates 2 minutes into the future, not more', () => {
    const recent = at('2026-09-14T11:00:00Z')
    expect(sessionTimeErrors({ startedAt: recent, endedAt: new Date(now.getTime() + 2 * MIN), now }, fmt)).toEqual({})
    expect(sessionTimeErrors({ startedAt: recent, endedAt: new Date(now.getTime() + 3 * MIN), now }, fmt)).toEqual({
      endedAt: 'Dieser Zeitpunkt liegt in der Zukunft.',
    })
    expect(sessionTimeErrors({ startedAt: new Date(now.getTime() + 3 * MIN), endedAt: null, now }, fmt)).toEqual({
      startedAt: MESSAGES.timeInFuture,
    })
    expect(isInFuture(new Date(now.getTime() + 2 * MIN), now)).toBe(false)
    expect(isInFuture(new Date(now.getTime() + 2 * MIN + 1), now)).toBe(true)
  })

  it('checks only the start of a running session', () => {
    expect(sessionTimeErrors({ startedAt: start, endedAt: null, now }, fmt)).toEqual({})
  })
})

describe('checkCatchTime (AC-24, EC-4, EC-10)', () => {
  const now = at('2026-09-12T19:00:30Z')
  const ended = { startedAt: at('2026-09-12T14:05:00Z'), endedAt: at('2026-09-12T18:40:00Z') }
  const running = { startedAt: at('2026-09-12T14:05:00Z'), endedAt: null }

  it('allows exactly start and end', () => {
    expect(checkCatchTime(ended.startedAt, ended, now)).toEqual({ ok: true })
    expect(checkCatchTime(ended.endedAt, ended, now)).toEqual({ ok: true })
  })

  it('rejects a minute outside and returns the window', () => {
    expect(checkCatchTime(at('2026-09-12T14:04:00Z'), ended, now)).toEqual({
      ok: false,
      from: ended.startedAt,
      to: ended.endedAt,
      running: false,
    })
    expect(checkCatchTime(at('2026-09-12T18:41:00Z'), ended, now).ok).toBe(false)
  })

  it('a running session ends at now + 2 minutes; the window shows now', () => {
    expect(checkCatchTime(new Date(now.getTime() + 2 * MIN), running, now).ok).toBe(true)
    expect(checkCatchTime(new Date(now.getTime() + 2 * MIN + 1), running, now)).toEqual({
      ok: false,
      from: running.startedAt,
      to: at('2026-09-12T19:00:00Z'),
      running: true,
    })
  })

  it('a running session takes no catch later than 48 hours after its start (BUG-1, AC-24)', () => {
    const late = at('2026-09-15T10:00:00Z') // forgotten session, running for ~68 h
    const limit = at('2026-09-14T14:05:00Z') // start + 48 h
    expect(checkCatchTime(limit, running, late)).toEqual({ ok: true })
    expect(checkCatchTime(new Date(limit.getTime() + MIN), running, late)).toEqual({
      ok: false,
      from: running.startedAt,
      to: limit,
      running: true,
    })
  })

  it('finds the earliest catch left outside by new times (AC-18)', () => {
    const catches = [
      { caughtAt: at('2026-09-12T18:00:00Z'), species: 'pike' },
      { caughtAt: at('2026-09-12T15:00:00Z'), species: 'perch' },
      { caughtAt: at('2026-09-12T17:20:00Z'), species: 'eel' },
    ]
    const narrowed = { startedAt: at('2026-09-12T14:05:00Z'), endedAt: at('2026-09-12T17:00:00Z') }
    expect(firstCatchOutside(catches, narrowed, now)?.species).toBe('eel')
    expect(firstCatchOutside(catches, ended, now)).toBeNull()
  })

  it('truncateToMinute drops seconds', () => {
    expect(truncateToMinute(at('2026-09-12T14:05:59.999Z')).toISOString()).toBe('2026-09-12T14:05:00.000Z')
  })
})

describe('messages', () => {
  it('fills the messages with values', () => {
    expect(catchTimeRange('14:05', '18:40')).toBe('Die Fangzeit muss zwischen 14:05 und 18:40 liegen.')
    expect(overlapsSession('12.09.', '16:00', '20:00')).toBe('Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00.')
    expect(overlapsRunningSession('14:05')).toBe('Überschneidet sich mit deiner laufenden Session seit 14:05.')
    expect(sessionEndedMeanwhile('18:40')).toBe('Die Session wurde inzwischen beendet (Ende 18:40).')
    expect(catchOutsideSession('17:20', 'Hecht')).toBe('Der Fang um 17:20 (Hecht) läge außerhalb der Session.')
    expect(sessionTooLong('14.09., 06:00')).toBe('Eine Session dauert höchstens 48 Stunden (bis 14.09., 06:00).')
    expect(sessionEndedNotice('1:42 h')).toBe('Session beendet · 1:42 h')
    expect(deleteSessionDescription(3)).toBe('Die Session und ihre 3 Fänge werden endgültig gelöscht.')
    expect(deleteSessionDescription(0)).toBe('Die Session wird endgültig gelöscht.')
  })

  it('knows exactly the 8 notice codes with their tone', () => {
    expect(Object.keys(NOTICES).sort()).toEqual([
      'catch-deleted', 'catch-saved', 'session-deleted', 'session-ended',
      'session-gone', 'session-running', 'session-saved', 'session-started',
    ])
    expect(noticeFor('catch-saved')).toEqual({ code: 'catch-saved', tone: 'success', text: 'Fang gespeichert' })
    expect(noticeFor('session-running')).toMatchObject({ tone: 'info', text: 'Es läuft bereits eine Session.' })
    expect(noticeFor('session-gone')).toMatchObject({ tone: 'warning', text: 'Diese Session gibt es nicht mehr.' })
    expect(noticeFor('session-ended', { duration: '1:42 h' })?.text).toBe('Session beendet · 1:42 h')
  })

  it('ignores unknown, repeated and inherited codes', () => {
    for (const code of ['nope', undefined, ['catch-saved'], 'toString', '__proto__', 'constructor']) {
      expect(noticeFor(code as string | string[] | undefined)).toBeNull()
    }
  })
})

describe('mapDbError', () => {
  it('maps the known database refusals', () => {
    expect(
      mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "sessions_one_running_per_user"' }),
    ).toEqual({ kind: 'running-exists' })
    expect(
      mapDbError({ code: '23P01', message: 'conflicting key value violates exclusion constraint "sessions_no_overlap"' }),
    ).toEqual({ kind: 'overlap' })
    expect(mapDbError({ code: 'P0001', message: 'catch_outside_session', details: null })).toEqual({ kind: 'catch-outside' })
    expect(mapDbError({ code: '23514', message: 'check failed', details: 'catch_outside_session' })).toEqual({
      kind: 'catch-outside',
    })
    expect(
      mapDbError({
        code: '23503',
        message: 'insert or update on table "catches" violates foreign key constraint "catches_session_owner_fkey"',
      }),
    ).toEqual({ kind: 'session-gone' })
    expect(mapDbError({ code: '23505', message: 'duplicate key value violates unique constraint "catches_pkey"' })).toEqual({
      kind: 'duplicate-id',
    })
  })

  it('needs code and name to match; everything else is unknown and never throws', () => {
    expect(mapDbError({ code: '23505', message: 'violates "sessions_no_overlap"' })).toEqual({ kind: 'unknown' })
    expect(mapDbError({ code: '23P01', message: 'violates "sessions_one_running_per_user"' })).toEqual({ kind: 'unknown' })
    expect(mapDbError({ code: '23503', message: 'violates foreign key constraint "sessions_user_id_fkey"' })).toEqual({
      kind: 'unknown',
    })
    expect(mapDbError({ code: '23505', message: 'unique constraint "sessions_other_idx"' })).toEqual({ kind: 'unknown' })
    for (const e of [null, undefined, 'boom', 42, {}, { code: 42, message: {} }]) {
      expect(mapDbError(e)).toEqual({ kind: 'unknown' })
    }
  })
})
