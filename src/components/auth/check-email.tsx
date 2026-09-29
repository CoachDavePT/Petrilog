'use client'

// "Prüfe dein Postfach" (PROJ-1: AC-1, AC-2, AC-6, AC-25) — identical whether the address is new,
// unconfirmed or already has an account.
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { resendConfirmation } from '@/lib/auth/actions/mail'
import { MESSAGES } from '@/lib/auth/messages'
import { FormNotice } from './form-notice'

const linkClass =
  'rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60'

export function CheckEmail({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()
  const [warning, setWarning] = useState<string | null>(null)

  const resend = () =>
    startTransition(async () => {
      setWarning(null)
      try {
        const result = await resendConfirmation({ email })
        if (result.status === 'success') toast.success(result.message ?? MESSAGES.mailResent)
        else setWarning(result.message ?? MESSAGES.network)
      } catch {
        setWarning(MESSAGES.network)
      }
    })

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <MailCheck className="size-8 text-moss-600 dark:text-moss-200" aria-hidden />
      <h1 className="text-2xl font-medium">Prüfe dein Postfach</h1>
      <p>
        Wir haben dir einen Link an <strong className="break-all font-semibold">{email}</strong> geschickt. Er gilt
        24&nbsp;Stunden.
      </p>
      <p className="text-[13px] text-muted-foreground">
        Du hast schon ein Konto? Dann{' '}
        <Link href="/login" className={linkClass}>
          melde dich an
        </Link>{' '}
        oder{' '}
        <Link href="/forgot-password" className={linkClass}>
          setze dein Passwort zurück
        </Link>
        .
      </p>
      {warning && <FormNotice tone="warning">{warning}</FormNotice>}
      <Button type="button" variant="outline" onClick={resend} disabled={pending}>
        {pending ? 'Wird gesendet …' : 'Mail erneut senden'}
      </Button>
    </div>
  )
}
