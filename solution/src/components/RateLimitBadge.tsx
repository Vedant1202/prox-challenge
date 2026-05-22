'use client'

import { useState } from 'react'

interface RateLimitBadgeProps {
  used: number
  limit: number
  resetAt: number
  windowMinutes: number
}

function formatResetTime(resetAt: number): string {
  const d = new Date(resetAt)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function RateLimitBadge({ used, limit, resetAt, windowMinutes }: RateLimitBadgeProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const remaining = Math.max(0, limit - used)
  const pct = Math.min(1, used / limit)
  const isLow = remaining <= Math.ceil(limit * 0.25)

  return (
    <div className="relative flex items-center gap-1.5">
      {/* Usage pill */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium select-none"
        style={{
          background: isLow
            ? 'rgba(239,68,68,0.12)'
            : 'rgba(129,140,248,0.10)',
          color: isLow ? '#ef4444' : 'var(--bc)',
          border: `1px solid ${isLow ? 'rgba(239,68,68,0.25)' : 'rgba(129,140,248,0.18)'}`,
        }}
      >
        {/* Mini bar */}
        <div
          className="rounded-full overflow-hidden"
          style={{ width: 28, height: 4, background: 'rgba(129,140,248,0.15)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct * 100}%`,
              background: isLow
                ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                : 'linear-gradient(90deg, #818cf8, #22d3ee)',
            }}
          />
        </div>
        <span className="text-base-content/70">
          {remaining}/{limit}
        </span>
        <span className="text-base-content/40 hidden sm:inline">
          · resets {formatResetTime(resetAt)}
        </span>
      </div>

      {/* Info button */}
      <button
        onClick={() => setPopoverOpen(v => !v)}
        className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-base-content/70"
        aria-label="Rate limit info"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="6" />
          <path d="M7 6.5v3.5M7 4.5v.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Popover */}
      {popoverOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopoverOpen(false)} />
          <div
            className="glass-card absolute right-0 top-9 z-50 rounded-xl px-4 py-3 text-xs shadow-xl"
            style={{ width: 240 }}
          >
            <div className="font-semibold text-base-content mb-1">Usage limits</div>
            <p className="text-base-content/60 leading-relaxed">
              To keep the demo fair, each device is limited to <strong className="text-base-content/80">{limit} messages per {windowMinutes} min</strong>.
              Your limit resets at <strong className="text-base-content/80">{formatResetTime(resetAt)}</strong>.
            </p>
            <p className="text-base-content/40 mt-2">
              {remaining} message{remaining !== 1 ? 's' : ''} remaining.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
