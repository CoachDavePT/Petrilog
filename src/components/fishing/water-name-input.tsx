'use client'

// Gewässername mit Vorschlagsliste (PROJ-2: AC-7, AC-34; design.md → Session starten). The page passes
// the user's own distinct water names (most recently used first, at most 50, read under Row Level
// Security); filtering happens here in the browser — no request while typing. Up to 5 names whose start
// (or the start of one of their words) matches the typed text, case-insensitive, in the order given.
// A tap fills the field. Plain buttons in a labelled list: reachable by keyboard and screen reader
// without a combobox widget.
import { useId, useMemo, useState, type ComponentProps, type FocusEvent, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const WATER_NAME_SUGGESTION_LIMIT = 5

const WORD_SEPARATOR = /[\s\-/(),.]+/

/**
 * The suggestions for `typed`: names that start with it — or have a word that does — ignoring case,
 * in the given order (most recent first), at most `limit`. Nothing for empty input, and never the name
 * exactly as typed (it is already in the field).
 */
export function matchWaterNames(
  names: readonly string[],
  typed: string,
  limit = WATER_NAME_SUGGESTION_LIMIT,
): string[] {
  const query = typed.trim().toLocaleLowerCase('de-DE')
  if (!query) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    if (out.length >= limit) break
    if (seen.has(name) || name === typed.trim()) continue
    const lower = name.toLocaleLowerCase('de-DE')
    const matches = lower.startsWith(query) || lower.split(WORD_SEPARATOR).some((word) => word.startsWith(query))
    if (!matches) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

type WaterNameInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string
  onChange: (value: string) => void
  /** The user's own earlier water names, most recently used first. */
  suggestions: readonly string[]
}

export function WaterNameInput({
  value,
  onChange,
  suggestions,
  onFocus,
  onBlur,
  onKeyDown,
  className,
  ...inputProps
}: WaterNameInputProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => matchWaterNames(suggestions, value), [suggestions, value])
  const showList = open && matches.length > 0

  // Closes only when focus leaves the whole block — tabbing from the field into the list keeps it open.
  const closeIfOutside = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2" onBlur={closeIfOutside}>
      <Input
        type="text"
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="next"
        {...inputProps}
        className={className}
        value={value}
        aria-controls={showList ? listId : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={(event) => {
          setOpen(true)
          onFocus?.(event)
        }}
        onBlur={onBlur}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Escape' && showList) {
            event.preventDefault()
            setOpen(false)
          }
          onKeyDown?.(event)
        }}
      />
      {showList && (
        <ul
          id={listId}
          aria-label="Frühere Gewässer"
          className="overflow-hidden rounded-lg border border-input bg-card shadow-sm"
        >
          {matches.map((name) => (
            <li key={name} className="border-b border-input last:border-b-0">
              <button
                type="button"
                // Keeps the focus in the field on tap, so the list does not close before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(name)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false)
                }}
                className={cn(
                  'flex min-h-11 w-full items-center px-4 py-2 text-left text-base font-medium',
                  'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/60',
                )}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
