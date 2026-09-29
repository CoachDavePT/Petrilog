'use client'

// Signup form (PROJ-1: AC-1, AC-2, AC-5, AC-6, AC-26, AC-30, EC-5, EC-6). After sending, the same
// page shows "Prüfe dein Postfach" — the address never goes into the URL.
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { register } from '@/lib/auth/actions/register'
import { registerSchema, type RegisterInput } from '@/lib/auth/schemas'
import { CheckEmail } from './check-email'
import { FormNotice } from './form-notice'
import { PasswordInput } from './password-input'
import { useAuthAction } from './use-auth-action'

const linkClass =
  'rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60'

export function RegisterForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '' },
  })
  const { submit, pending, notice } = useAuthAction(form, register, (_result, values) =>
    setSentTo(values.email.trim().toLowerCase()),
  )

  if (sentTo) return <CheckEmail email={sentTo} />

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
        <h1 className="text-2xl font-medium">Konto anlegen</h1>

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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>Mindestens 8 Zeichen.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <p className="text-[13px] text-muted-foreground">
          Mit der Registrierung gilt unsere{' '}
          <Link href="/privacy" className={linkClass}>
            Datenschutzerklärung
          </Link>
          .
        </p>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Wird angelegt …' : 'Konto anlegen'}
        </Button>

        <p className="text-center text-[13px] text-muted-foreground">
          Schon ein Konto?{' '}
          <Link href="/login" className={linkClass}>
            Anmelden
          </Link>
        </p>
      </form>
    </Form>
  )
}
