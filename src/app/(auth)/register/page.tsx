import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Konto anlegen · Petrilog' }

export default function RegisterPage() {
  return <RegisterForm />
}
