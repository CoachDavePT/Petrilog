// Every user-facing weather text in one place — PROJ-3 design.md → „Wann gilt ein Eintrag als ‚ohne Wetter‘",
// „Nachholen: die Server Action …", „Anzeige der Werte" and „Nachtragen" (AC-7, AC-8, AC-10, AC-14, AC-16,
// AC-17, AC-18). Formatting of values lives in format.ts.

export const WEATHER_MESSAGES = {
  // Section headings (AC-14)
  sessionHeading: 'Wetter beim Start',
  catchHeading: 'Wetter beim Fang',

  // States (AC-7, AC-8, AC-16)
  pending: 'Wetter wird abgerufen …',
  noWeather: 'Ohne Wetterdaten',
  failedReason: 'Wetter konnte nicht abgerufen werden.',
  noPositionReason: 'Ohne Position wird kein Wetter abgerufen.',

  // Manual retry (AC-10)
  retry: 'Wetter erneut abrufen',
  retrying: 'Wird abgerufen …',
  retryFailed: 'Wetter gerade nicht verfügbar. Versuche es später erneut.',

  // Marker on session cards and catch rows (AC-17)
  marker: 'ohne Wetter',

  // Backfill notice (AC-18)
  backfillTitle: 'Wetter von damals',
  backfillText: 'Wir rufen die stündlichen Wetterdaten für diesen Zeitraum ab, soweit verfügbar.',
} as const
