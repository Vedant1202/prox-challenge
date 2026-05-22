'use client'

import { useEffect, useState } from 'react'

export interface Step {
  label: string
  status: 'active' | 'done'
}

const DOTS = ['', '.', '..', '...']

export default function ActivitySteps({ steps }: { steps: Step[] }) {
  const [dotIndex, setDotIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setDotIndex(i => (i + 1) % DOTS.length), 400)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '4px 0',
      }}
    >
      {steps.map((step, i) => {
        const isActive = step.status === 'active'
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isActive ? 1 : 0.4,
              transition: 'opacity 0.3s',
            }}
          >
            {/* Status indicator */}
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                background: isActive ? '#f59e0b' : '#2a2a2a',
                color: isActive ? '#000' : '#666',
                border: isActive ? 'none' : '1px solid #333',
                transition: 'all 0.3s',
              }}
            >
              {isActive ? (
                <span
                  style={{
                    display: 'block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#000',
                    animation: 'pulse-scale 0.8s ease-in-out infinite',
                  }}
                />
              ) : (
                '✓'
              )}
            </div>

            {/* Step label */}
            <span
              style={{
                fontSize: '13px',
                color: isActive ? '#ccc' : '#555',
                fontWeight: isActive ? 500 : 400,
                transition: 'color 0.3s',
              }}
            >
              {isActive
                ? step.label.replace('…', '') + DOTS[dotIndex]
                : step.label.replace('…', '')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
