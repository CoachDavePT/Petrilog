// Every user-facing auth message in one place (PROJ-1 design.md): cases that must look identical to
// an attacker — unknown address vs. wrong password, existing vs. new address — are guaranteed to use
// the same string because there is only one.

export const MESSAGES = {
  invalidCredentials: 'E-Mail oder Passwort ist falsch.',
  wrongCurrentPassword: 'Das aktuelle Passwort ist falsch.',
  wrongPassword: 'Das Passwort ist falsch.',
  samePassword: 'Das neue Passwort muss sich vom bisherigen unterscheiden.',
  emailNotConfirmed:
    'Bitte bestätige zuerst deine E-Mail-Adresse. Den Link dazu haben wir dir per Mail geschickt.',
  mailWait: 'Bitte warte etwas, bevor du eine weitere Mail anforderst.',
  tooManySignups: 'Zu viele Registrierungen. Bitte versuche es später erneut.',
  network: 'Keine Verbindung. Bitte versuche es erneut.',
  resetLinkSent: 'Falls es ein Konto zu dieser Adresse gibt, haben wir dir einen Link geschickt.',
  newLinkSent: 'Falls es dazu ein Konto gibt, haben wir dir eine neue Mail geschickt.',
  mailResent: 'Mail gesendet',
  linkExpired: 'Dieser Link ist abgelaufen oder wurde schon benutzt.',
  passwordChanged: 'Passwort geändert',
  accountDeleted: 'Dein Konto wurde gelöscht.',
  sessionEnded: 'Bitte melde dich erneut an.',
  emailConfirmed: 'E-Mail-Adresse bestätigt. Bitte melde dich an.',
  emailInvalid: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  passwordRequired: 'Bitte gib dein Passwort ein.',
  passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen haben.',
  passwordTooLong: 'Das Passwort darf höchstens 72 Zeichen haben.',
} as const

/** „Zu viele Versuche. Bitte versuche es in X Minuten erneut." — X is at least 1. */
export function tooManyAttempts(minutes: number): string {
  const m = Math.max(1, Math.ceil(minutes))
  return `Zu viele Versuche. Bitte versuche es in ${m} ${m === 1 ? 'Minute' : 'Minuten'} erneut.`
}

/** Notice codes the login page accepts in `?notice=` — anything else is ignored. */
export const LOGIN_NOTICES = {
  'account-deleted': MESSAGES.accountDeleted,
  'session-ended': MESSAGES.sessionEnded,
  'email-confirmed': MESSAGES.emailConfirmed,
} as const

export type LoginNotice = keyof typeof LOGIN_NOTICES

export function loginNoticeText(code: string | string[] | undefined): string | null {
  if (typeof code !== 'string') return null
  return Object.prototype.hasOwnProperty.call(LOGIN_NOTICES, code)
    ? LOGIN_NOTICES[code as LoginNotice]
    : null
}
