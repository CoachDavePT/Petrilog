// German page for unknown addresses, app-wide (PROJ-1 design.md). Signed-out visitors reach the
// login first (proxy), so this is what signed-in users see. Light, without the app frame.
import type { Metadata } from 'next'
import Link from 'next/link'
import { SimplePage } from '@/components/simple-page'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Seite nicht gefunden · Petrilog' }

export default function NotFound() {
  return (
    <SimplePage title="Diese Seite gibt es nicht.">
      <Link href="/" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full')}>
        Zur Startseite
      </Link>
    </SimplePage>
  )
}
