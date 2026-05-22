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
    <div className="flex flex-col gap-2 py-1">
      {steps.map((step, i) => {
        const isActive = step.status === 'active'
        return (
          <div
            key={i}
            className="flex items-center gap-2.5 transition-opacity duration-300"
            style={{ opacity: isActive ? 1 : 0.38 }}
          >
            {isActive ? (
              <span className="loading loading-ring loading-xs text-primary flex-shrink-0" />
            ) : (
              <span
                className="flex-shrink-0 flex items-center justify-center rounded-full text-success"
                style={{ width: 16, height: 16, fontSize: 10, fontWeight: 700 }}
              >
                ✓
              </span>
            )}
            <span
              className={`text-xs transition-colors duration-300 ${
                isActive ? 'text-base-content/80 font-medium' : 'text-base-content/40'
              }`}
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
