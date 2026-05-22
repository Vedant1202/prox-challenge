'use client'

import { useState } from 'react'

export interface ChecklistItem {
  step: string
  description: string
}

interface ChecklistCardProps {
  title: string
  items: ChecklistItem[]
  checked: boolean[]
  onToggle: (index: number) => void
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
    >
      <path d="M2 4.5l4 3 4-3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 5l2.5 2.5 4.5-4.5" />
    </svg>
  )
}

export default function ChecklistCard({ title, items, checked, onToggle }: ChecklistCardProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const checkedCount = checked.filter(Boolean).length
  const allDone = checkedCount === items.length && items.length > 0
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0

  function toggleExpand(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div className="glass-card rounded-xl overflow-hidden mt-3" data-testid="checklist-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Checklist icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            className="text-primary flex-shrink-0">
            <rect x="1" y="1" width="12" height="12" rx="2" />
            <path d="M4 7l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-base-content truncate">{title}</span>
        </div>

        {/* Progress pill */}
        <span
          className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ml-3"
          style={{
            background: allDone
              ? 'rgba(74,222,128,0.15)'
              : 'rgba(129,140,248,0.12)',
            color: allDone ? 'var(--su, #4ade80)' : 'var(--p, #818cf8)',
          }}
        >
          {allDone ? 'All done ✓' : `${checkedCount}/${items.length}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-base-content/[0.06] mx-4">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: allDone
              ? 'rgba(74,222,128,0.7)'
              : 'linear-gradient(90deg, #7c3aed, #06b6d4)',
          }}
        />
      </div>

      {/* Items */}
      <div className="divide-y divide-base-content/[0.04]">
        {items.map((item, i) => {
          const isChecked = checked[i] ?? false
          const isOpen = expanded.has(i)

          return (
            <div key={i} className="px-4 py-2.5">
              <div className="flex items-start gap-3">
                {/* Checkbox button */}
                <button
                  onClick={() => onToggle(i)}
                  data-testid={`checklist-item-${i}`}
                  aria-label={isChecked ? `Uncheck: ${item.step}` : `Check: ${item.step}`}
                  className="flex-shrink-0 mt-0.5 transition-all duration-150"
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: isChecked ? 'none' : '1.5px solid rgba(129,140,248,0.35)',
                    background: isChecked ? 'rgba(74,222,128,0.85)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  {isChecked && <CheckIcon />}
                </button>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-sm leading-snug transition-all duration-150"
                      style={{
                        color: isChecked ? 'rgba(var(--bc), 0.35)' : undefined,
                        textDecoration: isChecked ? 'line-through' : 'none',
                      }}
                    >
                      {item.step}
                    </span>

                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(i)}
                      aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                      aria-expanded={isOpen}
                      className="flex-shrink-0 text-base-content/30 hover:text-base-content/60 transition-colors"
                    >
                      <ChevronIcon open={isOpen} />
                    </button>
                  </div>

                  {/* Description */}
                  {isOpen && (
                    <p className="mt-1.5 text-xs text-base-content/55 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* All done banner */}
      {allDone && (
        <div
          className="mx-4 mb-3 mt-1 px-3 py-2 rounded-lg text-xs font-medium text-center"
          style={{ background: 'rgba(74,222,128,0.1)', color: 'rgba(74,222,128,0.85)' }}
        >
          All steps complete — nice work!
        </div>
      )}
    </div>
  )
}
