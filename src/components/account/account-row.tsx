// One tappable row of the account page: a button (AccountRow) or a link styled the same
// (accountRowClass + AccountRowContent).
import * as React from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const accountRowClass =
  'flex min-h-14 w-full items-center gap-3 px-4 transition-colors duration-[120ms] hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/60'

export function AccountRowContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1 text-left font-medium">{label}</span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </>
  )
}

type AccountRowProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }

export const AccountRow = React.forwardRef<HTMLButtonElement, AccountRowProps>(
  ({ icon, label, className, ...props }, ref) => (
    <button ref={ref} type="button" className={cn(accountRowClass, className)} {...props}>
      <AccountRowContent icon={icon} label={label} />
    </button>
  ),
)
AccountRow.displayName = 'AccountRow'
