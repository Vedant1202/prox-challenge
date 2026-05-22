'use client'

import { useState } from 'react'

interface PageImageProps {
  url: string
  pageNum: number
  source: string
  summary?: string
}

export default function PageImage({ url, pageNum, source, summary }: PageImageProps) {
  const [expanded, setExpanded] = useState(false)

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
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onClick={() => setExpanded(e => !e)}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}
    >
      <img
        src={url}
        alt={`${sourceLabel} page ${pageNum}`}
        style={{
          width: '100%',
          display: 'block',
          maxHeight: expanded ? 'none' : '220px',
          objectFit: 'cover',
          objectPosition: 'top',
        }}
      />
      <div
        style={{
          background: '#161616',
          borderTop: '1px solid #2a2a2a',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '11px', color: '#888' }}>
          {sourceLabel} · Page {pageNum}
        </span>
        {summary && (
          <span
            style={{
              fontSize: '11px',
              color: '#666',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              textAlign: 'right',
            }}
          >
            {summary}
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#555', flexShrink: 0 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
    </div>
  )
}
