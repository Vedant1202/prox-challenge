import { describe, it, expect, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

afterEach(() => {
  vi.unstubAllEnvs()
})

async function callConfig() {
  // Dynamic import so env stubs are already in place when the module evaluates
  const { GET } = await import('../config/route')
  const req = new NextRequest('http://localhost/api/config')
  return GET(req)
}

describe('GET /api/config', () => {
  it('returns modelSwitchingAllowed true when env is "true"', async () => {
    vi.stubEnv('MODEL_SWITCHING_ALLOWED', 'true')
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    vi.stubEnv('RATE_LIMIT_REQUESTS', '10')
    vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '60')

    const res = await callConfig()
    const data = await res.json()
    expect(data.modelSwitchingAllowed).toBe(true)
  })

  it('returns modelSwitchingAllowed false when env is "false"', async () => {
    vi.stubEnv('MODEL_SWITCHING_ALLOWED', 'false')
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    vi.stubEnv('RATE_LIMIT_REQUESTS', '10')
    vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '60')

    const res = await callConfig()
    const data = await res.json()
    expect(data.modelSwitchingAllowed).toBe(false)
  })

  it('returns the configured default model', async () => {
    vi.stubEnv('MODEL_SWITCHING_ALLOWED', 'true')
    vi.stubEnv('DEFAULT_MODEL', 'claude-haiku-4-5-20251001')
    vi.stubEnv('RATE_LIMIT_REQUESTS', '10')
    vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '60')

    const res = await callConfig()
    const data = await res.json()
    expect(data.defaultModel).toBe('claude-haiku-4-5-20251001')
  })

  it('returns correct rateLimit shape', async () => {
    vi.stubEnv('MODEL_SWITCHING_ALLOWED', 'true')
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    vi.stubEnv('RATE_LIMIT_REQUESTS', '5')
    vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '30')

    const res = await callConfig()
    const data = await res.json()
    expect(data.rateLimit).toEqual({ requests: 5, windowMinutes: 30 })
  })

  it('responds with HTTP 200', async () => {
    vi.stubEnv('MODEL_SWITCHING_ALLOWED', 'true')
    vi.stubEnv('DEFAULT_MODEL', 'claude-sonnet-4-6')
    vi.stubEnv('RATE_LIMIT_REQUESTS', '10')
    vi.stubEnv('RATE_LIMIT_WINDOW_MINUTES', '60')

    const res = await callConfig()
    expect(res.status).toBe(200)
  })
})
