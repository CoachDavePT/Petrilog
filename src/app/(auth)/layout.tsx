// Frame for logged-out visitors (docs/app-shell.md → Anmeldezustand): dark forest ground with paper
// texture and the "Petrilog" wordmark, no tab bar. The form itself sits on a card for legibility.
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper-texture flex min-h-dvh flex-col bg-moss-800 text-sand-50 dark:bg-moss-900">
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-5 pb-8 pt-16">
        <p className="font-display text-[46px] font-bold leading-[1.05]">Petrilog</p>
        <p className="mb-10 mt-2 text-[15px] text-sand-200">Dein Fangbuch am Wasser.</p>
        <div className="rounded-xl bg-card p-5 text-card-foreground shadow-sm">{children}</div>
        <nav aria-label="Rechtliches" className="mt-6 text-center text-[13px]">
          <Link
            href="/privacy"
            className="rounded-sm text-sand-200 underline underline-offset-4 hover:text-sand-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-lake-300"
          >
            Datenschutz
          </Link>
        </nav>
      </main>
    </div>
  )
}
