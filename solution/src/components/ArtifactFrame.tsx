'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '@/lib/theme-context'

interface ArtifactFrameProps {
  html: string
  title?: string
  defaultExpanded?: boolean
}

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5V1.5h3M1.5 1l4 4M9 1.5h3v3M12.5 1l-4 4M4.5 12H1.5v-3M1 12.5l4-4M8.5 12h3v-3M12.5 12.5l-4-4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  )
}

export default function ArtifactFrame({ html, title, defaultExpanded = false }: ArtifactFrameProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [zoomed, setZoomed] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'ai-dark'

  const themeOverride = isDark
    ? `--color-bg:#0a0a1a;--color-surface:#1a1a2e;--color-border:rgba(129,140,248,0.15);--color-text:#e2e8f0;--color-muted:#94a3b8;--color-accent:#f59e0b;`
    : `--color-bg:#f0efff;--color-surface:#e8e7f8;--color-border:rgba(79,70,229,0.15);--color-text:#1e1e3a;--color-muted:#64748b;--color-accent:#d97706;`

  const themedHtml = `${html}<style>
    :root{${themeOverride}}
    html,body{background:var(--color-bg)!important;color:var(--color-text)!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  </style>`

  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [zoomed])

  return (
    <>
      <div className="glass-card rounded-xl overflow-hidden mt-3" data-testid="artifact-frame">
        {/* Header */}
        <div
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-base-content/5 transition-colors duration-150"
        >
          <span className="text-accent text-sm">⬡</span>
          <span className="text-xs text-base-content/55 flex-1 truncate">{title || 'Interactive Visual'}</span>

          {/* Zoom button */}
          <button
            data-testid="artifact-zoom-btn"
            onClick={e => { e.stopPropagation(); setZoomed(true) }}
            aria-label="Fullscreen view"
            className="text-base-content/30 hover:text-base-content/60 transition-colors px-1"
          >
            <ExpandIcon />
          </button>

          <span className="text-xs text-base-content/30">{expanded ? '▲' : '▼'}</span>
        </div>

        {expanded && (
          <iframe
            sandbox="allow-scripts"
            srcDoc={themedHtml}
            className="w-full block border-none"
            style={{ height: 420 }}
            title={title || 'Interactive artifact'}
          />
        )}
      </div>

      {/* Zoom modal — portalled to document.body to escape backdrop-filter stacking contexts */}
      {zoomed && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setZoomed(false)}
          data-testid="artifact-zoom-modal"
        >
          <div
            className="relative w-full max-w-5xl rounded-xl overflow-hidden"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-base-200/90 border-b border-base-content/10">
              <span className="text-sm font-medium text-base-content/70">{title || 'Interactive Visual'}</span>
              <button
                onClick={() => setZoomed(false)}
                aria-label="Close fullscreen"
                className="text-base-content/40 hover:text-base-content/80 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            <iframe
              sandbox="allow-scripts"
              srcDoc={themedHtml}
              className="w-full block border-none"
              style={{ height: 'min(80vh, 700px)' }}
              title={title || 'Interactive artifact fullscreen'}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
