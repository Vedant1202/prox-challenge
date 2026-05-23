'use client'

/**
 * ChatInput — the message compose bar at the bottom of the chat view.
 *
 * Features:
 *   - Auto-growing textarea (up to 120px)
 *   - Enter to send, Shift+Enter for newline
 *   - Disabled + placeholder text swap when rate-limited
 *   - Send button gradient reflects enabled/disabled state
 */
import { useRef } from 'react'

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: (text: string) => void
  disabled: boolean
  isRateLimited: boolean
  countdown: string | null
  hasMessages: boolean
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  isRateLimited,
  countdown,
  hasMessages,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(value)
    }
  }

  const canSend = value.trim() && !disabled && !isRateLimited

  return (
    <div
      className="flex-shrink-0 px-3 sm:px-5 pb-5 pt-3"
      style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}
    >
      <div className="input-glow">
        <div className="glass-card rounded-2xl px-4 py-2 flex items-end gap-2">
          {/* Auto-growing textarea */}
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRateLimited
                ? `Rate limit reached — try again in ${countdown ?? '…'}`
                : 'Ask about settings, troubleshooting, polarity, duty cycle…'
            }
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-sm text-base-content placeholder:text-base-content/35 resize-none leading-relaxed"
            style={{ maxHeight: 120, overflow: 'auto', paddingTop: 4, paddingBottom: 4 }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
            disabled={disabled || isRateLimited}
          />

          {/* Send button */}
          <button
            onClick={() => onSend(value)}
            disabled={!canSend}
            className="btn btn-sm btn-circle flex-shrink-0 border-none transition-all duration-150"
            style={{
              background: canSend
                ? 'linear-gradient(135deg, #7c3aed, #06b6d4)'
                : 'rgba(129,140,248,0.12)',
              color: canSend ? '#fff' : 'rgba(129,140,248,0.4)',
            }}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </div>

      {/* Keyboard hint — shown only after the first message */}
      {hasMessages && !isRateLimited && (
        <div className="text-center mt-2">
          <span className="text-xs text-base-content/30">
            Press Enter to send · Shift+Enter for new line
          </span>
        </div>
      )}
    </div>
  )
}
