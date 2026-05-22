import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'

// Must be declared before vi.mock so the factory closure captures it
let testDb: DatabaseSync

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
}))

// Import after mock is set up
import { checkRateLimit } from '../rate-limit'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rate_limit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_key TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit(client_key, timestamp);
`

beforeEach(() => {
  testDb = new DatabaseSync(':memory:')
  testDb.exec(SCHEMA)
  vi.stubEnv('RATE_LIMIT_REQUESTS', '3')
  vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '60')
  vi.useRealTimers()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('checkRateLimit', () => {
  it('allows the first request', () => {
    const result = checkRateLimit('client-a')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(1)
    expect(result.limit).toBe(3)
  })

  it('allows requests up to the limit', () => {
    checkRateLimit('client-b')
    checkRateLimit('client-b')
    const third = checkRateLimit('client-b')
    expect(third.allowed).toBe(true)
    expect(third.used).toBe(3)
  })

  it('blocks the request after the limit is reached', () => {
    checkRateLimit('client-c')
    checkRateLimit('client-c')
    checkRateLimit('client-c')
    const fourth = checkRateLimit('client-c')
    expect(fourth.allowed).toBe(false)
    expect(fourth.used).toBe(3)
    expect(fourth.retry_after_ms).toBeGreaterThan(0)
  })

  it('does not record a request when blocked', () => {
    checkRateLimit('client-d')
    checkRateLimit('client-d')
    checkRateLimit('client-d')
    checkRateLimit('client-d') // blocked
    const row = testDb.prepare('SELECT COUNT(*) as count FROM rate_limit WHERE client_key = ?').get('client-d') as { count: number }
    expect(row.count).toBe(3) // still 3, not 4
  })

  it('isolates counts per client key', () => {
    checkRateLimit('client-x')
    checkRateLimit('client-x')
    checkRateLimit('client-x')
    // client-y is independent
    const result = checkRateLimit('client-y')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(1)
  })

  it('reset_at is in the future', () => {
    const before = Date.now()
    const result = checkRateLimit('client-e')
    expect(result.reset_at).toBeGreaterThan(before)
  })

  it('retry_after_ms is 0 when allowed', () => {
    const result = checkRateLimit('client-f')
    expect(result.retry_after_ms).toBe(0)
  })

  it('evicts entries outside the rolling window', () => {
    vi.useFakeTimers()
    const start = Date.now()
    vi.setSystemTime(start)

    checkRateLimit('client-g')
    checkRateLimit('client-g')
    checkRateLimit('client-g')

    // Advance past the 60-min window
    vi.setSystemTime(start + 61 * 60 * 1000)

    const result = checkRateLimit('client-g')
    expect(result.allowed).toBe(true)
    expect(result.used).toBe(1)
  })
})
