import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { AccountActions } from '@/components/account/account-actions'
import { FormNotice } from '@/components/auth/form-notice'
import { accountNoticeText } from '@/lib/auth/messages'
import { requireUser } from '@/lib/auth/require-user'

export const metadata: Metadata = { title: 'Konto · Petrilog' }

// ?notice= carries only a short code; the one known code is reset-expired (EC-13).
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const user = await requireUser()
  const notice = accountNoticeText((await searchParams).notice)
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-5 pb-10 pt-6">
      {/* Until PROJ-2 brings the tab bar, a plain way back to the start page. */}
      <Link
        href="/"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-lg px-2 text-[13px] font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <ChevronLeft className="size-5" aria-hidden />
        Startseite
      </Link>
      {notice && <FormNotice tone="warning">{notice}</FormNotice>}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Konto</p>
        <h1 className="text-2xl font-medium">Dein Konto</h1>
      </div>
      <section aria-labelledby="account-email" className="rounded-xl bg-card p-4 shadow-sm">
        <p id="account-email" className="text-[13px] font-medium text-muted-foreground">
          E-Mail-Adresse
        </p>
        <p className="mt-1 break-all text-[17px] font-semibold">{user.email}</p>
      </section>
      <AccountActions />
    </main>
  )
}
