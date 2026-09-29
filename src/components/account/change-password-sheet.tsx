'use client'

// Konto → "Passwort ändern" as a bottom sheet (PROJ-1: AC-20, AC-21).
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { FormNotice } from '@/components/auth/form-notice'
import { PasswordInput } from '@/components/auth/password-input'
import { useAuthAction } from '@/components/auth/use-auth-action'
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { changePassword } from '@/lib/auth/actions/account'
import { MESSAGES } from '@/lib/auth/messages'
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/auth/schemas'
import { AccountRow } from './account-row'

export function ChangePasswordSheet() {
  const [open, setOpen] = useState(false)
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  })
  const { submit, pending, notice, setNotice } = useAuthAction(form, changePassword, (result) => {
    toast.success(result.message ?? MESSAGES.passwordChanged)
    setOpen(false)
    form.reset()
  })

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          form.reset()
          setNotice(null)
        }
      }}
    >
      <SheetTrigger asChild>
        <AccountRow icon={KeyRound} label="Passwort ändern" />
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-[440px] rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Passwort ändern</SheetTitle>
          <SheetDescription>Danach werden alle anderen Geräte abgemeldet.</SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={submit} method="post" noValidate className="mt-4 flex flex-col gap-5">
            {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aktuelles Passwort</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neues Passwort</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>Mindestens 8 Zeichen.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? 'Wird geändert …' : 'Passwort ändern'}
            </Button>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
