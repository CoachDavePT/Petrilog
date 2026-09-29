'use client'

// „Session starten" at /sessions/new (PROJ-2: AC-6 – AC-8, AC-36, AC-37, EC-2, EC-3; design.md →
// Session starten, Standort, Doppeltes Speichern). The start time is the server's „now"; the form sends
// water name, note, its own id and the position. The id is made once when the form opens and goes with
// every attempt, so a double tap or a retry never creates a second session. The position is asked for
// only in the submit step — never on opening the page — and kept for a retry after a lost connection
// (`undefined` = not asked yet, `null` = asked, none). Success redirects (server side) to the detail view.
import { useRef, useState } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FormNotice } from '@/components/auth/form-notice'
import { useServerAction } from '@/components/forms/use-server-action'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { startSession } from '@/lib/fishing/actions/sessions'
import { noteSchema, waterNameSchema } from '@/lib/fishing/schemas'
import { useLocation, type Position } from './use-location'
import { WaterNameInput } from './water-name-input'
import { newEntryId } from '@/lib/fishing/entry-id'

export const LOCATING_LABEL = 'Position wird bestimmt …'

/**
 * A plain text field checked by the server's own field schema (whose input also allows null). Its
 * message becomes a non-aborting issue, so the form's cross-field rules still run alongside it.
 */
export function textField(rule: z.ZodType<unknown, string | null | undefined>) {
  return z.string().superRefine((value, ctx) => {
    const result = rule.safeParse(value)
    if (!result.success) ctx.addIssue({ code: 'custom', message: result.error.issues[0]?.message ?? '' })
  })
}

/** Browser-side rules — the very field schemas the server uses. */
const startFormSchema = z.object({
  waterName: textField(waterNameSchema),
  note: textField(noteSchema),
})

type StartFormValues = z.input<typeof startFormSchema>

/** A new entry's id, made once per opened form (EC-2). */
export function useEntryId(): string {
  const [id] = useState(newEntryId)
  return id
}

/** „(optional)" after a label. */
export function OptionalMark() {
  return <span className="font-normal text-muted-foreground"> (optional)</span>
}

const noteClassName =
  'min-h-[104px] rounded-lg bg-card px-4 py-3 text-base font-medium md:text-base focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-offset-0 aria-invalid:border-destructive'

/**
 * Gewässername (with the user's own earlier names as suggestions) and Notiz — shared by start,
 * backfill and edit. Must sit inside a `<Form>` whose values have `waterName` and `note` as strings.
 */
export function SessionTextFields({ suggestions }: { suggestions: readonly string[] }) {
  const { control } = useFormContext<{ waterName: string; note: string }>()
  return (
    <>
      <FormField
        control={control}
        name="waterName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Gewässername
              <OptionalMark />
            </FormLabel>
            <FormControl>
              <WaterNameInput {...field} suggestions={suggestions} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Notiz
              <OptionalMark />
            </FormLabel>
            <FormControl>
              <Textarea rows={3} className={noteClassName} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}

type SessionStartFormProps = {
  /** The user's own distinct water names, most recently used first (at most 50). */
  suggestions: string[]
}

export function SessionStartForm({ suggestions }: SessionStartFormProps) {
  const id = useEntryId()
  const { requestPosition, locating, explainer } = useLocation()
  // undefined: not asked yet · null: asked, no position — kept for every retry (EC-3).
  const position = useRef<Position | null | undefined>(undefined)

  const form = useForm<StartFormValues>({
    resolver: zodResolver(startFormSchema, undefined, { raw: true }),
    defaultValues: { waterName: '', note: '' },
  })
  const { submit, pending, notice } = useServerAction(form, startSession, {
    prepare: async (values) => {
      if (position.current === undefined) position.current = await requestPosition()
      return { id, waterName: values.waterName, note: values.note, position: position.current }
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={submit} method="post" noValidate className="flex flex-1 flex-col gap-5">
        <SessionTextFields suggestions={suggestions} />

        <div className="mt-auto flex flex-col gap-3 pt-3">
          {notice && <FormNotice tone={notice.tone}>{notice.text}</FormNotice>}
          <Button type="submit" size="lg" className="w-full" disabled={pending || locating}>
            {locating ? LOCATING_LABEL : pending ? 'Wird gestartet …' : 'Starten'}
          </Button>
        </div>
      </form>
      {explainer}
    </Form>
  )
}
