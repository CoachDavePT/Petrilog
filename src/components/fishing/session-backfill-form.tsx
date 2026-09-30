'use client'

// „Session nachtragen" at /sessions/backfill (PROJ-2: AC-13 – AC-16, AC-36, EC-2, EC-3; design.md →
// Session nachtragen und bearbeiten, Standort, Doppeltes Speichern). Creates an ended session. Start and
// end are Berlin date + time from native inputs, sent as ISO with offset. The position is asked for only
// when „Ich bin noch am Gewässer" is on, and only in the submit step; once asked it is kept for a retry
// (EC-3). The id is made once when the form opens (EC-2). Overlaps come back as the form-level message,
// time rule errors at the fields; success redirects (server side) to the detail view.
//
// Also home of the date + time field and the browser's session time rules, shared with the edit form.
import { useRef } from 'react'
import { useForm, useFormContext, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormNotice } from '@/components/auth/form-notice'
import { useServerAction } from '@/components/forms/use-server-action'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { backfillSession } from '@/lib/fishing/actions/sessions'
import { berlinLocalToIso, formatShortDateTime } from '@/lib/fishing/format'
import { MESSAGES } from '@/lib/fishing/messages'
import { backfillSessionSchema, noteSchema, sessionTimeErrors, waterNameSchema } from '@/lib/fishing/schemas'
import { WEATHER_MESSAGES } from '@/lib/weather/messages'
import { LOCATING_LABEL, SessionTextFields, textField, useEntryId } from './session-start-form'
import { useLocation, type Position } from './use-location'

// ---------------------------------------------------------------------------------------------------
// Date + time (shared with the edit form)

/** One point in time as the form holds it: Berlin date „2026-09-12" and time „14:05". */
export type LocalDateTime = { date: string; time: string }

export const EMPTY_DATE_TIME: LocalDateTime = { date: '', time: '' }

export const localDateTimeSchema = z.object({ date: z.string(), time: z.string() })

/** The form value as ISO instant with offset, or `null` when incomplete or impossible. */
export function localDateTimeToIso(value: LocalDateTime | undefined): string | null {
  return value ? berlinLocalToIso(value.date.trim(), value.time.trim()) : null
}

type TimeFields = { startedAt?: unknown; endedAt?: unknown }

function asLocal(value: unknown): LocalDateTime | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { date, time } = value as Record<string, unknown>
  return typeof date === 'string' && typeof time === 'string' ? { date, time } : undefined
}

/**
 * The session time rules the browser can check (AC-15, EC-9) — the server's own `sessionTimeErrors`
 * with the device clock; the server checks again with its clock, plus overlaps and catches. `withEnd`:
 * an ended session (end required) vs. a running one (start only). Messages land at `startedAt` /
 * `endedAt`, the names the server uses for its field errors.
 */
export function addSessionTimeIssues(values: TimeFields, ctx: z.RefinementCtx, withEnd: boolean, now = new Date()) {
  const start = localDateTimeToIso(asLocal(values.startedAt))
  const end = withEnd ? localDateTimeToIso(asLocal(values.endedAt)) : null
  if (!start) ctx.addIssue({ code: 'custom', path: ['startedAt'], message: MESSAGES.timeRequired })
  if (withEnd && !end) ctx.addIssue({ code: 'custom', path: ['endedAt'], message: MESSAGES.timeRequired })
  if (!start) return

  const errors = sessionTimeErrors(
    { startedAt: new Date(start), endedAt: end ? new Date(end) : null, now },
    formatShortDateTime,
  )
  if (errors.startedAt) ctx.addIssue({ code: 'custom', path: ['startedAt'], message: errors.startedAt })
  if (errors.endedAt) ctx.addIssue({ code: 'custom', path: ['endedAt'], message: errors.endedAt })
}

/** Runs the time rules even while another field (a too long name) has an error — all messages at once. */
export const checkTimesAlways = { when: (payload: { value: unknown }) => typeof payload.value === 'object' && payload.value !== null }

type SessionTimeFieldProps = {
  name: 'startedAt' | 'endedAt'
  label: string
  /** Called with the new date — the backfill form copies a start date into an empty end date. */
  onDateChange?: (date: string) => void
}

/**
 * Datum + Uhrzeit as one form field (value `LocalDateTime`), so an error for `startedAt` / `endedAt`
 * shows once, under both inputs. Must sit inside a `<Form>` that has this field.
 */
