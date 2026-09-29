import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'
import { loginNoticeText, type LoginNotice } from '@/lib/auth/messages'

export const metadata: Metadata = { title: 'Anmelden · Petrilog' }

// ?notice= carries only a short code, never personal data (design.md → Seiten und Adressen).
const TONES: Record<LoginNotice, 'success' | 'info'> = {
  'account-deleted': 'success',
  'email-confirmed': 'success',
  'session-ended': 'info',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const { notice } = await searchParams
  const text = loginNoticeText(notice)
  const initialNotice = text ? { tone: TONES[notice as LoginNotice], text } : null
  return <LoginForm initialNotice={initialNotice} />
}
