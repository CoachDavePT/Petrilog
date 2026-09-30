'use client'

// The menu in the compact AppBar of the session detail view (PROJ-2: AC-17, AC-19; design.md →
// Seiten und Adressen, Komponenten-Struktur): „Bearbeiten" opens `/sessions/<id>/edit`, „Session
// löschen" opens the confirmation dialog. The dialog is opened controlled from the item's `onSelect`,
// and the menu is non-modal, so closing the menu does not fight the dialog for focus.
import { useState } from 'react'
import Link from 'next/link'
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react'
import { appBarIconClass } from '@/components/shell/app-bar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteSessionDialog } from './delete-session-dialog'

export type SessionDetailMenuProps = {
  id: string
  catchCount: number
}

export function SessionDetailMenu({ id, catchCount }: SessionDetailMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className={appBarIconClass} aria-label="Weitere Aktionen">
          <EllipsisVertical className="size-6" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem asChild className="min-h-11 gap-2 text-[15px]">
            <Link href={`/sessions/${id}/edit`}>
              <Pencil aria-hidden className="size-4" />
              Bearbeiten
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-11 gap-2 text-[15px] text-destructive focus:text-destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden className="size-4" />
            Session löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteSessionDialog id={id} catchCount={catchCount} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  )
}
