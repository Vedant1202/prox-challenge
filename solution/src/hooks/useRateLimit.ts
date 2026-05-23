'use client'

/**
 * useRateLimit — manages rate-limit state and the countdown display.
 *
 * Tracks the current rate-limit window (used / limit / resetAt) and drives
 * a 1-second countdown ticker when the user is at the limit. The ticker is
 * cleared automatically when the window resets or the user is no longer limited.
 */
import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RateLimitState {
  used: number
  limit: number
  resetAt: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formats the time remaining until `resetAt` as "Xm Ys" or "Ys". */
export function formatCountdown(resetAt: number): string {
  const ms = Math.max(0, resetAt - Date.now())
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseRateLimitReturn {
  rateLimit: RateLimitState | null
  setRateLimit: (rl: RateLimitState | null) => void
  windowMinutes: number
  setWindowMinutes: (m: number) => void
  /** True when the user has exhausted their current rate-limit window. */
  isRateLimited: boolean
  /** Live countdown string ("2m 15s") or null when not rate-limited. */
  countdown: string | null
}

export function useRateLimit(): UseRateLimitReturn {
  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null)
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [countdown, setCountdown] = useState<string | null>(null)

  const isRateLimited = rateLimit !== null && rateLimit.used >= rateLimit.limit

  // Start / stop the 1-second countdown ticker based on rate-limit state
  useEffect(() => {
    if (!rateLimit || rateLimit.used < rateLimit.limit) {
      setCountdown(null)
      return
    }
    const tick = () => setCountdown(formatCountdown(rateLimit.resetAt))
    tick() // run immediately so there's no 1-second blank
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [rateLimit])

  return { rateLimit, setRateLimit, windowMinutes, setWindowMinutes, isRateLimited, countdown }
}
