import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatRelativeTime, getImageUrl, getModifierKey, hasModifierKey } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-12T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for times less than a minute ago', () => {
    expect(formatRelativeTime('2026-03-12T11:59:30Z')).toBe('just now')
  })

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2026-03-12T11:45:00Z')).toBe('15m ago')
  })

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-03-12T09:00:00Z')).toBe('3h ago')
  })

  it('returns days ago', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00Z')).toBe('2d ago')
  })
})

describe('getImageUrl', () => {
  it('returns null for null input', () => {
    expect(getImageUrl(null)).toBeNull()
  })

  it('returns HTTP URLs as-is', () => {
    expect(getImageUrl('http://example.com/img.png')).toBe('http://example.com/img.png')
  })

  it('returns HTTPS URLs as-is', () => {
    expect(getImageUrl('https://example.com/img.png')).toBe('https://example.com/img.png')
  })

  it('converts local paths to API endpoint', () => {
    expect(getImageUrl('/screenshots/test.png')).toBe(
      '/api/images?path=%2Fscreenshots%2Ftest.png'
    )
  })

  it('encodes special characters in paths', () => {
    expect(getImageUrl('/path/with spaces/img.png')).toBe(
      '/api/images?path=%2Fpath%2Fwith%20spaces%2Fimg.png'
    )
  })
})

describe('getModifierKey', () => {
  it('returns Cmd on Mac platforms', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    expect(getModifierKey()).toBe('Cmd')
  })

  it('returns Ctrl on non-Mac platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    expect(getModifierKey()).toBe('Ctrl')
  })
})

describe('hasModifierKey', () => {
  it('checks metaKey on Mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel' })
    const event = { ctrlKey: false, metaKey: true } as KeyboardEvent
    expect(hasModifierKey(event)).toBe(true)
  })

  it('checks ctrlKey on non-Mac', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    const event = { ctrlKey: true, metaKey: false } as KeyboardEvent
    expect(hasModifierKey(event)).toBe(true)
  })

  it('returns false when no modifier pressed', () => {
    vi.stubGlobal('navigator', { platform: 'Win32' })
    const event = { ctrlKey: false, metaKey: false } as KeyboardEvent
    expect(hasModifierKey(event)).toBe(false)
  })
})
