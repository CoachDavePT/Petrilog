import type { Metadata } from 'next'
import Link from 'next/link'
import { RequestNewLinkForm } from '@/components/auth/request-new-link-form'
import { FormNotice } from '@/components/auth/form-notice'
import { SimplePage } from '@/components/simple-page'
import { MESSAGES } from '@/lib/auth/messages'

export const metadata: Metadata = { title: 'Link abgelaufen · Petrilog' }

export default async function LinkExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>
}) {
  const { type } = await searchParams
  const kind = type === 'recovery' ? 'recovery' : 'signup'
  return (
    <SimplePage title="Link abgelaufen">
      <div className="flex flex-col gap-6">
        <FormNotice tone="warning">{MESSAGES.linkExpired}</FormNotice>
        <p className="text-muted-foreground">
          {kind === 'recovery'
            ? 'Fordere einen neuen Link an, um dein Passwort zurückzusetzen.'
            : 'Fordere eine neue Bestätigungsmail an. Ist dein Konto schon bestätigt, melde dich einfach an.'}
        </p>
        <RequestNewLinkForm type={kind} />
        <Link
          href="/login"
          className="self-center rounded-sm text-[15px] font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          Zum Login
        </Link>
      </div>
    </SimplePage>
  )
}
