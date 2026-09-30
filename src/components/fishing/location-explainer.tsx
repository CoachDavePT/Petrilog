'use client'

// Standort-Erklärung (PROJ-2: AC-37). Shown by useLocation before the first position request on a
// device; the browser's own permission prompt only follows after "Weiter". Closing it any other way
// (Escape) means "no position" — saving still goes ahead. The privacy link opens in a new tab so the
// form behind the dialog keeps its input.
import { useRef } from 'react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export const LOCATION_EXPLAINER_TEXT =
  'Petrilog speichert beim Starten und bei jedem Fang deine Position, damit du später weißt, wo du gefangen hast. Nur du kannst sie sehen.'

type LocationExplainerProps = {
  open: boolean
  /** "Weiter" — continue to the browser's permission prompt. */
  onContinue: () => void
  /** Closed without "Weiter" (Escape). */
  onDismiss: () => void
}

export function LocationExplainer({ open, onContinue, onDismiss }: LocationExplainerProps) {
  const continueRef = useRef<HTMLButtonElement>(null)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <AlertDialogContent
        className="max-w-[400px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          continueRef.current?.focus()
        }}
      >
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="sr-only">Deine Position</AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-relaxed text-foreground">
            {LOCATION_EXPLAINER_TEXT}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Link
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center self-start rounded-sm text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          Datenschutz
        </Link>
        <AlertDialogFooter>
          <Button ref={continueRef} type="button" size="lg" className="w-full" onClick={onContinue}>
            Weiter
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
