'use client'
// The bottom tab bar of the main pages (docs/app-shell.md → Layout-Bereiche; PROJ-2 AC-1, AC-3, AC-5):
// Sessions (/) · Start (/start) · Konto (/account). The active tab carries aria-current="page"; the
// session pages under /sessions/… count as „Sessions". Inactive labels use text-muted, never text-faint
// (design-system.md → Korrektur 1). Renders an in-flow spacer of its own height, so content placed
// before it is never hidden behind the fixed bar (see TAB_BAR_HEIGHT_PX).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, CirclePlay, CircleUser, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Height of the bar without the bottom safe-area inset. The ActiveSessionBar floats on top of it. */
export const TAB_BAR_HEIGHT_PX = 64

type Tab = {
  href: string
  label: string
  icon: LucideIcon
  isActive: (pathname: string) => boolean
  /** `/start` only redirects, and its target depends on whether a session runs — never prefetch it. */
  prefetch?: false
}

const TABS: readonly Tab[] = [
  {
    href: '/',
    label: 'Sessions',
    icon: BookOpen,
    isActive: (p) => p === '/' || p === '/sessions' || p.startsWith('/sessions/'),
  },
  { href: '/start', label: 'Start', icon: CirclePlay, isActive: (p) => p === '/start', prefetch: false },
  {
    href: '/account',
    label: 'Konto',
    icon: CircleUser,
    isActive: (p) => p === '/account' || p.startsWith('/account/'),
  },
]

export function TabBar() {
  const pathname = usePathname() ?? ''

  return (
    <>
      {/* Keeps the end of the content above the fixed bar, iPhone home indicator included. */}
      <div aria-hidden className="h-[calc(64px+env(safe-area-inset-bottom,0px))] shrink-0" />
      <nav
        aria-label="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom,0px)]"
      >
        <ul className="mx-auto flex h-16 w-full max-w-[440px] items-stretch px-2">
          {TABS.map(({ href, label, icon: Icon, isActive, prefetch }) => {
            const active = isActive(pathname)
            return (
              <li key={href} className="flex flex-1">
                <Link
                  href={href}
                  prefetch={prefetch}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[12px] font-medium leading-tight transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/60',
                    active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-14 items-center justify-center rounded-lg transition-colors duration-[120ms]',
                      active ? 'bg-accent text-accent-foreground' : 'group-hover:bg-accent/60',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
