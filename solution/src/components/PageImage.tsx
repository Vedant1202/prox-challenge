'use client'

import { useState } from 'react'

interface PageImageProps {
  url: string
  pageNum: number
  source: string
  summary?: string
  defaultExpanded?: boolean
}

export default function PageImage({ url, pageNum, source, summary, defaultExpanded = false }: PageImageProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const sourceLabel = source
    .replace('owner-manual', 'Owner Manual')
    .replace('quick-start', 'Quick Start Guide')
    .replace('selection-chart', 'Selection Chart')

  return (
    <div
      className="glass-card rounded-xl overflow-hidden mt-2 transition-all duration-150"
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(129,140,248,0.2)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors duration-150 hover:bg-base-content/5"
      >
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            background: 'rgba(245,158,11,0.15)',
            color: '#f59e0b',
          }}
        >
          p.{pageNum}
        </span>
        <span className="text-xs text-base-content/55 flex-shrink-0">{sourceLabel}</span>
        {summary && (
          <span className="text-xs text-base-content/35 flex-1 truncate">{summary}</span>
        )}
        <span className="text-xs text-base-content/30 flex-shrink-0 ml-auto">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <img
          src={url}
          alt={`${sourceLabel} page ${pageNum}`}
          className="w-full block"
        />
      )}
    </div>
  )
}
