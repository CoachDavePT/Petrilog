'use client'

// The list of the sessions overview (PROJ-2: AC-1, EC-8, EC-12; design.md → Sessions-Übersicht). Shows
// the first section of 20 from the server and appends older ones via „Weitere laden" (Server Action
// `loadMoreSessions`) while a `nextCursor` exists. The button stays locked while loading; a failure
// shows as a warning notice and keeps what is already loaded. The items carry no positions, so no
// coordinates can appear here.
import { useState, useTransition } from 'react'
import { LoaderCircle } from 'lucide-react'
import { FormNotice } from '@/components/auth/form-notice'
import { Button } from '@/components/ui/button'
import { loadMoreSessions } from '@/lib/fishing/actions/overview'
import { MESSAGES } from '@/lib/fishing/messages'
import type { SessionListItem, SessionPage } from '@/lib/fishing/queries'
import { SessionCard } from './session-card'

export type SessionListProps = {
  /** The first section, as `listSessions()` returns it. */
  initialPage: SessionPage
  /** The server's clock (ISO) — for the „ohne Wetter" markers (PROJ-3 AC-17). */
  serverNow: string
}

/** Appends `next` to `current`, skipping ids already shown (a section never repeats, but be safe). */
function appendUnique(current: SessionListItem[], next: SessionListItem[]): SessionListItem[] {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !seen.has(item.id))]
}

export function SessionList({ initialPage, serverNow }: SessionListProps) {
  const now = new Date(serverNow)
  const [basePage, setBasePage] = useState(initialPage)
  const [items, setItems] = useState(initialPage.items)
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The server sent a fresh first section (refresh, revalidation): start over from it.
  if (basePage !== initialPage) {
    setBasePage(initialPage)
    setItems(initialPage.items)
    setNextCursor(initialPage.nextCursor)
    setError(null)
  }

  const loadMore = () => {
    if (!nextCursor || pending) return
    const cursor = nextCursor
    // Clear the old warning at once (urgent), not inside the transition: the list updates after the
    // `await` land outside it and could otherwise show next to a stale warning (PROJ-3 QA BUG-1).
    setError(null)
    startTransition(async () => {
      try {
        const result = await loadMoreSessions(cursor)
        if (result.status === 'ok') {
          setItems((current) => appendUnique(current, result.page.items))
          setNextCursor(result.page.nextCursor)
        } else {
          setError(result.message)
        }
      } catch {
        setError(MESSAGES.network)
      }
    })
  }

  if (items.length === 0 && !nextCursor) return null

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label="Deine Sessions" className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <SessionCard {...item} now={now} />
          </li>
        ))}
      </ul>
      {error && <FormNotice tone="warning">{error}</FormNotice>}
      {nextCursor && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={loadMore}
          disabled={pending}
          aria-busy={pending}
        >
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Weitere laden
        </Button>
      )}
    </div>
  )
}
