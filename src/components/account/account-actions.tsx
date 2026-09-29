// The rows of the account page (PROJ-1: AC-19, AC-22, AC-29).
import Link from 'next/link'
import { Download, LogOut, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logout } from '@/lib/auth/actions/session'
import { accountRowClass, AccountRowContent } from './account-row'
import { ChangePasswordSheet } from './change-password-sheet'
import { DeleteAccountDialog } from './delete-account-dialog'

export function AccountActions() {
  return (
    <div className="flex flex-col gap-6">
      <div className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-sm">
        <ChangePasswordSheet />
        {/* A plain GET download — no credentials involved; the endpoint checks the login itself. */}
        <a href="/account/export" download className={accountRowClass}>
          <AccountRowContent icon={Download} label="Meine Daten exportieren" />
        </a>
        <Link href="/privacy" className={accountRowClass}>
          <AccountRowContent icon={ShieldCheck} label="Datenschutz" />
        </Link>
      </div>

      <form action={logout}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          <LogOut aria-hidden />
          Abmelden
        </Button>
      </form>

      <DeleteAccountDialog />
    </div>
  )
}
