'use client'

// "Position entfernen" (PROJ-2: AC-38). Confirmation only — the caller passes the Server Action as
// onConfirm and the pending state. Works controlled (open/onOpenChange) or with its own trigger;
// uncontrolled, it closes once onConfirm resolves and stays open when it rejects (the caller shows
// the error). It cannot be closed while pending.
import { useState, type ReactNode } from 'react'
import { MapPinOff } from 'lucide-react'
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

type RemovePositionDialogProps = {
  onConfirm: () => void | Promise<unknown>
  pending?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Replaces the default "Position entfernen" button. Omit when opening the dialog via `open`. */
  trigger?: ReactNode
}

export function RemovePositionDialog({
  onConfirm,
  pending = false,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: RemovePositionDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : uncontrolledOpen

  const setOpen = (next: boolean) => {
    if (!controlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const confirm = () => {
    Promise.resolve(onConfirm()).then(
      () => {
        if (!controlled) setUncontrolledOpen(false)
      },
      () => {
        // stays open for a retry; the caller reports the failure
      },
    )
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
      }}
    >
      {trigger !== undefined ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : controlled ? null : (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
            <MapPinOff aria-hidden />
            Position entfernen
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent className="max-w-[400px]">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle>Position endgültig entfernen?</AlertDialogTitle>
          <AlertDialogDescription>
            Die Position wird endgültig gelöscht und der Eintrag gilt danach als „Ohne Position“. Eine neue Position
            lässt sich erst später mit der Karte setzen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? 'Wird entfernt …' : 'Entfernen'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
