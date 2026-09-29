'use client'

// The auth forms' binding of the shared form hook (components/forms/use-server-action.ts): POST
// submit, fields never cleared (EC-6), button locked while it runs (EC-5), field errors mapped back,
// lost connection as warning notice. Adds only the `unconfirmed` flag the login form reacts to.
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { useServerAction } from '@/components/forms/use-server-action'
import { MESSAGES } from '@/lib/auth/messages'
import type { ActionState } from '@/lib/auth/schemas'
import type { NoticeTone } from './form-notice'

export type Notice = { tone: NoticeTone; text: string; unconfirmed?: boolean }

export function useAuthAction<T extends FieldValues>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<ActionState | void>,
  onSuccess?: (result: Extract<ActionState, { status: 'success' }>, values: T) => void,
) {
  const { submit, pending, notice, setNotice } = useServerAction<T, ActionState, Notice>(form, action, {
    onSuccess,
    networkMessage: MESSAGES.network,
    toNotice: (result) =>
      result.message ? { tone: 'warning', text: result.message, unconfirmed: result.unconfirmed } : null,
  })
  return { submit, pending, notice, setNotice }
}
