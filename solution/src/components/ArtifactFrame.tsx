'use client'

import { useState } from 'react'

interface ArtifactFrameProps {
  html: string
  title?: string
  defaultExpanded?: boolean
}

export default function ArtifactFrame({ html, title, defaultExpanded = false }: ArtifactFrameProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
      {/* Header — always visible */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: '#1a1a1a',
          borderBottom: expanded ? '1px solid #2a2a2a' : 'none',
          padding: '8px 12px',
          fontSize: '12px',
          color: '#888',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#f59e0b' }}>⬡</span>
        <span style={{ flex: 1 }}>{title || 'Interactive Visual'}</span>
        <span style={{ fontSize: '11px', color: '#555' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Iframe — only mounted when expanded */}
      {expanded && (
        <iframe
          sandbox="allow-scripts"
          srcDoc={html}
          style={{
            width: '100%',
            height: '420px',
            border: 'none',
            display: 'block',
            background: '#1a1a1a',
          }}
          title={title || 'Interactive artifact'}
        />
      )}
    </div>
  )
}
