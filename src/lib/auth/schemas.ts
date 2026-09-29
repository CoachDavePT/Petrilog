// Input rules shared by the browser (react-hook-form) and the server (Server Actions) — PROJ-1
// design.md → Eingaberegeln. The server always re-validates; the browser check is a convenience.
import { z } from 'zod'
import { MESSAGES } from './messages'

export const PASSWORD_MIN = 8
/** bcrypt hashes at most 72 bytes of UTF-8 — umlauts count 2, emojis 4 (AC-34). */
export const PASSWORD_MAX_BYTES = 72
export const EMAIL_MAX = 254

export function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length
}

/** Trimmed, lower-cased, valid address (EC-7). */
export const emailSchema = z
  .string({ error: MESSAGES.emailInvalid })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, { error: MESSAGES.emailInvalid })
  .pipe(z.email({ error: MESSAGES.emailInvalid }))

/** A password being set: at least 8 characters, at most 72 bytes, no character classes, nothing trimmed. */
export const newPasswordSchema = z
  .string({ error: MESSAGES.passwordTooShort })
  .min(PASSWORD_MIN, { error: MESSAGES.passwordTooShort })
  .refine((value) => utf8Length(value) <= PASSWORD_MAX_BYTES, { error: MESSAGES.passwordTooLong })

/**
 * A password being checked: required only — a length hint would leak something about it. An overlong
 * one is not rejected here: it goes through the login brake and counts as a failure (password-check.ts).
 */
export const existingPasswordSchema = z
  .string({ error: MESSAGES.passwordRequired })
  .min(1, { error: MESSAGES.passwordRequired })

export const loginSchema = z.object({ email: emailSchema, password: existingPasswordSchema })
export const registerSchema = z.object({ email: emailSchema, password: newPasswordSchema })
export const emailOnlySchema = z.object({ email: emailSchema })
export const newPasswordFormSchema = z.object({ password: newPasswordSchema })
export const changePasswordSchema = z.object({
  currentPassword: existingPasswordSchema,
  newPassword: newPasswordSchema,
})
export const deleteAccountSchema = z.object({ password: existingPasswordSchema })

export type LoginInput = z.input<typeof loginSchema>
export type RegisterInput = z.input<typeof registerSchema>
export type EmailOnlyInput = z.input<typeof emailOnlySchema>
export type NewPasswordInput = z.input<typeof newPasswordFormSchema>
export type ChangePasswordInput = z.input<typeof changePasswordSchema>
export type DeleteAccountInput = z.input<typeof deleteAccountSchema>

/** Field errors keyed by field name — the shape Server Actions return to the forms. */
export type FieldErrors = Partial<Record<string, string>>

/**
 * A broken request (no object, a list …) fails at the root, where Zod only has its English default
 * text — that becomes the general German message under `form` instead.
 */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const root = issue.path.length === 0
    const key = root ? 'form' : String(issue.path[0])
    if (!out[key]) out[key] = root ? MESSAGES.invalidInput : issue.message
  }
  return out
}

/** What every auth Server Action returns to its form (redirects are thrown, not returned). */
export type ActionState =
  | { status: 'success'; message?: string }
  | { status: 'error'; message?: string; fieldErrors?: FieldErrors; unconfirmed?: boolean }
