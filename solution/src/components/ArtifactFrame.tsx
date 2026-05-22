'use client'

interface ArtifactFrameProps {
  html: string
  title?: string
}

export default function ArtifactFrame({ html, title }: ArtifactFrameProps) {
  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a2a' }}>
      {title && (
        <div
          style={{
            background: '#1a1a1a',
            borderBottom: '1px solid #2a2a2a',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: '#f59e0b' }}>⬡</span>
          {title}
        </div>
      )}
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
    </div>
  )
}
