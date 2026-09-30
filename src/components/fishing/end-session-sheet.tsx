'use client'

// „Session beenden" as a bottom sheet (PROJ-2: AC-10, AC-12, EC-6; design.md → Session beenden).
// Three choices: „Jetzt" (preselected; not selectable after more than 48 h), „Zeit des letzten Fangs"
// (only with catches; preselected after 48 h) and „Eigene Uhrzeit" (Berlin date + time). The server
// checks every rule; its message for a custom time lands at the field, for the other two as a notice.
// Success redirects to `/sessions/<id>?notice=session-ended`.
//
// Works uncontrolled (own trigger, `defaultOpen` for `?end=1`) or controlled (`open` / `onOpenChange`).
// The form lives inside the sheet's content, which Radix mounts only while open and never on the
// server — so every opening starts fresh, and nothing time-dependent is rendered during SSR. Its clock
// is the server's (`serverNow`) carried forward, so „more than 48 h" matches what the server decides.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormNotice } from '@/components/auth/form-notice'
import { useServerAction, type ServerActionNotice } from '@/components/forms/use-server-action'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { endSession, type SessionActionResult } from '@/lib/fishing/actions/sessions'
import { berlinLocalToIso, formatShortDateTime, isoToBerlinLocal } from '@/lib/fishing/format'
import { MESSAGES } from '@/lib/fishing/messages'
import { END_MODES, SESSION_MAX_MS, type EndMode, type EndSessionInput } from '@/lib/fishing/schemas'

const CHOOSE_END = 'Bitte wähle, wann die Session endete.'

/** What the sheet's form holds. `endedAt` has no input — it only carries the error for the custom time. */
const endSheetSchema = z
  .object({
    mode: z.union([z.enum(END_MODES), z.literal('')], { error: CHOOSE_END }),
    date: z.string(),
    time: z.string(),
    endedAt: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === '') {
      ctx.addIssue({ code: 'custom', path: ['mode'], message: CHOOSE_END })
      return
    }
    if (v.mode !== 'custom') return
    if (!v.date || !v.time) ctx.addIssue({ code: 'custom', path: ['endedAt'], message: MESSAGES.timeRequired })
    else if (!berlinLocalToIso(v.date, v.time)) {
      ctx.addIssue({ code: 'custom', path: ['endedAt'], message: MESSAGES.invalidInput })
    }
  })

export type EndSheetValues = z.infer<typeof endSheetSchema>

const latestEnd = (startedAt: string) => new Date(new Date(startedAt).getTime() + SESSION_MAX_MS)

/** „Jetzt" is not selectable once the session has run longer than 48 hours (EC-6). */
export function isOverMaxDuration(startedAt: string, now: Date): boolean {
  return now.getTime() - new Date(startedAt).getTime() > SESSION_MAX_MS
}

/** The form's starting values at `now` (EC-6: after 48 h the last catch — or nothing — is preselected). */
export function endSheetDefaults(startedAt: string, lastCatchAt: string | null, now: Date): EndSheetValues {
  const over = isOverMaxDuration(startedAt, now)
  const mode: EndMode | '' = !over ? 'now' : lastCatchAt ? 'last-catch' : ''
  // „Eigene Uhrzeit" starts from a sensible point: now, or after 48 h the last catch / the start day
  const prefill = !over ? isoToBerlinLocal(now) : lastCatchAt ? isoToBerlinLocal(lastCatchAt) : null
  return {
    mode,
    date: prefill?.date ?? isoToBerlinLocal(startedAt).date,
    time: prefill?.time ?? '',
    endedAt: '',
  }
}

/** The allowed span, named in the sheet (AC-12). */
export function endSpanHint(startedAt: string, lastCatchAt: string | null, now: Date): string {
  const latest = formatShortDateTime(latestEnd(startedAt))
  const from = lastCatchAt
    ? `ab dem letzten Fang (${formatShortDateTime(lastCatchAt)})`
    : `nach dem Start (${formatShortDateTime(startedAt)})`
  const to = isOverMaxDuration(startedAt, now)
    ? `bis spätestens ${latest}, 48 Stunden nach dem Start`
    : `bis jetzt, höchstens 48 Stunden nach dem Start (${latest})`
  return `Möglich ist ein Ende ${from} ${to}.`
}

export type EndSessionSheetProps = {
  session: { id: string; startedAt: string }
  /** Time of the session's latest catch, `null` without catches. */
  lastCatchAt: string | null
  /** The server's „now" (ISO) at render time — the sheet's clock follows the server's, not the phone's. */
  serverNow: string
  /** Opens the sheet on the first render (the page passes it for `?end=1`). Uncontrolled only. */
  defaultOpen?: boolean
  /** Controlled mode — e.g. opened from the 12-hour notice or a menu. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Replaces the default „Session beenden" button. Omit when opening the sheet via `open`. */
  trigger?: ReactNode
}

