'use client'

// Shows the success notice that a redirect announced (e.g. /?notice=password-changed) once, then
// removes the code from the address so a reload does not repeat it.
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function NoticeToast({ message }: { message: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (!message) return
    toast.success(message)
    router.replace(pathname, { scroll: false })
  }, [message, pathname, router])
  return null
}
