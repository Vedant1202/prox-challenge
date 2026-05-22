import { getDb } from './db'

export interface RateLimitResult {
  allowed: boolean
  used: number
  limit: number
  reset_at: number
  retry_after_ms: number
}

export function checkRateLimit(clientKey: string): RateLimitResult {
  const limit = parseInt(process.env.RATE_LIMIT_REQUESTS ?? '10', 10)
  const windowMinutes = parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES ?? '60', 10)
  const windowMs = windowMinutes * 60 * 1000
  const now = Date.now()
  const cutoff = now - windowMs

  const db = getDb()

  // Remove entries outside the rolling window
  db.prepare('DELETE FROM rate_limit WHERE client_key = ? AND timestamp < ?').run(clientKey, cutoff)

  // Count remaining entries in window
  const row = db.prepare('SELECT COUNT(*) as count FROM rate_limit WHERE client_key = ?').get(clientKey) as { count: number }
  const used = row.count

  if (used >= limit) {
    // Find the oldest entry — once it ages out, the window reopens
    const oldest = db.prepare('SELECT timestamp FROM rate_limit WHERE client_key = ? ORDER BY timestamp ASC LIMIT 1').get(clientKey) as { timestamp: number } | undefined
    const reset_at = oldest ? oldest.timestamp + windowMs : now + windowMs
    return { allowed: false, used, limit, reset_at, retry_after_ms: reset_at - now }
  }

  // Record this request
  db.prepare('INSERT INTO rate_limit (client_key, timestamp) VALUES (?, ?)').run(clientKey, now)

  // reset_at = when the oldest entry in window expires
  const oldest = db.prepare('SELECT timestamp FROM rate_limit WHERE client_key = ? ORDER BY timestamp ASC LIMIT 1').get(clientKey) as { timestamp: number } | undefined
  const reset_at = oldest ? oldest.timestamp + windowMs : now + windowMs

  return { allowed: true, used: used + 1, limit, reset_at, retry_after_ms: 0 }
}
