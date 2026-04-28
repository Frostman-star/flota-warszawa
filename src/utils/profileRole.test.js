import { describe, expect, it } from 'vitest'
import { normalizeProfileRole } from './profileRole'

describe('normalizeProfileRole', () => {
  it('returns empty string for nullish values', () => {
    expect(normalizeProfileRole(null)).toBe('')
    expect(normalizeProfileRole(undefined)).toBe('')
  })

  it('normalizes casing and whitespace for known roles', () => {
    expect(normalizeProfileRole(' Service ')).toBe('service')
    expect(normalizeProfileRole('ADMIN')).toBe('admin')
  })

  it('converts non-string values to normalized string', () => {
    expect(normalizeProfileRole(123)).toBe('123')
  })
})