export function EndSessionSheet({
  session,
  lastCatchAt,
  serverNow,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: EndSessionSheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const controlled = controlledOpen !== undefined
  const open = controlled ? controlledOpen : uncontrolledOpen
  // How far the server's clock is ahead of this device's (measured once; ~0 during SSR, unused there).
  const [clockOffset] = useState(() => Date.parse(serverNow) - Date.now())
  const locked = useRef(false)
  const handlePending = useCallback((pending: boolean) => {
    locked.current = pending
  }, [])

  const setOpen = (next: boolean) => {
    if (!next && locked.current) return // no closing while the end is being saved
    if (!controlled) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : controlled ? null : (
        <SheetTrigger asChild>
          <Button type="button" variant="outline" size="lg" className="w-full">
            Session beenden
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-[440px] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Session beenden</SheetTitle>
          <SheetDescription>Wann hast du aufgehört zu angeln?</SheetDescription>
        </SheetHeader>
        <EndSessionForm
          session={session}
          lastCatchAt={lastCatchAt}
          clockOffset={clockOffset}
          onPendingChange={handlePending}
        />
      </SheetContent>
    </Sheet>
  )
}

function EndSessionForm({
  session,
  lastCatchAt,
  clockOffset,
  onPendingChange,
}: {
  session: { id: string; startedAt: string }
  lastCatchAt: string | null
  clockOffset: number
  onPendingChange: (pending: boolean) => void
}) {
  // Mounted per opening, in the browser only: the choices are based on the moment the sheet opened.
  const [now] = useState(() => new Date(Date.now() + clockOffset))
  const over = isOverMaxDuration(session.startedAt, now)

  const form = useForm<EndSheetValues>({
    resolver: zodResolver(endSheetSchema),
    defaultValues: endSheetDefaults(session.startedAt, lastCatchAt, now),
  })

  const { submit, pending, notice, setNotice } = useServerAction<
    EndSheetValues,
    EndSessionInput,
    SessionActionResult,
    ServerActionNotice
  >(form, endSession, {
    prepare: (values) => {
      if (values.mode === '') throw new Error('no end chosen')
      if (values.mode !== 'custom') return { id: session.id, mode: values.mode }
      const endedAt = berlinLocalToIso(values.date, values.time)
      if (!endedAt) throw new Error('invalid end')
      return { id: session.id, mode: 'custom', endedAt }
    },
    toNotice: (result) => {
      if (result.message) return { tone: 'warning', text: result.message }
      // a rejected field the sheet has no input for (e.g. a broken id)
      const other = Object.keys(result.fieldErrors ?? {}).some((field) => field !== 'endedAt')
      return other ? { tone: 'warning', text: MESSAGES.invalidInput } : null
    },
  })

  useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])
  useEffect(() => () => onPendingChange(false), [onPendingChange])

  const mode = useWatch({ control: form.control, name: 'mode' })
  const customError = Boolean(form.formState.errors.endedAt)
  const startDate = isoToBerlinLocal(session.startedAt).date
  const maxDate = isoToBerlinLocal(over ? latestEnd(session.startedAt) : now).date
  const clearCustomError = () => {
    form.clearErrors('endedAt')
    setNotice(null)
  }

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="mt-4 flex flex-col gap-5">
        {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}

        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Ende der Session</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value)
                    clearCustomError()
                  }}
                  disabled={pending}
                  className="gap-2"
                >
                  <EndOption value="now" label="Jetzt" disabled={over}>
                    {over ? 'Nicht möglich: Die Session läuft seit über 48 Stunden.' : null}
                  </EndOption>
                  {lastCatchAt && (
                    <EndOption value="last-catch" label="Zeit des letzten Fangs">
                      {formatShortDateTime(lastCatchAt)}
                    </EndOption>
                  )}
                  <EndOption value="custom" label="Eigene Uhrzeit" />
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'custom' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={startDate}
                        max={maxDate}
                        disabled={pending}
                        aria-invalid={customError}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          clearCustomError()
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Uhrzeit</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        disabled={pending}
                        aria-invalid={customError}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          clearCustomError()
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="endedAt"
              render={() => (
                <FormItem>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <p className="text-xs leading-snug text-muted-foreground">{endSpanHint(session.startedAt, lastCatchAt, now)}</p>

        <Button type="submit" size="lg" className="w-full" disabled={pending || mode === ''}>
          {pending ? 'Wird beendet …' : 'Beenden'}
        </Button>
      </form>
    </Form>
  )
}

function EndOption({
  value,
  label,
  disabled = false,
  children,
}: {
  value: EndMode
  label: string
  disabled?: boolean
  children?: ReactNode
}) {
  const id = `${useId()}-${value}`
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg border border-input bg-card px-4 py-3 transition-colors duration-[120ms] ease-petrilog',
        'hover:bg-accent/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-amber-100 dark:has-[[data-state=checked]]:bg-amber-700',
        'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/60',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-card',
      )}
    >
      <RadioGroupItem id={id} value={value} disabled={disabled} className="size-5" />
      <span className="flex min-w-0 flex-col">
        <span className="text-[15px] font-semibold leading-tight">{label}</span>
        {children ? (
          <span className="text-[13px] leading-snug text-muted-foreground dark:text-sand-100">{children}</span>
        ) : null}
      </span>
    </label>
  )
}
