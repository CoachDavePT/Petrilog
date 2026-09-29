// Input rules shared by the browser (react-hook-form) and the server (Server Actions) — PROJ-1
// design.md → Eingaberegeln. The server always re-validates; the browser check is a convenience.
import { z } from 'zod'
import { MESSAGES } from './messages'

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 72 // bcrypt limit
export const EMAIL_MAX = 254

/** Trimmed, lower-cased, valid address (EC-7). */
export const emailSchema = z
  .string({ error: MESSAGES.emailInvalid })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, { error: MESSAGES.emailInvalid })
  .pipe(z.email({ error: MESSAGES.emailInvalid }))

/** A password being set: 8–72 characters, no character classes, nothing trimmed. */
export const newPasswordSchema = z
  .string({ error: MESSAGES.passwordTooShort })
  .min(PASSWORD_MIN, { error: MESSAGES.passwordTooShort })
  .max(PASSWORD_MAX, { error: MESSAGES.passwordTooLong })

/** A password being checked: required only — a length hint would leak something about it. */
export const existingPasswordSchema = z
  .string({ error: MESSAGES.passwordRequired })
  .min(1, { error: MESSAGES.passwordRequired })
  .max(PASSWORD_MAX, { error: MESSAGES.invalidCredentials })

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

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}
