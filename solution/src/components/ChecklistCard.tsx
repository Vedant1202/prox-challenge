'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface ChecklistItem {
  step: string
  description: string
  image_id?: string
  tips?: string[]
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

function ExpandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5V1.5h3M1.5 1l4 4M8.5 1h3v3M12.5 1l-4 4M4.5 12H1.5V9M1 12.5l4-4M8.5 12h3V9M12.5 12.5l-4-4" />
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 1a3 3 0 011.9 5.3c-.3.3-.4.6-.4 1v.2H4v-.2c0-.4-.1-.7-.4-1A3 3 0 015.5 1z" />
      <path d="M4 8.5h3M4.5 10h2" />
    </svg>
  )
}

// ── Zoom modal ─────────────────────────────────────────────────────────────────

function ZoomModal({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
      data-testid="checklist-zoom-modal"
    >
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          maxWidth: 720,
          width: 'calc(100vw - 48px)',
          maxHeight: '90vh',
          background: 'rgba(10,10,20,0.97)',
          border: '1px solid rgba(129,140,248,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] flex-shrink-0">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
          >
            {label}
          </span>
          <button
            onClick={onClose}
            aria-label="Close zoom"
            className="flex items-center justify-center rounded text-white/50 hover:text-white transition-colors"
            style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.07)' }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l9 9M10 1L1 10" />
            </svg>
          </button>
        </div>
        {/* Image */}
        <div className="overflow-auto flex items-start justify-center p-3 bg-white/[0.02]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="rounded-lg bg-white object-contain"
            style={{ maxHeight: '75vh', width: '100%' }}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ChecklistCard({ title, items, checked, onToggle }: ChecklistCardProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [zoomedImage, setZoomedImage] = useState<{ src: string; label: string } | null>(null)

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
    <>
      <div className="glass-card rounded-xl overflow-hidden mt-3" data-testid="checklist-card">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-content/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              className="text-primary flex-shrink-0">
              <rect x="1" y="1" width="12" height="12" rx="2" />
              <path d="M4 7l2 2 4-4" />
            </svg>
            <span className="text-sm font-semibold text-base-content truncate">{title}</span>
          </div>

          <span
            className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ml-3"
            style={{
              background: allDone ? 'rgba(74,222,128,0.15)' : 'rgba(129,140,248,0.12)',
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
              background: allDone ? 'rgba(74,222,128,0.7)' : 'linear-gradient(90deg, #7c3aed, #06b6d4)',
            }}
          />
        </div>

        {/* Items */}
        <div className="divide-y divide-base-content/[0.04]">
          {items.map((item, i) => {
            const isChecked = checked[i] ?? false
            const isOpen = expanded.has(i)
            const imageUrl = item.image_id ? `/corpus/pages/${item.image_id}.png` : null

            return (
              <div key={i} className="px-4 py-2.5">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => onToggle(i)}
                    data-testid={`checklist-item-${i}`}
                    aria-label={isChecked ? `Uncheck: ${item.step}` : `Check: ${item.step}`}
                    className="flex-shrink-0 mt-0.5 transition-all duration-150"
                    style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: isChecked ? 'none' : '1.5px solid rgba(129,140,248,0.35)',
                      background: isChecked ? 'rgba(74,222,128,0.85)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff',
                    }}
                  >
                    {isChecked && <CheckIcon />}
                  </button>

                  {/* Content */}
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
                      <button
                        onClick={() => toggleExpand(i)}
                        aria-label={isOpen ? 'Collapse details' : 'Expand details'}
                        aria-expanded={isOpen}
                        className="flex-shrink-0 text-base-content/30 hover:text-base-content/60 transition-colors"
                      >
                        <ChevronIcon open={isOpen} />
                      </button>
                    </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="mt-1.5 space-y-2">
                        {/* Description */}
                        <p className="text-xs text-base-content/55 leading-relaxed">
                          {item.description}
                        </p>

                        {/* Image thumbnail */}
                        {imageUrl && (
                          <div
                            data-testid={`checklist-image-${i}`}
                            className="group relative rounded-lg overflow-hidden cursor-zoom-in"
                            style={{ border: '1px solid rgba(129,140,248,0.15)' }}
                            onClick={() => setZoomedImage({ src: imageUrl, label: item.image_id! })}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={item.step}
                              className="w-full object-contain bg-white"
                              style={{ maxHeight: 144 }}
                            />
                            {/* Hover overlay */}
                            <div
                              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                              style={{ background: 'rgba(10,10,26,0.45)' }}
                            >
                              <div
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-white text-[11px] font-medium"
                                style={{ background: 'rgba(10,10,26,0.7)' }}
                              >
                                <ExpandIcon />
                                View full page
                              </div>
                            </div>
                            {/* Page badge */}
                            <div className="absolute bottom-1.5 right-1.5">
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(245,158,11,0.85)', color: '#0a0a1a' }}
                              >
                                {item.image_id}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Tips */}
                        {item.tips && item.tips.length > 0 && (
                          <div
                            data-testid={`checklist-tips-${i}`}
                            className="rounded-lg px-3 py-2"
                            style={{
                              background: 'rgba(129,140,248,0.08)',
                              border: '1px solid rgba(129,140,248,0.12)',
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: 'rgba(129,140,248,0.75)' }}>
                              <LightbulbIcon />
                              <span className="text-[10px] font-semibold uppercase tracking-wide">Tips</span>
                            </div>
                            <ul className="space-y-1">
                              {item.tips.map((tip, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs text-base-content/60">
                                  <span className="flex-shrink-0 mt-px" style={{ color: 'rgba(129,140,248,0.5)' }}>•</span>
                                  {tip}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
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

      {/* Zoom modal */}
      {zoomedImage && (
        <ZoomModal
          src={zoomedImage.src}
          label={zoomedImage.label}
          onClose={() => setZoomedImage(null)}
        />
      )}
    </>
  )
}
