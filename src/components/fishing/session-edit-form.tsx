'use client'

// „Session bearbeiten" at /sessions/[id]/edit (PROJ-2: AC-15 – AC-18, AC-38, EC-9; design.md → Session
// nachtragen und bearbeiten, Position entfernen). Water name, note and start; the end only for an ended
// session (a running one keeps running). The position never changes on save and is never requested
// here — the only thing to do with it is „Position entfernen" behind a confirmation. Overlaps and a
// catch that would fall outside come back as the form-level message, time rule errors at the fields;
// success redirects (server side) to the detail view with „Session gespeichert".
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, MapPinOff } from 'lucide-react'
import { z } from 'zod'
import { FormNotice } from '@/components/auth/form-notice'
import { NETWORK_MESSAGE, useServerAction } from '@/components/forms/use-server-action'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { removeSessionPosition, updateSession } from '@/lib/fishing/actions/sessions'
import { formatAccuracy, formatCoordinates, isoToBerlinLocal } from '@/lib/fishing/format'
import { editSessionSchema, noteSchema, waterNameSchema } from '@/lib/fishing/schemas'
import {
  addSessionTimeIssues,
  checkTimesAlways,
  localDateTimeSchema,
  localDateTimeToIso,
  SessionTimeField,
} from './session-backfill-form'
import { SessionTextFields, textField } from './session-start-form'
import { RemovePositionDialog } from './remove-position-dialog'
import type { Position } from './use-location'

export type EditableSession = {
  id: string
  /** ISO instant with offset, as stored. */
  startedAt: string
  /** `null` while the session is running. */
  endedAt: string | null
  waterName: string | null
  note: string | null
  position: Position | null
}

function editFormSchema(ended: boolean) {
  return z
    .object({
      waterName: textField(waterNameSchema),
      note: textField(noteSchema),
      startedAt: localDateTimeSchema,
      endedAt: localDateTimeSchema.optional(),
    })
    .superRefine((values, ctx) => addSessionTimeIssues(values, ctx, ended), checkTimesAlways)
}

type EditFormValues = z.input<ReturnType<typeof editFormSchema>>

type SessionEditFormProps = {
  session: EditableSession
  /** The user's own distinct water names, most recently used first (at most 50). */
  suggestions: string[]
}

export function SessionEditForm({ session, suggestions }: SessionEditFormProps) {
  const router = useRouter()
  const ended = session.endedAt !== null
  const [schema] = useState(() => editFormSchema(ended))

  const form = useForm<EditFormValues>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: {
      waterName: session.waterName ?? '',
      note: session.note ?? '',
      startedAt: isoToBerlinLocal(session.startedAt),
      // A running session has no end field at all — the key stays out of the form values.
      ...(session.endedAt !== null ? { endedAt: isoToBerlinLocal(session.endedAt) } : {}),
    },
  })
  const { submit, pending, notice, setNotice } = useServerAction(form, updateSession, {
    prepare: (values) =>
      ({
        id: session.id,
        waterName: values.waterName,
        note: values.note,
        startedAt: localDateTimeToIso(values.startedAt) ?? '',
        endedAt: ended ? (localDateTimeToIso(values.endedAt) ?? '') : undefined,
      }) satisfies z.input<typeof editSessionSchema>,
  })

  // „Position entfernen" (AC-38): the row turns to „Ohne Position" right away; the refresh brings the
  // page's own data in line. A failure closes the dialog and shows the notice in the form.
  const [positionRemoved, setPositionRemoved] = useState(false)
  const [removing, startRemoving] = useTransition()
  const position = positionRemoved ? null : session.position

  const removePosition = () =>
    new Promise<void>((resolve) => {
      startRemoving(async () => {
        setNotice(null)
        try {
          const result = await removeSessionPosition({ id: session.id })
          if (result?.status === 'success') {
            setPositionRemoved(true)
            router.refresh()
          } else if (result?.status === 'error') {
            setNotice({ tone: 'warning', text: result.message ?? NETWORK_MESSAGE })
          }
          // No result: the session is gone and the action redirected.
        } catch {
          setNotice({ tone: 'warning', text: NETWORK_MESSAGE })
        }
        resolve()
      })
    })

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-1 flex-col gap-5">
        <SessionTextFields suggestions={suggestions} />
        <SessionTimeField name="startedAt" label="Start" />
        {ended && <SessionTimeField name="endedAt" label="Ende" />}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-none">Position</span>
          <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-input bg-card px-4 py-2">
            {position ? (
              <p className="flex min-w-0 items-center gap-2 text-[13px]">
                <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="font-mono">{formatCoordinates(position.latitude, position.longitude)}</span>{' '}
                  <span className="whitespace-nowrap text-muted-foreground">{formatAccuracy(position.accuracy)}</span>
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2 text-[15px] text-muted-foreground">
                <MapPinOff aria-hidden className="size-4 shrink-0" />
                Ohne Position
              </p>
            )}
            {position && <RemovePositionDialog onConfirm={removePosition} pending={removing} />}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-3">
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <Button type="submit" size="lg" className="w-full" disabled={pending || removing}>
            {pending ? 'Wird gespeichert …' : 'Speichern'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
