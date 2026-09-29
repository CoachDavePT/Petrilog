// Every user-facing message of Sessions & Fänge in one place — PROJ-2 design.md → Eingaberegeln,
// Seiten und Adressen (notice codes), Fangzeit-Garantie, Session beenden / nachtragen. Functions with
// values take ALREADY FORMATTED strings (times, dates, durations): formatting lives in format.ts.

export const MESSAGES = {
  // Input rules
  invalidInput: 'Bitte prüfe deine Eingaben.',
  waterNameTooLong: 'Höchstens 80 Zeichen.',
  noteTooLong: 'Höchstens 500 Zeichen.',
  baitTooLong: 'Höchstens 60 Zeichen.',
  speciesOtherTooLong: 'Höchstens 40 Zeichen.',
  speciesRequired: 'Bitte wähle eine Fischart.',
  speciesOtherRequired: 'Bitte gib die Fischart ein.',
  lengthInvalid: 'Bitte gib die Länge in ganzen Zentimetern ein (1 bis 250).',
  weightInvalid: 'Bitte gib das Gewicht in ganzen Gramm ein (1 bis 150.000).',
  releasedRequired: 'Bitte wähle „Zurückgesetzt“ oder „Entnommen“.',
  timeRequired: 'Bitte gib Datum und Uhrzeit ein.',
  catchTimeRequired: 'Bitte gib die Uhrzeit ein.',
  timeInFuture: 'Dieser Zeitpunkt liegt in der Zukunft.',
  endBeforeStart: 'Das Ende muss nach dem Start liegen.',
  sessionTooShort: 'Eine Session dauert mindestens 1 Minute.',

  // States and hints
  sessionGone: 'Diese Session gibt es nicht mehr.',
  sessionRunning: 'Es läuft bereits eine Session.',
  positionMissing: 'Position fehlt. Prüfe die Standortfreigabe deines Browsers.',
  runningLong: 'Läuft seit über 12 Stunden. Vergessen zu beenden?',
  noCatches: 'Noch keine Fänge. Petri Heil!',
  network: 'Keine Verbindung. Bitte versuche es erneut.',
  locationExplainer:
    'Petrilog speichert beim Starten und bei jedem Fang deine Position, damit du später weißt, wo du gefangen hast. Nur du kannst sie sehen.',

  // Dialogs
  deleteSessionTitle: 'Session löschen?',
  deleteCatchTitle: 'Fang löschen?',
  deleteCatchDescription: 'Der Fang wird endgültig gelöscht.',
  removePositionTitle: 'Position endgültig entfernen?',
  cancel: 'Abbrechen',
  delete: 'Löschen',

  // Success
  sessionStarted: 'Session gestartet',
  sessionSaved: 'Session gespeichert',
  sessionEnded: 'Session beendet',
  sessionDeleted: 'Session gelöscht',
  catchSaved: 'Fang gespeichert',
  catchDeleted: 'Fang gelöscht',
} as const

/** „Die Fangzeit muss zwischen 14:05 und 18:40 liegen." (AC-24) */
export function catchTimeRange(from: string, to: string): string {
  return `Die Fangzeit muss zwischen ${from} und ${to} liegen.`
}

/** „Die Session wurde inzwischen beendet (Ende 18:40)." (EC-4) */
export function sessionEndedMeanwhile(end: string): string {
  return `Die Session wurde inzwischen beendet (Ende ${end}).`
}

/** „Überschneidet sich mit deiner Session vom 12.09., 16:00–20:00." (AC-16) */
export function overlapsSession(date: string, from: string, to: string): string {
  return `Überschneidet sich mit deiner Session vom ${date}, ${from}–${to}.`
}

/** „Überschneidet sich mit deiner laufenden Session seit 14:05." (AC-16) */
export function overlapsRunningSession(since: string): string {
  return `Überschneidet sich mit deiner laufenden Session seit ${since}.`
}

/** „Der Fang um 17:20 (Hecht) läge außerhalb der Session." (AC-18, EC-9) */
export function catchOutsideSession(time: string, species: string): string {
  return `Der Fang um ${time} (${species}) läge außerhalb der Session.`
}

/** „Eine Session dauert höchstens 48 Stunden (bis 14.09., 06:00)." (AC-12, AC-15) */
export function sessionTooLong(latestEnd: string): string {
  return `Eine Session dauert höchstens 48 Stunden (bis ${latestEnd}).`
}

/** „Session beendet · 1:42 h" — `duration` is already formatted, unit included. Without it: „Session beendet". */
export function sessionEndedNotice(duration?: string): string {
  return duration ? `${MESSAGES.sessionEnded} · ${duration}` : MESSAGES.sessionEnded
}

/** Body of „Session löschen?" (AC-19): „Die Session und ihre 3 Fänge werden endgültig gelöscht." */
export function deleteSessionDescription(catchCount: number): string {
  if (catchCount <= 0) return 'Die Session wird endgültig gelöscht.'
  if (catchCount === 1) return 'Die Session und ihr Fang werden endgültig gelöscht.'
  return `Die Session und ihre ${catchCount} Fänge werden endgültig gelöscht.`
}

export type NoticeTone = 'success' | 'info' | 'warning'

/**
 * Notice codes the fishing pages accept in `?notice=` (design.md → Seiten und Adressen) — anything
 * else is ignored. `session-ended` is a function: the page reads the duration from the session itself.
 */
export const NOTICES = {
  'session-started': { tone: 'success', text: MESSAGES.sessionStarted },
  'session-saved': { tone: 'success', text: MESSAGES.sessionSaved },
  'session-ended': { tone: 'success', text: sessionEndedNotice },
  'session-deleted': { tone: 'success', text: MESSAGES.sessionDeleted },
  'session-running': { tone: 'info', text: MESSAGES.sessionRunning },
  'session-gone': { tone: 'warning', text: MESSAGES.sessionGone },
  'catch-saved': { tone: 'success', text: MESSAGES.catchSaved },
  'catch-deleted': { tone: 'success', text: MESSAGES.catchDeleted },
} as const satisfies Record<string, { tone: NoticeTone; text: string | ((duration?: string) => string) }>

export type NoticeCode = keyof typeof NOTICES

export function isNoticeCode(code: unknown): code is NoticeCode {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(NOTICES, code)
}

/**
 * The notice for a `?notice=` value, or `null` for an unknown code, a repeated parameter (array) or an
 * inherited key like `toString`. `duration` (already formatted, e.g. „1:42 h") fills `session-ended`.
 */
export function noticeFor(
  code: string | string[] | undefined,
  context: { duration?: string } = {},
): { code: NoticeCode; tone: NoticeTone; text: string } | null {
  if (!isNoticeCode(code)) return null
  const entry = NOTICES[code]
  const text = typeof entry.text === 'function' ? entry.text(context.duration) : entry.text
  return { code, tone: entry.tone, text }
}
