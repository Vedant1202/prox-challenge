import {
  countRateLimitEntries,
  getOldestRateLimitTimestamp,
  pruneRateLimitEntries,
  recordRateLimitEntry,
} from './storage'

export interface RateLimitResult {
  allowed: boolean
  used: number
  limit: number
  reset_at: number
  retry_after_ms: number
}

export async function checkRateLimit(clientKey: string): Promise<RateLimitResult> {
  const limit = parseInt(process.env.RATE_LIMIT_REQUESTS ?? '10', 10)
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES ?? '60', 10)
  const windowMs = windowMinutes * 60 * 1000
  const now = Date.now()
  const cutoff = now - windowMs

  // Remove entries outside the rolling window
  await pruneRateLimitEntries(clientKey, cutoff)

  // Count remaining entries in window
  const used = await countRateLimitEntries(clientKey)

  if (used >= limit) {
    // Find the oldest entry — once it ages out, the window reopens
    const oldest = await getOldestRateLimitTimestamp(clientKey)
    const reset_at = oldest ? oldest + windowMs : now + windowMs
    return { allowed: false, used, limit, reset_at, retry_after_ms: reset_at - now }
  }

  // Record this request
  await recordRateLimitEntry(clientKey, now)

  // reset_at = when the oldest entry in window expires
  const oldest = await getOldestRateLimitTimestamp(clientKey)
  const reset_at = oldest ? oldest + windowMs : now + windowMs

  return { allowed: true, used: used + 1, limit, reset_at, retry_after_ms: 0 }
}
