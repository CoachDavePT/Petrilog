import type { Metadata } from 'next'
import { AccountActions } from '@/components/account/account-actions'
import { FormNotice } from '@/components/auth/form-notice'
import { AppBar } from '@/components/shell/app-bar'
import { accountNoticeText } from '@/lib/auth/messages'
import { requireUser } from '@/lib/auth/require-user'

export const metadata: Metadata = { title: 'Konto · Petrilog' }

// Main page inside the frame of `(main)/layout.tsx` (PROJ-2 AC-5): the tab bar below replaces the former
// link back to the start page. ?notice= carries only a short code; the one known code is reset-expired (EC-13).
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const user = await requireUser()
  const notice = accountNoticeText((await searchParams).notice)
  return (
    <>
      <AppBar variant="large" eyebrow="Dein Fangbuch" title="Konto" />
      <main className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-5 pb-8 pt-2">
        {notice && <FormNotice tone="warning">{notice}</FormNotice>}
        <section aria-labelledby="account-email" className="rounded-xl bg-card p-4 shadow-sm">
          <p id="account-email" className="text-[13px] font-medium text-muted-foreground">
            E-Mail-Adresse
          </p>
          <p className="mt-1 break-all text-[17px] font-semibold">{user.email}</p>
        </section>
        <AccountActions />
      </main>
    </>
  )
}
