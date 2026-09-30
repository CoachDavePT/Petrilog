// The app's header (docs/app-shell.md → Layout-Bereiche, PROJ-2 design.md → Komponenten-Struktur).
// `large` on main pages: eyebrow + big slab title („Dein Fangbuch" / „Sessions"). `compact` on sub-pages:
// back or close link on the left, the title, an optional action on the right (menu, delete). No client
// state — works as a Server Component; the right slot may hold a Client Component.
import Link from 'next/link'
import { ChevronLeft, X } from 'lucide-react'

type LargeAppBarProps = {
  variant: 'large'
  /** Small caps line above the title, e.g. „Dein Fangbuch". */
  eyebrow?: string
  title: string
  /** Optional element on the right, level with the title. */
  action?: React.ReactNode
}

type CompactAppBarProps = {
  variant: 'compact'
  title: string
  /** Left navigation: `back` shows a chevron, `close` an X. The label defaults to „Zurück" / „Schließen". */
  nav?: { href: string; kind: 'back' | 'close'; label?: string }
  /** Optional element on the right, e.g. a menu or a delete button (keep it ≥ 44 px, like `size="icon"`). */
  action?: React.ReactNode
}

export type AppBarProps = LargeAppBarProps | CompactAppBarProps

const NAV_LABELS = { back: 'Zurück', close: 'Schließen' } as const

/** Round 44 px icon target for the compact bar — also usable for the `action` slot. */
export const appBarIconClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors duration-[120ms] hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60'

export function AppBar(props: AppBarProps) {
  if (props.variant === 'large') {
    const { eyebrow, title, action } = props
    return (
      <header className="mx-auto w-full max-w-[440px] px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+2rem)]">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[12px] font-semibold uppercase leading-[1.2] tracking-[0.08em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 break-words font-display text-[40px] font-bold leading-[1.05] text-foreground">
              {title}
            </h1>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </header>
    )
  }

  const { title, nav, action } = props
  const NavIcon = nav?.kind === 'close' ? X : ChevronLeft
  return (
    <header className="sticky top-0 z-30 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto flex h-14 w-full max-w-[440px] items-center gap-1 px-3">
        {nav ? (
          <Link href={nav.href} aria-label={nav.label ?? NAV_LABELS[nav.kind]} className={appBarIconClass}>
            <NavIcon className="size-6" aria-hidden />
          </Link>
        ) : (
          // Keeps the title where it would be with a nav link.
          <span className="w-2 shrink-0" aria-hidden />
        )}
        <h1 className="min-w-0 flex-1 truncate text-2xl font-medium leading-tight text-foreground">{title}</h1>
        {action && <div className="flex shrink-0 items-center">{action}</div>}
      </div>
    </header>
  )
}