export function SessionTimeField({ name, label, onDateChange }: SessionTimeFieldProps) {
  const { control } = useFormContext<Record<'startedAt' | 'endedAt', LocalDateTime>>()
  return (
    <FormField
      control={control}
      name={name as FieldPath<Record<'startedAt' | 'endedAt', LocalDateTime>>}
      render={({ field, fieldState }) => {
        const value = (field.value as LocalDateTime | undefined) ?? EMPTY_DATE_TIME
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-2">
              <FormControl>
                <Input
                  ref={field.ref}
                  type="date"
                  name={`${name}Date`}
                  aria-label={`${label}: Datum`}
                  value={value.date}
                  onBlur={field.onBlur}
                  onChange={(event) => {
                    field.onChange({ ...value, date: event.target.value })
                    onDateChange?.(event.target.value)
                  }}
                />
              </FormControl>
              <Input
                type="time"
                name={`${name}Time`}
                aria-label={`${label}: Uhrzeit`}
                aria-invalid={fieldState.invalid}
                value={value.time}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange({ ...value, time: event.target.value })}
              />
            </div>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

// ---------------------------------------------------------------------------------------------------
// The backfill form

const backfillFormSchema = z
  .object({
    waterName: textField(waterNameSchema),
    note: textField(noteSchema),
    startedAt: localDateTimeSchema,
    endedAt: localDateTimeSchema,
    useCurrentPosition: z.boolean(),
  })
  .superRefine((values, ctx) => addSessionTimeIssues(values, ctx, true), checkTimesAlways)

type BackfillFormValues = z.input<typeof backfillFormSchema>

type SessionBackfillFormProps = {
  /** The user's own distinct water names, most recently used first (at most 50). */
  suggestions: string[]
}

export function SessionBackfillForm({ suggestions }: SessionBackfillFormProps) {
  const id = useEntryId()
  const { requestPosition, locating, explainer } = useLocation()
  // undefined: not asked yet · null: asked, no position — kept for every retry (EC-3).
  const position = useRef<Position | null | undefined>(undefined)

  const form = useForm<BackfillFormValues>({
    resolver: zodResolver(backfillFormSchema, undefined, { raw: true }),
    defaultValues: {
      waterName: '',
      note: '',
      startedAt: EMPTY_DATE_TIME,
      endedAt: EMPTY_DATE_TIME,
      useCurrentPosition: false,
    },
  })
  const { submit, pending, notice } = useServerAction(form, backfillSession, {
    prepare: async (values) => {
      // Only with the switch on is the device asked at all (AC-14, AC-36).
      if (values.useCurrentPosition && position.current === undefined) position.current = await requestPosition()
      return {
        id,
        waterName: values.waterName,
        note: values.note,
        startedAt: localDateTimeToIso(values.startedAt) ?? '',
        endedAt: localDateTimeToIso(values.endedAt) ?? '',
        useCurrentPosition: values.useCurrentPosition,
        position: values.useCurrentPosition ? (position.current ?? null) : null,
      } satisfies z.input<typeof backfillSessionSchema>
    },
  })

  // Most sessions end on the day they start: a start date fills an end date that is still empty.
  const copyStartDate = (date: string) => {
    const end = form.getValues('endedAt')
    if (date && !end.date) form.setValue('endedAt', { ...end, date })
  }

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-1 flex-col gap-5">
        <SessionTimeField name="startedAt" label="Start" onDateChange={copyStartDate} />
        <SessionTimeField name="endedAt" label="Ende" />
        <SessionTextFields suggestions={suggestions} />

        <FormField
          control={form.control}
          name="useCurrentPosition"
          render={({ field }) => (
            <FormItem>
              <div className="flex min-h-13 items-center justify-between gap-4 rounded-lg border border-input bg-card px-4 py-3">
                <FormLabel className="text-[15px] font-medium leading-snug">
                  Ich bin noch am Gewässer: aktuelle Position verwenden
                </FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
                </FormControl>
              </div>
              <FormDescription className="text-xs">
                Ausgeschaltet wird die Session ohne Position gespeichert.
              </FormDescription>
              {/* PROJ-3 AC-18: with a position, the weather of back then is fetched after saving */}
              {field.value && (
                <FormNotice tone="info">
                  <strong className="font-semibold">{WEATHER_MESSAGES.backfillTitle}:</strong>{' '}
                  {WEATHER_MESSAGES.backfillText}
                </FormNotice>
              )}
            </FormItem>
          )}
        />

        <div className="mt-auto flex flex-col gap-3 pt-3">
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <Button type="submit" size="lg" className="w-full" disabled={pending || locating}>
            {locating ? LOCATING_LABEL : pending ? 'Wird gespeichert …' : 'Session speichern'}
          </Button>
        </div>
      </form>
      {explainer}
    </Form>
  )
}
