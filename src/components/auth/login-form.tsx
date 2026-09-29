'use client'

// Login form (PROJ-1: AC-7 – AC-9, AC-23, AC-24, EC-5, EC-6).
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { resendConfirmation } from '@/lib/auth/actions/mail'
import { login } from '@/lib/auth/actions/session'
import { MESSAGES } from '@/lib/auth/messages'
import { loginSchema, type LoginInput } from '@/lib/auth/schemas'
import { FormNotice, type NoticeTone } from './form-notice'
import { PasswordInput } from './password-input'
import { useAuthAction } from './use-auth-action'

export function LoginForm({ initialNotice }: { initialNotice?: { tone: NoticeTone; text: string } | null }) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { submit, pending, notice, setNotice } = useAuthAction(form, login)
  const [resending, startResend] = useTransition()
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const shown = notice ?? initialNotice ?? null

  const resend = () =>
    startResend(async () => {
      setResendNotice(null)
      try {
        const result = await resendConfirmation({ email: form.getValues('email') })
        if (result.status === 'success') toast.success(result.message ?? MESSAGES.mailResent)
        else setResendNotice(result.message ?? MESSAGES.network)
      } catch {
        setResendNotice(MESSAGES.network)
      }
    })

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
        <h1 className="text-2xl font-medium">Anmelden</h1>

        {shown && (
          <div className="flex flex-col gap-3">
            <FormNotice tone={shown.tone}>{shown.text}</FormNotice>
            {notice?.unconfirmed && (
              <Button type="button" variant="outline" onClick={resend} disabled={resending}>
                Mail erneut senden
              </Button>
            )}
            {resendNotice && <FormNotice tone="warning">{resendNotice}</FormNotice>}
          </div>
        )}

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
                  onChange={(e) => {
                    field.onChange(e)
                    if (notice) setNotice(null)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Link
          href="/forgot-password"
          className="-mt-2 self-start rounded-sm text-[13px] font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          Passwort vergessen?
        </Link>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Wird angemeldet …' : 'Anmelden'}
        </Button>

        <p className="text-center text-[13px] text-muted-foreground">
          Noch kein Konto?{' '}
          <Link
            href="/register"
            className="rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            Konto anlegen
          </Link>
        </p>
      </form>
    </Form>
  )
}
