'use client'

// "Neues Passwort festlegen" after the recovery link (PROJ-1: AC-17, AC-18, EC-6).
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
import { setNewPassword } from '@/lib/auth/actions/account'
import { newPasswordFormSchema, type NewPasswordInput } from '@/lib/auth/schemas'
import { FormNotice } from './form-notice'
import { PasswordInput } from './password-input'
import { useAuthAction } from './use-auth-action'

export function NewPasswordForm() {
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordFormSchema),
    defaultValues: { password: '' },
  })
  const { submit, pending, notice } = useAuthAction(form, setNewPassword)

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
        {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Neues Passwort</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>
                Mindestens 8 Zeichen. Danach werden alle anderen Geräte abgemeldet.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? 'Wird gespeichert …' : 'Passwort speichern'}
        </Button>
      </form>
    </Form>
  )
}
