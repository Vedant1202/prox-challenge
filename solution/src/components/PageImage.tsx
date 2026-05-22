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
      style={{
        border: '1px solid #2a2a2a',
        borderRadius: '10px',
        overflow: 'hidden',
        marginTop: '8px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
    >
      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: '#161616',
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            background: '#f59e0b22',
            color: '#f59e0b',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            flexShrink: 0,
          }}
        >
          p.{pageNum}
        </span>
        <span style={{ fontSize: '11px', color: '#888', flexShrink: 0 }}>
          {sourceLabel}
        </span>
        {summary && (
          <span
            style={{
              fontSize: '11px',
              color: '#555',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {summary}
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#555', flexShrink: 0, marginLeft: 'auto' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Content — collapsed by default */}
      {expanded && (
        <img
          src={url}
          alt={`${sourceLabel} page ${pageNum}`}
          style={{
            width: '100%',
            display: 'block',
          }}
        />
      )}
    </div>
  )
}
