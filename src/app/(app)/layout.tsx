// Layout of the logged-in app (docs/app-shell.md → Rahmen-Bausteine). PROJ-1 owns the login check;
// PROJ-2 adds the header, the tab bar and the active-session bar here.
import { requireUser } from '@/lib/auth/require-user'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return <div className="min-h-dvh bg-background">{children}</div>
}
