'use client'

// Submits a react-hook-form form to a Server Action (POST, fields are never cleared), keeps the
// button locked while it runs — including an optional `prepare` step such as locating the device —
// maps field errors back onto the fields and turns a lost connection into the warning notice
// (PROJ-2 design.md → Doppeltes Speichern und Verbindungsabbrüche). Shared by every feature's forms;
// knows nothing about auth.
import { useState, useTransition } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import type { NoticeTone } from '@/components/auth/form-notice'

/** What a Server Action returns to its form (redirects are thrown, not returned). Extensible. */
export type ServerActionResult =
  | { status: 'success'; message?: string }
  | { status: 'error'; message?: string; fieldErrors?: Partial<Record<string, string>> }

/** A caller may widen it (`N`) with extra fields — optional ones only: the hook creates plain ones too. */
export type ServerActionNotice = { tone: NoticeTone; text: string }

export const NETWORK_MESSAGE = 'Keine Verbindung. Bitte versuche es erneut.'

type SuccessOf<R> = Extract<R, { status: 'success' }>
type ErrorOf<R> = Extract<R, { status: 'error' }>

type BaseOptions<T, R, N> = {
  onSuccess?: (result: SuccessOf<R>, values: T) => void
  /** Turns an error result into the notice; default: its `message` in the warning tone. */
  toNotice?: (result: ErrorOf<R>) => N | null
  /** Shown when the request itself fails (lost connection). */
  networkMessage?: string
}

export type ServerActionOptions<T, V, R, N> = BaseOptions<T, R, N> & {
  /**
   * Builds what is sent from the validated form values — e.g. adds a client-generated id or a GPS
   * position captured at submit time. Throwing (or rejecting) cancels the submit: nothing is sent and
   * the notice stays as `prepare` left it (it may set its own via `setNotice`).
   */
  prepare?: (values: T) => V | Promise<V>
}

// Without `prepare` the action receives the form values as they are.
export function useServerAction<
  T extends FieldValues,
  R extends ServerActionResult,
  N extends ServerActionNotice = ServerActionNotice,
>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<R | void>,
  options?: BaseOptions<T, R, N> & { prepare?: undefined },
): ServerAction<N>
export function useServerAction<
  T extends FieldValues,
  V,
  R extends ServerActionResult,
  N extends ServerActionNotice = ServerActionNotice,
>(
  form: UseFormReturn<T>,
  action: (values: V) => Promise<R | void>,
  options: BaseOptions<T, R, N> & { prepare: (values: T) => V | Promise<V> },
): ServerAction<N>
export function useServerAction<
  T extends FieldValues,
  V,
  R extends ServerActionResult,
  N extends ServerActionNotice,
>(
  form: UseFormReturn<T>,
  action: (values: V) => Promise<R | void>,
  { onSuccess, toNotice, networkMessage = NETWORK_MESSAGE, prepare }: ServerActionOptions<T, V, R, N> = {},
): ServerAction<N> {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState<N | null>(null)

  const submit = form.handleSubmit((values) =>
    startTransition(async () => {
      setNotice(null)
      let payload: V
      try {
        payload = prepare ? await prepare(values) : (values as unknown as V)
      } catch {
        return // cancelled by `prepare` — its own notice (if any) stays
      }
      let result: R | void
      try {
        result = await action(payload)
      } catch {
        setNotice({ tone: 'warning', text: networkMessage } as N)
        return
      }
      if (!result) return // the action redirected
      if (result.status === 'success') {
        onSuccess?.(result as SuccessOf<R>, values)
        return
      }
      const error = result as ErrorOf<R>
      for (const [field, message] of Object.entries(error.fieldErrors ?? {})) {
        if (message && field in form.getValues()) form.setError(field as Path<T>, { message })
      }
      const next = toNotice ? toNotice(error) : error.message ? ({ tone: 'warning', text: error.message } as N) : null
      if (next) setNotice(next)
    }),
  )

  return { submit, pending, notice, setNotice }
}

export type ServerAction<N extends ServerActionNotice> = {
  submit: (event?: React.BaseSyntheticEvent) => Promise<void>
  pending: boolean
  notice: N | null
  setNotice: React.Dispatch<React.SetStateAction<N | null>>
}
