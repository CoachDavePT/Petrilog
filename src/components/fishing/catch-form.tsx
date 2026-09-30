'use client'

// „Fang eintragen“ (running session), „Fang nachtragen“ (ended session) and „Fang bearbeiten“ — PROJ-2
// design.md → Fang eintragen, nachtragen, bearbeiten · Standort · Doppeltes Speichern · Position entfernen
// (AC-20 – AC-27, AC-38, EC-2, EC-3, EC-4, EC-10).
//
// - The browser checks with the SAME Zod schema the Server Action uses (createCatchSchema /
//   editCatchSchema), applied to exactly the payload that would be sent — so messages match the server's.
// - Create: the catch id is generated once when the form opens and sent on every attempt (EC-2). In a
//   running session the position is requested only in the submit's `prepare` step and remembered for
//   retries (`undefined` = not asked yet, `null` = none, EC-3); an ended session never asks (AC-26).
// - Nothing is ever cleared: server field errors land on the fields, a lost connection shows the notice.
// The page title is the page's job: running → „Fang eintragen“, ended → „Fang nachtragen“, edit →
// „Fang bearbeiten“ (the delete action goes into the AppBar: DeleteCatchDialog).
import { useId, useRef, useState, useTransition, type ComponentProps } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  createCatch,
  removeCatchPosition,
  updateCatch,
  type CreateCatchActionInput,
  type EditCatchActionInput,
} from '@/lib/fishing/actions/catches'
import {
  berlinLocalToIso,
  formatAccuracy,
  formatCoordinates,
  formatDateTime,
  formatEndTime,
  isoToBerlinLocal,
} from '@/lib/fishing/format'
import { MESSAGES } from '@/lib/fishing/messages'
import type { CatchDetail, CatchPrefill, PositionSource } from '@/lib/fishing/queries'
import { createCatchSchema, editCatchSchema, fieldErrors } from '@/lib/fishing/schemas'
import type { SpeciesId } from '@/lib/fishing/species'
import { cn } from '@/lib/utils'
import { RemovePositionDialog } from './remove-position-dialog'
import { SpeciesSelect } from './species-select'
import { useLocation, type Position } from './use-location'
import { newEntryId } from '@/lib/fishing/entry-id'

type CatchFormSession = { id: string; startedAt: string; endedAt: string | null }

type CommonProps = {
  session: CatchFormSession
  /** The user's recently used species, most recent first (up to 3 are shown on top). */
  recentSpecies: SpeciesId[]
}

export type CatchFormProps =
  | (CommonProps & {
      mode: 'create'
      /** Bait and released/kept of the session's most recently created catch (AC-23); null → defaults. */
      prefill: CatchPrefill | null
      /** Running session: the minute the page was loaded — the default catch time. */
      initialNow?: string
      catch?: undefined
    })
  | (CommonProps & {
      mode: 'edit'
      catch: CatchDetail
      prefill?: undefined
      initialNow?: undefined
    })

/** What the form holds — raw strings as typed; converted into the action input only on submit. */
export type CatchFormValues = {
  /** One field for the pair, so the server's `caughtAt` error lands on it. */
  caughtAt: { date: string; time: string }
  species: SpeciesId | ''
  speciesOther: string
  lengthCm: string
  weightG: string
  bait: string
  released: boolean
}

type CatchFields = Omit<EditCatchActionInput, 'id' | 'sessionId'>

/** The form values as the actions take them (the schemas trim, parse digits and drop an unused name). */
function toCatchFields(values: CatchFormValues): CatchFields {
  const { date, time } = values.caughtAt
  return {
    caughtAt: date.trim() && time.trim() ? (berlinLocalToIso(date.trim(), time.trim()) ?? '') : '',
    // '' only reaches the schema, which answers „Bitte wähle eine Fischart."
    species: values.species as SpeciesId,
    speciesOther: values.species === 'other' ? values.speciesOther : undefined,
    lengthCm: values.lengthCm,
    weightG: values.weightG,
    bait: values.bait,
    released: values.released,
  }
}

/**
 * Browser-side check with the action's own schema. Only field messages are shown here; anything the user
 * cannot fix at a field (a broken id, say) is left to the server's general message.
 */
