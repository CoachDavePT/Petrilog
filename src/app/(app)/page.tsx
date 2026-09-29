// Start page — a placeholder until PROJ-2 turns it into the sessions overview (design.md PROJ-1).
import type { Metadata } from 'next'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { NoticeToast } from '@/components/notice-toast'
import { buttonVariants } from '@/components/ui/button'
import { MESSAGES } from '@/lib/auth/messages'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Petrilog' }

export default async function HomePage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const { notice } = await searchParams
  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-col gap-6 px-5 pb-10 pt-10">
      <NoticeToast message={notice === 'password-changed' ? MESSAGES.passwordChanged : null} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dein Fangbuch</p>
        <h1 className="font-display text-[40px] font-bold leading-[1.05]">Petri Heil!</h1>
      </div>
      <p className="text-muted-foreground">
        Du bist angemeldet. Sessions und Fänge kommen hier bald dazu.
      </p>
      <Link href="/account" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'w-full')}>
        <UserRound aria-hidden />
        Konto
      </Link>
    </main>
  )
}
