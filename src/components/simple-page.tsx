// Light page without the app frame (docs/app-shell.md → Anmeldezustand): a compact header with the
// title and an optional back link, then one centred column. Used for pages reachable from email
// links and the privacy policy — not a navigation of its own.
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export function SimplePage({
  title,
  back,
  children,
}: {
  title: string
  back?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex w-full max-w-[440px] items-center gap-1 px-5 pb-2 pt-6">
        {back && (
          <Link
            href={back.href}
            aria-label={back.label}
            className="-ml-2 inline-flex size-11 items-center justify-center rounded-lg hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </Link>
        )}
        <h1 className="text-2xl font-medium">{title}</h1>
      </header>
      <main className="mx-auto w-full max-w-[440px] px-5 pb-10 pt-4">{children}</main>
    </div>
  )
}
