// The fixed species list — PROJ-2 design.md → Datenmodell → catches.species (AC-21). Ids are stored in
// the database and the export; labels are what the UI shows. The order is the order of the picker.

export const SPECIES = [
  { id: 'perch', label: 'Barsch' },
  { id: 'pike', label: 'Hecht' },
  { id: 'zander', label: 'Zander' },
  { id: 'eel', label: 'Aal' },
  { id: 'carp', label: 'Karpfen' },
  { id: 'tench', label: 'Schleie' },
  { id: 'bream', label: 'Brasse' },
  { id: 'roach', label: 'Rotauge' },
  { id: 'wels_catfish', label: 'Wels' },
  { id: 'brown_trout', label: 'Bachforelle' },
  { id: 'rainbow_trout', label: 'Regenbogenforelle' },
  { id: 'sea_trout', label: 'Meerforelle' },
  { id: 'cod', label: 'Dorsch' },
  { id: 'herring', label: 'Hering' },
  { id: 'garfish', label: 'Hornhecht' },
  { id: 'flatfish', label: 'Plattfisch' },
  { id: 'other', label: 'Sonstige' },
] as const

export type SpeciesId = (typeof SPECIES)[number]['id']

/** The 17 ids in picker order — the value list for `z.enum`. */
export const SPECIES_IDS = SPECIES.map((s) => s.id) as [SpeciesId, ...SpeciesId[]]

const LABELS: Record<string, string> = Object.fromEntries(SPECIES.map((s) => [s.id, s.label]))

export function isSpeciesId(value: unknown): value is SpeciesId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LABELS, value)
}

/** German label of a species id; `null` for anything that is not one of the 17 ids. */
export function speciesLabel(id: string): string | null {
  return isSpeciesId(id) ? LABELS[id] : null
}

/**
 * What a catch is called on screen: the label, or for `other` the name the user typed (falls back to
 * „Sonstige" if the name is missing).
 */
export function catchSpeciesName(entry: { species: string; species_other?: string | null }): string {
  if (entry.species === 'other') {
    const name = entry.species_other?.trim()
    if (name) return name
  }
  return speciesLabel(entry.species) ?? LABELS.other
}
