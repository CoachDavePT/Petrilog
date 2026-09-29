'use client'

// Figure tiles of the session detail view: „Fänge" and „Fänge pro Stunde" (PROJ-2: AC-29 – AC-31,
// EC-8; design.md → Detailansicht und Kennzahl). For a running session the rate is measured to „now"
// and refreshed once a minute. The first render uses the server's clock (`serverNow`) so server and
// browser render the same text — no hydration mismatch; the ticks after it carry that clock forward.
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { formatCatchesPerHour, formatNumber } from '@/lib/fishing/format'

const MINUTE_MS = 60_000

export type SessionStatsProps = {
  startedAt: string
  /** `null` while the session is running. */
  endedAt: string | null
  catchCount: number
  /** The server's „now" (ISO) at render time. */
  serverNow: string
}

export function SessionStats({ startedAt, endedAt, catchCount, serverNow }: SessionStatsProps) {
  const [now, setNow] = useState(() => new Date(serverNow))
  // How far the server's clock is ahead of this device's — the rate keeps following the server's clock.
  const [clockOffset] = useState(() => Date.parse(serverNow) - Date.now())
  const running = endedAt === null

  useEffect(() => {
    if (!running) return
    const tick = () => setNow(new Date(Date.now() + clockOffset))
    // one tick right after hydration (the page may be older than a moment), then every minute
    const first = window.setTimeout(tick, 0)
    const interval = window.setInterval(tick, MINUTE_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(interval)
    }
  }, [running, clockOffset])

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile label="Fänge" value={formatNumber(catchCount)} />
      <StatTile label="Fänge pro Stunde" value={formatCatchesPerHour(catchCount, startedAt, endedAt, now)} />
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-2 rounded-[12px] border-0 bg-lake-100 p-4 text-lake-800 shadow-sm dark:bg-lake-800 dark:text-lake-100 dark:shadow-none">
      <span className="text-[13px] font-medium leading-tight">{label}</span>
      <span className="text-[32px] font-medium leading-none tabular-nums">{value}</span>
    </Card>
  )
}
