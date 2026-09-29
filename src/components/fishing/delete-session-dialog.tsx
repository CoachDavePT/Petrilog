'use client'

// „Session löschen?" (PROJ-2: AC-19; design.md → Session löschen). Names how many catches go with the
// session; „Löschen" calls the Server Action, which redirects to `/?notice=session-deleted` (or
// `/?notice=session-gone`). Stays open with a notice when it fails; cannot be closed while pending.
// Works with its own trigger or controlled (`open` / `onOpenChange`) — e.g. from a dropdown menu item
// in the compact AppBar.
import { useState, useTransition, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { FormNotice } from '@/components/auth/form-notice'
import { NETWORK_MESSAGE } from '@/components/forms/use-server-action'
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
import { deleteSession } from '@/lib/fishing/actions/sessions'
import { deleteSessionDescription, MESSAGES } from '@/lib/fishing/messages'

export type DeleteSessionDialogProps = {
  id: string
  catchCount: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Replaces the default „Session löschen" button. Omit when opening the dialog via `open`. */
  trigger?: ReactNode
}

export function DeleteSessionDialog({
  id,
  catchCount,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: DeleteSessionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : uncontrolledOpen
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const setOpen = (next: boolean) => {
    if (pending) return
    if (!next) setError(null)
    if (!controlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const confirm = () =>
    startTransition(async () => {
      setError(null)
      try {
        const result = await deleteSession({ id })
        // success redirects; only a failure comes back
        if (result && result.status === 'error') setError(result.message ?? MESSAGES.invalidInput)
      } catch {
        setError(NETWORK_MESSAGE)
      }
    })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : controlled ? null : (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
            <Trash2 aria-hidden />
            Session löschen
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="max-w-[400px]">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>{MESSAGES.deleteSessionTitle}</AlertDialogTitle>
          <AlertDialogDescription>{deleteSessionDescription(catchCount)}</AlertDialogDescription>
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
