import { describe, expect, it } from 'vitest'
import { clientIp } from './client-ip'

const h = (values: Record<string, string>) => ({ get: (n: string) => values[n] ?? null })

describe('clientIp without TRUSTED_CLIENT_IP_HEADER (AC-24, AC-26)', () => {
  it('ignores every header a caller can set, so a spoofed IP does not escape the limit', () => {
    const spoofed = h({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.2' })
    expect(clientIp(spoofed, undefined)).toBe('untrusted')
    expect(clientIp(spoofed, '')).toBe('untrusted')
    expect(clientIp(spoofed, '   ')).toBe('untrusted')
  })
})

describe('clientIp with TRUSTED_CLIENT_IP_HEADER', () => {
  it('reads only the named header', () => {
    const headers = h({ 'x-real-ip': ' 198.51.100.2 ', 'x-forwarded-for': '203.0.113.7' })
    expect(clientIp(headers, 'x-real-ip')).toBe('198.51.100.2')
    expect(clientIp(headers, 'X-Real-IP')).toBe('198.51.100.2')
  })

  it('takes the last x-forwarded-for entry — the one the proxy appended, not the caller', () => {
    expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 203.0.113.7' }), 'x-forwarded-for')).toBe('203.0.113.7')
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.7' }), 'x-forwarded-for')).toBe('203.0.113.7')
  })

  it('falls back to "untrusted" when the named header is missing or empty', () => {
    expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6' }), 'x-real-ip')).toBe('untrusted')
    expect(clientIp(h({ 'x-real-ip': '  ' }), 'x-real-ip')).toBe('untrusted')
    expect(clientIp(h({ 'x-forwarded-for': '6.6.6.6, ' }), 'x-forwarded-for')).toBe('untrusted')
  })

  it('never stores more than 45 characters', () => {
    expect(clientIp(h({ 'x-real-ip': 'a'.repeat(100) }), 'x-real-ip')).toHaveLength(45)
  })
})
