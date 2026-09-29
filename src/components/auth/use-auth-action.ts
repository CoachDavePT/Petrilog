'use client'

// Submits a react-hook-form form to a Server Action (POST, fields are never cleared — EC-6), keeps
// the button locked while it runs (EC-5), maps field errors back onto the fields and turns a lost
// connection into the warning notice.
import { useState, useTransition } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { MESSAGES } from '@/lib/auth/messages'
import type { ActionState } from '@/lib/auth/schemas'
import type { NoticeTone } from './form-notice'

export type Notice = { tone: NoticeTone; text: string; unconfirmed?: boolean }

export function useAuthAction<T extends FieldValues>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<ActionState | void>,
  onSuccess?: (result: Extract<ActionState, { status: 'success' }>, values: T) => void,
) {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<Notice | null>(null)

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      setNotice(null)
      let result: ActionState | void
      try {
        result = await action(values)
      } catch {
        setNotice({ tone: 'warning', text: MESSAGES.network })
        return
      }
      if (!result) return // the action redirected
      if (result.status === 'success') {
        onSuccess?.(result, values)
        return
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (message && field in form.getValues()) form.setError(field as Path<T>, { message })
      }
      if (result.message) setNotice({ tone: 'warning', text: result.message, unconfirmed: result.unconfirmed })
    }),
  )

  return { submit, pending, notice, setNotice }
}
