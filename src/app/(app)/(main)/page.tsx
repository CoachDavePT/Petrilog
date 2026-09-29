// Sessions overview `/` (PROJ-2: AC-1, AC-2, EC-8, EC-12; design.md → Sessions-Übersicht). Replaces
// PROJ-1's start-page placeholder and keeps its one duty: the „Passwort geändert" notice after a
// password reset (PROJ-1 AC-17, `?notice=password-changed`). The main layout adds the active-session
// bar and the tab bar after this content.
//
// The AppBar and notices render at once; hero, „Session nachtragen" and the list stream in behind
// skeleton cards (Suspense), because they need the database.
import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { History, Play } from 'lucide-react'
import { FormNotice } from '@/components/auth/form-notice'
import { SessionList } from '@/components/fishing/session-list'
import { NoticeToast } from '@/components/notice-toast'
import { AppBar } from '@/components/shell/app-bar'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MESSAGES as AUTH_MESSAGES } from '@/lib/auth/messages'
import { requireUser } from '@/lib/auth/require-user'
import { MESSAGES, noticeFor } from '@/lib/fishing/messages'
import { getRunningSession, listSessions } from '@/lib/fishing/queries'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Sessions · Petrilog' }

type Notice = { toast: string | null; inline: { tone: 'info' | 'warning'; text: string } | null }

/**
 * `?notice=` → what to show. Success codes (PROJ-2's and PROJ-1's `password-changed`) become the toast;
 * `session-running` (info) and `session-gone` (warning) a notice in the content. Unknown codes: nothing.
 */
function readNotice(code: string | string[] | undefined): Notice {
  if (code === 'password-changed') return { toast: AUTH_MESSAGES.passwordChanged, inline: null }
  const notice = noticeFor(code)
  if (!notice) return { toast: null, inline: null }
  if (notice.tone === 'success') return { toast: notice.text, inline: null }
  return { toast: null, inline: { tone: notice.tone, text: notice.text } }
}

export default async function SessionsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>
}) {
  // Layout and page render in parallel — the page checks the login itself before any read.
  await requireUser()
  const notice = readNotice((await searchParams).notice)

  return (
    <>
      <AppBar variant="large" eyebrow="Dein Fangbuch" title="Sessions" />
      <main className="mx-auto flex w-full max-w-[440px] flex-col gap-4 px-5 pb-6">
        <NoticeToast message={notice.toast} />
        {notice.inline && <FormNotice tone={notice.inline.tone}>{notice.inline.text}</FormNotice>}
        <Suspense fallback={<OverviewSkeleton />}>
          <Overview />
        </Suspense>
      </main>
    </>
  )
}

/** Hero (only without a running session), „Session nachtragen", then the list (AC-1, AC-2). */
async function Overview() {
  let page: Awaited<ReturnType<typeof listSessions>>
  let running: Awaited<ReturnType<typeof getRunningSession>>
  try {
    ;[page, running] = await Promise.all([listSessions(), getRunningSession()])
  } catch (e) {
    const err = e as { message?: string } | null
    console.error('[fishing] sessions overview failed:', err?.message ?? String(e))
    return <FormNotice tone="warning">{MESSAGES.network}</FormNotice>
  }

  return (
    <>
      {!running && <ReadyCard />}
      <Link href="/sessions/backfill" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full')}>
        <History aria-hidden />
        Session nachtragen
      </Link>
      {page.items.length > 0 && (
        <div className="pt-2">
          <SessionList initialPage={page} />
        </div>
      )}
    </>
  )
}

/** „Bereit für den nächsten Wurf?" — hero card on surface-inverse with the paper texture. */
function ReadyCard() {
  return (
    <Card
      role="region"
      aria-labelledby="ready-title"
      className="paper-texture overflow-hidden rounded-[16px] border-0 bg-moss-800 p-5 text-sand-50 shadow-sm dark:bg-moss-700 dark:shadow-none"
    >
      <h2 id="ready-title" className="font-display text-[30px] font-bold leading-[1.05]">
        Bereit für den nächsten Wurf?
      </h2>
      <p className="mt-2 text-sand-100">Starte die Session am Wasser. Zeit und Position hält Petrilog für dich fest.</p>
      <Link
        href="/sessions/new"
        className={cn(buttonVariants({ size: 'lg' }), 'mt-5 w-full focus-visible:ring-lake-300')}
      >
        <Play aria-hidden />
        Session starten
      </Link>
    </Card>
  )
}

const SUNKEN = 'bg-sand-200 dark:bg-[#10160E]'

/** Loading: skeletons in the shape of hero, button and session cards, on surface-sunken. */
function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">
        Sessions werden geladen …
      </span>
      <Skeleton className={cn('h-[188px] rounded-[16px]', SUNKEN)} />
      <Skeleton className={cn('h-14 rounded-lg', SUNKEN)} />
      <div className="flex flex-col gap-3 pt-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className={cn('h-[104px] rounded-[12px]', SUNKEN)} />
        ))}
      </div>
    </div>
  )
}
