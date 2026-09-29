import type { Metadata } from 'next'
import { NewPasswordForm } from '@/components/auth/new-password-form'
import { SimplePage } from '@/components/simple-page'
import { requireUser } from '@/lib/auth/require-user'

export const metadata: Metadata = { title: 'Neues Passwort · Petrilog' }

// Reached signed in through the recovery link (/auth/confirm); without a login → /login.
export default async function ResetPasswordPage() {
  await requireUser()
  return (
    <SimplePage title="Neues Passwort festlegen">
      <NewPasswordForm />
    </SimplePage>
  )
}
