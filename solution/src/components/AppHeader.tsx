'use client'

/**
 * AppHeader — the top bar of the chat view.
 *
 * Contains (left → right):
 *   - Mobile hamburger menu button
 *   - Vulcan OmniPro 220 branding / avatar
 *   - Spacer
 *   - Model selector (hidden when model-switching is disabled)
 *   - Rate limit badge (hidden when no rate-limit data)
 *   - Theme toggle
 */
import ModelSelector, { type Model } from '@/components/ModelSelector'
import RateLimitBadge from '@/components/RateLimitBadge'
import ThemeToggle from '@/components/ThemeToggle'
import type { RateLimitState } from '@/hooks/useRateLimit'

interface AppHeaderProps {
  model: Model
  onModelChange: (m: Model) => void
  modelSwitchingAllowed: boolean
  rateLimit: RateLimitState | null
  windowMinutes: number
  onMenuOpen: () => void
}

export default function AppHeader({
  model,
  onModelChange,
  modelSwitchingAllowed,
  rateLimit,
  windowMinutes,
  onMenuOpen,
}: AppHeaderProps) {
  return (
    // z-10 keeps the header above chat bubbles that create stacking contexts via backdrop-filter
    <header className="glass border-b flex items-center gap-3 px-4 py-3 flex-shrink-0 relative z-10">
      {/* Hamburger — mobile only */}
      <button
        className="sm:hidden btn btn-ghost btn-sm btn-circle flex-shrink-0"
        onClick={onMenuOpen}
        aria-label="Open menu"
      >
        <svg
          width="16" height="16" viewBox="0 0 16 16"
          fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        >
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>

      {/* Brand avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 13,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        V
      </div>

      {/* Product name */}
      <div className="min-w-0">
        <div className="font-semibold text-sm text-base-content truncate">
          Vulcan OmniPro 220
        </div>
        <div className="text-xs text-base-content/50 hidden sm:block">Welder Assistant</div>
      </div>

      <div className="flex-1" />

      <ModelSelector
        value={model}
        onChange={onModelChange}
        readOnly={!modelSwitchingAllowed}
      />

      {rateLimit && (
        <RateLimitBadge
          used={rateLimit.used}
          limit={rateLimit.limit}
          resetAt={rateLimit.resetAt}
          windowMinutes={windowMinutes}
        />
      )}

      <ThemeToggle />
    </header>
  )
}
