import { describe, expect, it } from 'vitest'
import {
  changePasswordSchema,
  emailSchema,
  existingPasswordSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
} from './schemas'
import { loginNoticeText, tooManyAttempts } from './messages'

describe('emailSchema (EC-7)', () => {
  it('trims and lower-cases the address', () => {
    expect(emailSchema.parse('  Angler@Beispiel.DE ')).toBe('angler@beispiel.de')
  })

  it('rejects an invalid address with the German message', () => {
    const r = emailSchema.safeParse('kein-at-zeichen')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Bitte gib eine gültige E-Mail-Adresse ein.')
  })

  it('rejects an empty address', () => {
    expect(emailSchema.safeParse('   ').success).toBe(false)
  })

  it('rejects an address longer than 254 characters', () => {
    expect(emailSchema.safeParse(`${'a'.repeat(250)}@b.de`).success).toBe(false)
  })
})

describe('newPasswordSchema (AC-5)', () => {
  it('rejects 7 characters', () => {
    const r = newPasswordSchema.safeParse('1234567')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Das Passwort muss mindestens 8 Zeichen haben.')
  })

  it('accepts exactly 8 characters without character classes', () => {
    expect(newPasswordSchema.safeParse('aaaaaaaa').success).toBe(true)
  })

  it('accepts 72 and rejects 73 characters', () => {
    expect(newPasswordSchema.safeParse('x'.repeat(72)).success).toBe(true)
    const r = newPasswordSchema.safeParse('x'.repeat(73))
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Das Passwort darf höchstens 72 Zeichen haben.')
  })

  it('does not trim spaces — they are part of the password', () => {
    expect(newPasswordSchema.parse('  mit leerzeichen  ')).toBe('  mit leerzeichen  ')
  })
})

describe('existingPasswordSchema', () => {
  it('does not apply the minimum length (no hint about the stored password)', () => {
    expect(existingPasswordSchema.safeParse('kurz').success).toBe(true)
  })

  it('requires a value', () => {
    const r = existingPasswordSchema.safeParse('')
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toBe('Bitte gib dein Passwort ein.')
  })
})

describe('form schemas', () => {
  it('registerSchema normalises the email and enforces the new-password rule', () => {
    expect(registerSchema.parse({ email: ' A@B.de', password: '12345678' })).toEqual({
      email: 'a@b.de',
      password: '12345678',
    })
    expect(registerSchema.safeParse({ email: 'a@b.de', password: 'kurz' }).success).toBe(false)
  })

  it('loginSchema accepts a short existing password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.de', password: 'kurz' }).success).toBe(true)
  })

  it('changePasswordSchema requires the current password and a valid new one', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: '', newPassword: '12345678' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'alt', newPassword: '1234567' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'alt', newPassword: '12345678' }).success).toBe(true)
  })
})

describe('messages', () => {
  it('rounds the wait time up and uses the singular for one minute', () => {
    expect(tooManyAttempts(0.2)).toBe('Zu viele Versuche. Bitte versuche es in 1 Minute erneut.')
    expect(tooManyAttempts(14.1)).toBe('Zu viele Versuche. Bitte versuche es in 15 Minuten erneut.')
  })

  it('accepts only the known login notice codes', () => {
    expect(loginNoticeText('account-deleted')).toBe('Dein Konto wurde gelöscht.')
    expect(loginNoticeText('toString')).toBeNull()
    expect(loginNoticeText('<script>')).toBeNull()
    expect(loginNoticeText(undefined)).toBeNull()
  })
})
