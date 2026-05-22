'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme-context'

interface ArtifactFrameProps {
  html: string
  title?: string
  defaultExpanded?: boolean
}

export default function ArtifactFrame({ html, title, defaultExpanded = false }: ArtifactFrameProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { theme } = useTheme()
  const isDark = theme === 'ai-dark'

  // Inject theme tokens AFTER artifact HTML so our :root wins the cascade
  const themeOverride = isDark
    ? `--color-bg:#0a0a1a;--color-surface:#1a1a2e;--color-border:rgba(129,140,248,0.15);--color-text:#e2e8f0;--color-muted:#94a3b8;--color-accent:#f59e0b;`
    : `--color-bg:#f0efff;--color-surface:#e8e7f8;--color-border:rgba(79,70,229,0.15);--color-text:#1e1e3a;--color-muted:#64748b;--color-accent:#d97706;`

  const themedHtml = `${html}<style>
    :root{${themeOverride}}
    html,body{background:var(--color-bg)!important;color:var(--color-text)!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
  </style>`

  return (
    <div className="glass-card rounded-xl overflow-hidden mt-3">
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-base-content/5 transition-colors duration-150"
      >
        <span className="text-accent text-sm">⬡</span>
        <span className="text-xs text-base-content/55 flex-1 truncate">{title || 'Interactive Visual'}</span>
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
  )
}
