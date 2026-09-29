'use client'

// Konto → "Konto löschen" (PROJ-1: AC-27, AC-28, EC-11). Confirmed with the password; failures
// count toward the login lock.
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormNotice } from '@/components/auth/form-notice'
import { PasswordInput } from '@/components/auth/password-input'
import { useAuthAction } from '@/components/auth/use-auth-action'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { deleteAccount } from '@/lib/auth/actions/account'
import { deleteAccountSchema, type DeleteAccountInput } from '@/lib/auth/schemas'

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false)
  const form = useForm<DeleteAccountInput>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  })
  const { submit, pending, notice, setNotice } = useAuthAction(form, deleteAccount)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) {
          form.reset()
          setNotice(null)
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
          Konto löschen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[400px]">
        <Form {...form}>
          <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
            <AlertDialogHeader className="text-left">
              <AlertDialogTitle>Konto endgültig löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Dein Konto und alle Sessions, Fänge und Positionen werden sofort und endgültig gelöscht. Das lässt sich
                nicht rückgängig machen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Passwort zur Bestätigung</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? 'Wird gelöscht …' : 'Endgültig löschen'}
              </Button>
            </AlertDialogFooter>
          </form>
        </Form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
