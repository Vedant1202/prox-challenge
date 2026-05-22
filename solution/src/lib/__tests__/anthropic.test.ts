import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveModel, ALLOWED_MODELS } from '../anthropic'

describe('resolveModel', () => {
  const originalEnv = process.env.DEFAULT_MODEL

  afterEach(() => {
    process.env.DEFAULT_MODEL = originalEnv
    vi.unstubAllEnvs()
  })

  it('returns the default model when no argument is passed', () => {
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    const result = resolveModel()
    expect(result).toBe('claude-sonnet-4-6')
  })

  it('returns the default model when null is passed', () => {
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    expect(resolveModel(null)).toBe('claude-sonnet-4-6')
  })

  it('returns the default model when undefined is passed', () => {
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    expect(resolveModel(undefined)).toBe('claude-sonnet-4-6')
  })

  it('returns a valid requested model if it is in ALLOWED_MODELS', () => {
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    expect(resolveModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001')
  })

  it('falls back to default for an unknown model string', () => {
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    expect(resolveModel('gpt-4o')).toBe('claude-sonnet-4-6')
  })

  it('falls back to hardcoded default when DEFAULT_MODEL env is not set', () => {
    vi.stubEnv('DEFAULT_MODEL', '')
    // Empty string is falsy-ish but still a string — resolveModel returns it.
    // The true "unset" case falls back to the ?? default.
    delete process.env.DEFAULT_MODEL
    expect(resolveModel()).toBe('claude-sonnet-4-6')
  })

  it('ALLOWED_MODELS contains at least sonnet and haiku', () => {
    expect(ALLOWED_MODELS).toContain('claude-sonnet-4-6')
    expect(ALLOWED_MODELS).toContain('claude-haiku-4-5-20251001')
  })
})