function catchFormResolver(mode: 'create' | 'edit', ids: { id: string; sessionId: string }) {
  const schema = z.custom<CatchFormValues>().superRefine((values, ctx) => {
    const payload = { ...ids, ...toCatchFields(values) }
    const result = mode === 'create' ? createCatchSchema.safeParse(payload) : editCatchSchema.safeParse(payload)
    if (result.success) return
    for (const [key, message] of Object.entries(fieldErrors(result.error))) {
      if (message && key !== 'form' && key in values) ctx.addIssue({ code: 'custom', path: [key], message })
    }
  })
  return zodResolver(schema, undefined, { raw: true })
}

function defaultValues(props: CatchFormProps): CatchFormValues {
  if (props.mode === 'edit') {
    const entry = props.catch
    return {
      caughtAt: isoToBerlinLocal(entry.caughtAt),
      species: entry.species,
      speciesOther: entry.speciesOther ?? '',
      lengthCm: String(entry.lengthCm),
      weightG: entry.weightG === null ? '' : String(entry.weightG),
      bait: entry.bait ?? '',
      released: entry.released,
    }
  }
  const running = props.session.endedAt === null
  return {
    // Running: „jetzt" (minute at page load). Ended („Fang nachtragen"): empty, the user must pick it.
    caughtAt: running ? isoToBerlinLocal(props.initialNow ?? new Date()) : { date: '', time: '' },
    species: '',
    speciesOther: '',
    lengthCm: '',
    weightG: '',
    bait: props.prefill?.bait ?? '',
    // AC-23: the last catch's choice, else „Zurückgesetzt".
    released: props.prefill?.released ?? true,
  }
}

type Payload = { mode: 'create'; input: CreateCatchActionInput } | { mode: 'edit'; input: EditCatchActionInput }

function sendCatch(payload: Payload) {
  return payload.mode === 'create' ? createCatch(payload.input) : updateCatch(payload.input)
}

const SOURCE_LABEL: Record<PositionSource, string | null> = {
  gps: 'GPS',
  session: 'von der Session',
  none: null,
}

