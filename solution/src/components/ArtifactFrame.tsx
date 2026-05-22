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

  const themedHtml = `<style>
    html, body {
      background: ${isDark ? '#0a0a1a' : '#f0efff'};
      color: ${isDark ? '#e2e8f0' : '#1e1e3a'};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0; padding: 0;
    }
    * { box-sizing: border-box; }
  </style>${html}`

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
