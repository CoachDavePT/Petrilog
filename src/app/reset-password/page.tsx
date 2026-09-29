import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { NewPasswordForm } from '@/components/auth/new-password-form'
import { SimplePage } from '@/components/simple-page'
import { currentSessionId, removeResetGrant, resetGrantState } from '@/lib/auth/reset-grant'
import { requireUser } from '@/lib/auth/require-user'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Neues Passwort · Petrilog' }

// Only within 15 minutes of opening a recovery link, in that same session (AC-33, EC-13). Signed in
// without that grant → /account; not signed in → /login (requireUser).
export default async function ResetPasswordPage() {
  const user = await requireUser()
  const grant = resetGrantState(user, await currentSessionId(await createClient()))
  if (grant === 'expired') {
    await removeResetGrant(createAdminClient(), user.id)
    redirect('/account?notice=reset-expired')
  }
  if (grant === 'none') redirect('/account')

  return (
    <SimplePage title="Neues Passwort festlegen">
      <NewPasswordForm />
    </SimplePage>
  )
}
