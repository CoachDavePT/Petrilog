// Notice inside a form or page (docs/app-shell.md → Seitenmuster): warning tone for errors,
// success / info for confirmations. Announced to screen readers via role="alert" / "status".
import { CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export type NoticeTone = 'warning' | 'success' | 'info'

const ICONS = { warning: TriangleAlert, success: CircleCheck, info: Info } as const

export function FormNotice({
  tone,
  children,
}: {
  tone: NoticeTone
  children: React.ReactNode
}) {
  const Icon = ICONS[tone]
  return (
    <Alert variant={tone} role={tone === 'warning' ? 'alert' : 'status'}>
      <Icon aria-hidden />
      <AlertDescription className="text-[13px] leading-snug">{children}</AlertDescription>
    </Alert>
  )
}