export function CatchForm(props: CatchFormProps) {
  const { mode, session, recentSpecies } = props
  const entry = props.mode === 'edit' ? props.catch : undefined
  const running = session.endedAt === null
  // Opened for a running session: ask for the position on save and tell the server so (EC-4).
  const locate = mode === 'create' && running

  // EC-2: one id per opened form, sent on every attempt. EC-3: the position of the first attempt.
  const [catchId] = useState(() => entry?.id ?? newEntryId())
  const position = useRef<Position | null | undefined>(undefined)

  const [resolver] = useState(() =>
    catchFormResolver(mode, { id: catchId, sessionId: entry?.sessionId ?? session.id }),
  )
  const form = useForm<CatchFormValues>({ resolver, defaultValues: defaultValues(props) })
  const { requestPosition, locating, explainer } = useLocation()

  const { submit, pending, notice } = useServerAction(form, sendCatch, {
    prepare: async (values): Promise<Payload> => {
      const fields = toCatchFields(values)
      if (mode === 'edit') {
        return { mode, input: { id: catchId, sessionId: entry!.sessionId, ...fields } }
      }
      if (!locate) return { mode, input: { id: catchId, sessionId: session.id, ...fields } }
      if (position.current === undefined) position.current = await requestPosition()
      return {
        mode,
        input: { id: catchId, sessionId: session.id, ...fields, position: position.current, sessionWasRunning: true },
      }
    },
  })

  const species = useWatch({ control: form.control, name: 'species' })
  const submitLabel = locating
    ? 'Position wird bestimmt …'
    : pending
      ? 'Wird gespeichert …'
      : mode === 'edit'
        ? 'Speichern'
        : 'Fang speichern'

  const timeHint = session.endedAt
    ? `Session: ${formatDateTime(session.startedAt)} bis ${formatEndTime(session.startedAt, session.endedAt)}`
    : null

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-col gap-5">
        {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}

        <FormField
          control={form.control}
          name="caughtAt"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Fangzeit</FormLabel>
              <div role="group" aria-label="Fangzeit" className="grid grid-cols-[3fr_2fr] gap-3">
                <Input
                  ref={field.ref}
                  type="date"
                  aria-label="Datum"
                  aria-invalid={fieldState.invalid}
                  value={field.value.date}
                  onChange={(e) => field.onChange({ ...field.value, date: e.target.value })}
                  onBlur={field.onBlur}
                />
                <FormControl>
                  <Input
                    type="time"
                    aria-label="Uhrzeit"
                    value={field.value.time}
                    onChange={(e) => field.onChange({ ...field.value, time: e.target.value })}
                    onBlur={field.onBlur}
                  />
                </FormControl>
              </div>
              {timeHint && <FormDescription className="text-xs">{timeHint}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="species"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fischart</FormLabel>
              <FormControl>
                <SpeciesSelect
                  ref={field.ref}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  recentSpecies={recentSpecies}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {species === 'other' && (
          <FormField
            control={form.control}
            name="speciesOther"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Artname</FormLabel>
                <FormControl>
                  <Input autoComplete="off" autoCapitalize="sentences" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="lengthCm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Länge</FormLabel>
                <FormControl>
                  <UnitInput unit="cm" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weightG"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Gewicht <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <UnitInput unit="g" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="bait"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Köder <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input autoComplete="off" autoCapitalize="sentences" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="released"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  ref={field.ref}
                  aria-label="Zurückgesetzt oder entnommen"
                  value={field.value ? 'released' : 'kept'}
                  onValueChange={(next) => field.onChange(next === 'released')}
                  className="grid h-11 grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                >
                  <SegmentOption value="released" label="Zurückgesetzt" />
                  <SegmentOption value="kept" label="Entnommen" />
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {entry && <PositionRow catchId={entry.id} position={entry.position} source={entry.positionSource} />}

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
          {submitLabel}
        </Button>
      </form>
      {explainer}
    </Form>
  )
}

// ---------------------------------------------------------------------------------------------------
// Parts

/** Whole-number input with the unit inside the field (design-system → Formularfeld). */
function UnitInput({ unit, className, ...props }: ComponentProps<typeof Input> & { unit: string }) {
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className={cn('pr-12', className)}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-base text-muted-foreground"
      >
        {unit}
      </span>
    </div>
  )
}

/** One half of the „Zurückgesetzt / Entnommen" segment — a radio, styled as a 44 px segment. */
function SegmentOption({ value, label }: { value: 'released' | 'kept'; label: string }) {
  const labelId = useId()
  return (
    <Label
      className={cn(
        'flex h-full cursor-pointer items-center justify-center rounded-md text-[15px] font-semibold text-muted-foreground transition-colors duration-[120ms]',
        'hover:text-foreground has-[[data-state=checked]]:bg-card has-[[data-state=checked]]:text-foreground has-[[data-state=checked]]:shadow-sm',
        'has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/60',
      )}
    >
      <RadioGroupItem value={value} aria-labelledby={labelId} className="sr-only" />
      <span id={labelId}>{label}</span>
    </Label>
  )
}

/** Edit only: where the catch was, and „Position entfernen" while there is one (AC-38). */
function PositionRow({
  catchId,
  position: initial,
  source,
}: {
  catchId: string
  position: Position | null
  source: PositionSource
}) {
  const headingId = useId()
  const [removed, setRemoved] = useState(false)
  const [removing, startRemoving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const position = removed ? null : initial
  const sourceLabel = SOURCE_LABEL[source]

  // Always resolves: the dialog closes and the outcome shows here, not hidden behind the modal.
  const remove = () =>
    new Promise<void>((resolve) => {
      startRemoving(async () => {
        setError(null)
        try {
          const result = await removeCatchPosition({ id: catchId })
          if (result?.status === 'success') setRemoved(true)
          else if (result?.status === 'error') setError(result.message ?? MESSAGES.network)
        } catch {
          setError(MESSAGES.network)
        }
        resolve()
      })
    })

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-sm font-medium leading-none">
        Position
      </h2>
      {position ? (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[13px] text-foreground">
            {formatCoordinates(position.latitude, position.longitude)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatAccuracy(position.accuracy)}
            {sourceLabel && ` · ${sourceLabel}`}
          </p>
        </div>
      ) : (
        <p className="text-[15px] text-muted-foreground">Ohne Position</p>
      )}
      {error && <FormNotice tone="warning">{error}</FormNotice>}
      {position && (
        <div className="-ml-4">
          <RemovePositionDialog onConfirm={remove} pending={removing} />
        </div>
      )}
    </section>
  )
}
