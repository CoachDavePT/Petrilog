// /qa PROJ-2 (AC-21): the recently used species that stand on top of the picker — valid ids only,
// no duplicates (a Select needs unique values), at most 3, most recent first.
import { describe, expect, it } from 'vitest'
import { pickRecentSpecies, RECENT_SPECIES_SHOWN } from './species-select'

describe('pickRecentSpecies', () => {
  it('shows at most three recent species', () => {
    expect(RECENT_SPECIES_SHOWN).toBe(3)
  })

  it('keeps the given order (most recent first)', () => {
    expect(pickRecentSpecies(['zander', 'perch', 'pike'])).toEqual(['zander', 'perch', 'pike'])
  })

  it('cuts after three', () => {
    expect(pickRecentSpecies(['cod', 'herring', 'garfish', 'flatfish', 'eel'])).toEqual(['cod', 'herring', 'garfish'])
  })

  it('drops duplicates and keeps the first occurrence', () => {
    expect(pickRecentSpecies(['pike', 'pike', 'perch', 'pike', 'zander'])).toEqual(['pike', 'perch', 'zander'])
  })

  it('ignores ids that are not one of the 17 species, also inherited object keys', () => {
    expect(pickRecentSpecies(['salmon', 'toString', '', 'PIKE', 'pike', '__proto__', 'tench'])).toEqual([
      'pike',
      'tench',
    ])
  })

  it('invalid entries do not use up one of the three slots', () => {
    expect(pickRecentSpecies(['x', 'y', 'z', 'carp', 'bream', 'roach', 'eel'])).toEqual(['carp', 'bream', 'roach'])
  })

  it('includes „Sonstige" like any other species', () => {
    expect(pickRecentSpecies(['other', 'perch'])).toEqual(['other', 'perch'])
  })

  it('returns an empty list without recent species (first catch)', () => {
    expect(pickRecentSpecies()).toEqual([])
    expect(pickRecentSpecies([])).toEqual([])
  })
})
