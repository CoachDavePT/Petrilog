import { describe, expect, it } from 'vitest'
import { LOGIN_NOTICES, MESSAGES, loginNoticeText, tooManyAttempts } from './messages'

describe('tooManyAttempts (AC-23, AC-24)', () => {
  it('rounds the waiting time up to whole minutes', () => {
    expect(tooManyAttempts(14.2)).toBe('Zu viele Versuche. Bitte versuche es in 15 Minuten erneut.')
    expect(tooManyAttempts(3)).toBe('Zu viele Versuche. Bitte versuche es in 3 Minuten erneut.')
  })

  it('never says less than 1 minute and uses the singular for 1', () => {
    expect(tooManyAttempts(0)).toBe('Zu viele Versuche. Bitte versuche es in 1 Minute erneut.')
    expect(tooManyAttempts(0.1)).toBe('Zu viele Versuche. Bitte versuche es in 1 Minute erneut.')
    expect(tooManyAttempts(-5)).toBe('Zu viele Versuche. Bitte versuche es in 1 Minute erneut.')
  })
})

describe('loginNoticeText (?notice= on /login)', () => {
  it('maps the three known codes to their German text (AC-28, EC-4, EC-9)', () => {
    expect(loginNoticeText('account-deleted')).toBe('Dein Konto wurde gelöscht.')
    expect(loginNoticeText('session-ended')).toBe('Bitte melde dich erneut an.')
    expect(loginNoticeText('email-confirmed')).toBe('E-Mail-Adresse bestätigt. Bitte melde dich an.')
  })

  it('ignores unknown codes, repeated parameters and a missing value', () => {
    expect(loginNoticeText('password-changed')).toBeNull()
    expect(loginNoticeText('<script>alert(1)</script>')).toBeNull()
    expect(loginNoticeText(['account-deleted', 'session-ended'])).toBeNull()
    expect(loginNoticeText(undefined)).toBeNull()
    expect(loginNoticeText('')).toBeNull()
  })

  it('does not fall through to inherited object keys', () => {
    expect(loginNoticeText('toString')).toBeNull()
    expect(loginNoticeText('__proto__')).toBeNull()
    expect(loginNoticeText('constructor')).toBeNull()
  })

  it('accepts exactly the three codes from design.md', () => {
    expect(Object.keys(LOGIN_NOTICES).sort()).toEqual(['account-deleted', 'email-confirmed', 'session-ended'])
  })
})

describe('messages the spec fixes word for word', () => {
  it('uses the texts from spec.md', () => {
    expect(MESSAGES.invalidCredentials).toBe('E-Mail oder Passwort ist falsch.') // AC-8
    expect(MESSAGES.wrongCurrentPassword).toBe('Das aktuelle Passwort ist falsch.') // AC-21
    expect(MESSAGES.wrongPassword).toBe('Das Passwort ist falsch.') // EC-11
    expect(MESSAGES.mailWait).toBe('Bitte warte etwas, bevor du eine weitere Mail anforderst.') // AC-25
    expect(MESSAGES.tooManySignups).toBe('Zu viele Registrierungen. Bitte versuche es später erneut.') // AC-26
    expect(MESSAGES.resetLinkSent).toBe(
      'Falls es ein Konto zu dieser Adresse gibt, haben wir dir einen Link geschickt.',
    ) // AC-16
    expect(MESSAGES.network).toBe('Keine Verbindung. Bitte versuche es erneut.') // EC-6
    expect(MESSAGES.linkExpired).toBe('Dieser Link ist abgelaufen oder wurde schon benutzt.') // EC-1
    expect(MESSAGES.passwordChanged).toBe('Passwort geändert') // AC-17, AC-20
  })
})
