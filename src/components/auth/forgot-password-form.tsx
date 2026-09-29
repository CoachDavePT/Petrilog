'use client'

// "Passwort vergessen" (PROJ-1: AC-16, AC-25, EC-6) — the confirmation is the same for every address.
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { requestPasswordReset } from '@/lib/auth/actions/mail'
import { emailOnlySchema, type EmailOnlyInput } from '@/lib/auth/schemas'
import { FormNotice } from './form-notice'
import { useAuthAction } from './use-auth-action'

const linkClass =
  'rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60'

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null)
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: '' } })
  const { submit, pending, notice } = useAuthAction(form, requestPasswordReset, (result) =>
    setSent(result.message ?? null),
  )

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-medium">Passwort vergessen</h1>
        <FormNotice tone="success">{sent}</FormNotice>
        <p className="text-[13px] text-muted-foreground">Der Link gilt 1 Stunde.</p>
        <Link href="/login" className={`${linkClass} self-start text-[15px]`}>
          Zurück zum Login
        </Link>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
        <h1 className="text-2xl font-medium">Passwort vergessen</h1>
        <p className="text-muted-foreground">
          Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.
        </p>

        {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail-Adresse</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Wird gesendet …' : 'Link senden'}
        </Button>

        <Link href="/login" className={`${linkClass} self-center text-[13px]`}>
          Zurück zum Login
        </Link>
      </form>
    </Form>
  )
}
