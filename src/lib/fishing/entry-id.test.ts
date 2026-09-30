// /qa PROJ-2 (EC-2, EC-3): the id a create form makes when it opens. It must be a v4 UUID — the server
// accepts only valid UUIDs — on both paths: crypto.randomUUID, and the getRandomValues fallback for
// plain-http contexts (a phone on a LAN address) where randomUUID does not exist.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newEntryId } from './entry-id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('newEntryId', () => {
  it('returns a v4 UUID from crypto.randomUUID when it exists', () => {
    const id = newEntryId()
    expect(id).toMatch(UUID_V4)
  })

  it('returns a different id on every call (a new form never reuses an old id)', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newEntryId()))
    expect(ids.size).toBe(200)
  })

  it('falls back to getRandomValues and still produces a valid v4 UUID', () => {
    // No randomUUID (insecure context); bytes all 0xff so the version and variant bits must be forced.
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr.fill(0xff),
    })
    const id = newEntryId()
    expect(id).toMatch(UUID_V4)
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('fallback sets version 4 and variant 10xx even when the random bytes are all zero', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => arr.fill(0x00),
    })
    expect(newEntryId()).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('fallback maps each byte to two hex digits in order (8-4-4-4-12 layout)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        arr.forEach((_, i) => (arr[i] = i))
        return arr
      },
    })
    // byte 6 = 0x06 → 0x46, byte 8 = 0x08 → 0x88
    expect(newEntryId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })
})
