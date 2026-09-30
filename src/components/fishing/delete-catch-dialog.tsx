'use client'

// „Fang löschen?“ (PROJ-2: AC-28, AC-40). Opened from the right-side action of the compact AppBar in
// „Fang bearbeiten“. On success the Server Action redirects to `/sessions/<id>?notice=catch-deleted`
// (a deleted-meanwhile catch → `/?notice=session-gone`); the button stays locked until the page changes.
// A failure keeps the dialog open with a warning notice, so the user can try again.
import { useState, useTransition, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { FormNotice } from '@/components/auth/form-notice'
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
import { deleteCatch } from '@/lib/fishing/actions/catches'
import { MESSAGES } from '@/lib/fishing/messages'

type DeleteCatchDialogProps = {
  catchId: string
  /** The session the catch belongs to — a repeated delete leads back there. */
  sessionId?: string
  /** Replaces the default icon button (Trash, `aria-label="Fang löschen"`). Must accept a ref (asChild). */
  trigger?: ReactNode
}

export function DeleteCatchDialog({ catchId, sessionId, trigger }: DeleteCatchDialogProps) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const confirm = () =>
    startTransition(async () => {
      setError(null)
      try {
        const result = await deleteCatch({ id: catchId, sessionId })
        // No result: the action redirected — keep the dialog locked until the new page shows.
        if (result && result.status === 'error') setError(result.message ?? MESSAGES.network)
      } catch {
        setError(MESSAGES.network)
      }
    })

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="icon" aria-label="Fang löschen">
            <Trash2 aria-hidden />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[400px]">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{MESSAGES.deleteCatchTitle}</AlertDialogTitle>
          <AlertDialogDescription>{MESSAGES.deleteCatchDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <FormNotice tone="warning">{error}</FormNotice>}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>{MESSAGES.cancel}</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? 'Wird gelöscht …' : MESSAGES.delete}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
