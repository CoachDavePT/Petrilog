'use client'

// Fischart-Auswahl (PROJ-2: AC-21). The 17 species in their fixed order; the user's up to 3 recently used
// species stand on top in their own group „Zuletzt“ and are not repeated below (a Select needs unique
// values). Built on the installed shadcn `select` (Radix: keyboard, screen reader, typeahead). Props that
// are not the value — id, aria-* from FormControl, onBlur, ref — land on the trigger button, so a
// react-hook-form FormField can wrap it like an Input.
import type { ComponentProps } from 'react'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { isSpeciesId, SPECIES, type SpeciesId } from '@/lib/fishing/species'
import { cn } from '@/lib/utils'

/** At most this many recent species are shown on top (design.md → Fang eintragen). */
export const RECENT_SPECIES_SHOWN = 3

type SpeciesSelectProps = Omit<ComponentProps<typeof SelectTrigger>, 'value' | 'defaultValue' | 'children'> & {
  /** The selected species id, `''` while none is chosen (shows the placeholder). */
  value: SpeciesId | ''
  onValueChange: (value: SpeciesId) => void
  /** Most recent first; invalid ids and duplicates are ignored, at most 3 are shown. */
  recentSpecies?: readonly string[]
  placeholder?: string
  disabled?: boolean
}

/** The recent species to show on top: valid, unique, at most 3, in the given order. */
export function pickRecentSpecies(recent: readonly string[] = []): SpeciesId[] {
  const out: SpeciesId[] = []
  for (const id of recent) {
    if (out.length >= RECENT_SPECIES_SHOWN) break
    if (isSpeciesId(id) && !out.includes(id)) out.push(id)
  }
  return out
}

const itemClass = 'min-h-11 py-2 text-base'

export function SpeciesSelect({
  value,
  onValueChange,
  recentSpecies,
  placeholder = 'Fischart wählen',
  disabled,
  className,
  ...triggerProps
}: SpeciesSelectProps) {
  const recent = pickRecentSpecies(recentSpecies)
  const rest = SPECIES.filter((s) => !recent.includes(s.id))
  const label = (id: SpeciesId) => SPECIES.find((s) => s.id === id)!.label

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isSpeciesId(next)) onValueChange(next)
      }}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          'h-13 rounded-lg bg-card px-4 text-base font-medium focus:ring-[3px] focus:ring-ring/60 focus:ring-offset-0 aria-invalid:border-destructive [&>svg]:size-5',
          className,
        )}
        {...triggerProps}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-lg">
        {recent.length > 0 && (
          <>
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Zuletzt
              </SelectLabel>
              {recent.map((id) => (
                <SelectItem key={id} value={id} className={itemClass}>
                  {label(id)}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
          </>
        )}
        <SelectGroup>
          {recent.length > 0 && (
            <SelectLabel className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Alle Arten
            </SelectLabel>
          )}
          {rest.map((s) => (
            <SelectItem key={s.id} value={s.id} className={itemClass}>
              {s.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
