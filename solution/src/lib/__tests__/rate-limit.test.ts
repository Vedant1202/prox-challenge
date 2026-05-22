import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  entries: [] as Array<{ client_key: string; timestamp: number }>,
}))

vi.mock('../storage', () => ({
  pruneRateLimitEntries: vi.fn(async (clientKey: string, cutoff: number) => {
    state.entries = state.entries.filter(entry => entry.client_key !== clientKey || entry.timestamp >= cutoff)
  }),
  countRateLimitEntries: vi.fn(async (clientKey: string) => (
    state.entries.filter(entry => entry.client_key === clientKey).length
  )),
  getOldestRateLimitTimestamp: vi.fn(async (clientKey: string) => {
    const oldest = state.entries
      .filter(entry => entry.client_key === clientKey)
      .sort((a, b) => a.timestamp - b.timestamp)[0]
    return oldest?.timestamp ?? null
  }),
  recordRateLimitEntry: vi.fn(async (clientKey: string, timestamp: number) => {
    state.entries.push({ client_key: clientKey, timestamp })
  }),
}))

import { checkRateLimit } from '../rate-limit'

beforeEach(() => {
  state.entries = []
  vi.stubEnv('RATE_LIMIT_REQUESTS', '3')
  vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '60')
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('checkRateLimit', () => {
  it('allows the first request', async () => {
    const result = await checkRateLimit('client-a')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(1)
    expect(result.limit).toBe(3)
  })

  it('allows requests up to the limit', async () => {
    await checkRateLimit('client-b')
    await checkRateLimit('client-b')
    const third = await checkRateLimit('client-b')
    expect(third.allowed).toBe(true)
    expect(third.used).toBe(3)
  })

  it('blocks the request after the limit is reached', async () => {
    await checkRateLimit('client-c')
    await checkRateLimit('client-c')
    await checkRateLimit('client-c')
    const fourth = await checkRateLimit('client-c')
    expect(fourth.allowed).toBe(false)
    expect(fourth.used).toBe(3)
    expect(fourth.retry_after_ms).toBeGreaterThan(0)
  })

  it('does not record a request when blocked', async () => {
    await checkRateLimit('client-d')
    await checkRateLimit('client-d')
    await checkRateLimit('client-d')
    await checkRateLimit('client-d') // blocked
    expect(state.entries.filter(entry => entry.client_key === 'client-d')).toHaveLength(3)
  })

  it('isolates counts per client key', async () => {
    await checkRateLimit('client-x')
    await checkRateLimit('client-x')
    await checkRateLimit('client-x')
    // client-y is independent
    const result = await checkRateLimit('client-y')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(1)
  })

  it('reset_at is in the future', async () => {
    const before = Date.now()
    const result = await checkRateLimit('client-e')
    expect(result.reset_at).toBeGreaterThan(before)
  })

  it('retry_after_ms is 0 when allowed', async () => {
    const result = await checkRateLimit('client-f')
    expect(result.retry_after_ms).toBe(0)
  })

  it('evicts entries outside the rolling window', async () => {
    vi.useFakeTimers()
    const start = Date.now()
    vi.setSystemTime(start)

    await checkRateLimit('client-g')
    await checkRateLimit('client-g')
    await checkRateLimit('client-g')

    // Advance past the 60-min window
    vi.setSystemTime(start + 61 * 60 * 1000)

    const result = await checkRateLimit('client-g')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(1)
  })
})
