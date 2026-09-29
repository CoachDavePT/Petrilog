'use client'

// "Neue Mail anfordern" on /auth/link-expired (PROJ-1: EC-1, EC-2, AC-25) — neutral answer.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { requestNewLink } from '@/lib/auth/actions/mail'
import { emailOnlySchema, type EmailOnlyInput } from '@/lib/auth/schemas'
import { FormNotice } from './form-notice'
import { useAuthAction } from './use-auth-action'

export function RequestNewLinkForm({ type }: { type: 'signup' | 'recovery' }) {
  const [sent, setSent] = useState<string | null>(null)
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema), defaultValues: { email: '' } })
  const { submit, pending, notice } = useAuthAction(
    form,
    (values) => requestNewLink({ ...values, type }),
    (result) => setSent(result.message ?? null),
  )

  if (sent) return <FormNotice tone="success">{sent}</FormNotice>

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-4">
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
          {pending ? 'Wird gesendet …' : 'Neue Mail anfordern'}
        </Button>
      </form>
    </Form>
  )
}
