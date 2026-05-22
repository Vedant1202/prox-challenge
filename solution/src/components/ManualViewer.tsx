'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ─── Page data ────────────────────────────────────────────────────────────────

interface PageEntry {
  id: string
  page: number
  source: string
  label: string
}

const PAGES: PageEntry[] = [
  { id: 'owner-manual-001', page: 1,  source: 'Owner Manual',     label: 'Cover Page' },
  { id: 'owner-manual-002', page: 2,  source: 'Owner Manual',     label: 'Table of Contents' },
  { id: 'owner-manual-003', page: 3,  source: 'Owner Manual',     label: 'Fume & Gas Safety' },
  { id: 'owner-manual-004', page: 4,  source: 'Owner Manual',     label: 'Electrical & Fire Safety' },
  { id: 'owner-manual-005', page: 5,  source: 'Owner Manual',     label: 'Use & Care' },
  { id: 'owner-manual-006', page: 6,  source: 'Owner Manual',     label: 'Grounding Safety' },
  { id: 'owner-manual-007', page: 7,  source: 'Owner Manual',     label: 'Specifications' },
  { id: 'owner-manual-008', page: 8,  source: 'Owner Manual',     label: 'Front Panel Controls' },
  { id: 'owner-manual-009', page: 9,  source: 'Owner Manual',     label: 'Interior Controls' },
  { id: 'owner-manual-010', page: 10, source: 'Owner Manual',     label: 'Wire Spool Setup' },
  { id: 'owner-manual-011', page: 11, source: 'Owner Manual',     label: '10–12 lb Spool Install' },
  { id: 'owner-manual-012', page: 12, source: 'Owner Manual',     label: 'Feed Roller Setup' },
  { id: 'owner-manual-013', page: 13, source: 'Owner Manual',     label: 'Setup Steps 13–16' },
  { id: 'owner-manual-014', page: 14, source: 'Owner Manual',     label: 'DCEP Polarity (MIG)' },
  { id: 'owner-manual-015', page: 15, source: 'Owner Manual',     label: 'Wire Loading' },
  { id: 'owner-manual-016', page: 16, source: 'Owner Manual',     label: 'Wire Feeding Setup' },
  { id: 'owner-manual-017', page: 17, source: 'Owner Manual',     label: 'Drive Tension Check' },
  { id: 'owner-manual-018', page: 18, source: 'Owner Manual',     label: 'Basic Wire Welding' },
  { id: 'owner-manual-019', page: 19, source: 'Owner Manual',     label: 'Duty Cycle — MIG' },
  { id: 'owner-manual-020', page: 20, source: 'Owner Manual',     label: 'MIG Settings & LCD' },
  { id: 'owner-manual-021', page: 21, source: 'Owner Manual',     label: 'Optional Settings' },
  { id: 'owner-manual-022', page: 22, source: 'Owner Manual',     label: 'Welding Technique' },
  { id: 'owner-manual-023', page: 23, source: 'Owner Manual',     label: 'Post-Weld Shutdown' },
  { id: 'owner-manual-024', page: 24, source: 'Owner Manual',     label: 'TIG / Stick Setup' },
  { id: 'owner-manual-025', page: 25, source: 'Owner Manual',     label: 'TIG Gas Setup' },
  { id: 'owner-manual-026', page: 26, source: 'Owner Manual',     label: 'Tungsten Grinding' },
  { id: 'owner-manual-027', page: 27, source: 'Owner Manual',     label: 'Stick Cable Setup' },
  { id: 'owner-manual-028', page: 28, source: 'Owner Manual',     label: 'Stick Safety & Operation' },
  { id: 'owner-manual-029', page: 29, source: 'Owner Manual',     label: 'Duty Cycle — TIG & Stick' },
  { id: 'owner-manual-030', page: 30, source: 'Owner Manual',     label: 'TIG Settings' },
  { id: 'owner-manual-031', page: 31, source: 'Owner Manual',     label: 'TIG Settings (cont.)' },
  { id: 'owner-manual-032', page: 32, source: 'Owner Manual',     label: 'Stick Welding Setup' },
  { id: 'owner-manual-033', page: 33, source: 'Owner Manual',     label: 'Stick Optional Settings' },
  { id: 'owner-manual-034', page: 34, source: 'Owner Manual',     label: 'Strike Test & Tips' },
  { id: 'owner-manual-035', page: 35, source: 'Owner Manual',     label: 'Wire Weld Diagnosis' },
  { id: 'owner-manual-036', page: 36, source: 'Owner Manual',     label: 'Wire Penetration Guide' },
  { id: 'owner-manual-037', page: 37, source: 'Owner Manual',     label: 'Wire Porosity & Spatter' },
  { id: 'owner-manual-038', page: 38, source: 'Owner Manual',     label: 'Stick Weld Diagnosis' },
  { id: 'owner-manual-039', page: 39, source: 'Owner Manual',     label: 'Stick Penetration Guide' },
  { id: 'owner-manual-040', page: 40, source: 'Owner Manual',     label: 'Stick Porosity & Spatter' },
  { id: 'owner-manual-041', page: 41, source: 'Owner Manual',     label: 'Maintenance' },
  { id: 'owner-manual-042', page: 42, source: 'Owner Manual',     label: 'Troubleshoot — Wire (1)' },
  { id: 'owner-manual-043', page: 43, source: 'Owner Manual',     label: 'Troubleshoot — Wire (2)' },
  { id: 'owner-manual-044', page: 44, source: 'Owner Manual',     label: 'Troubleshoot — TIG & Stick' },
  { id: 'owner-manual-045', page: 45, source: 'Owner Manual',     label: 'Wiring Schematic' },
  { id: 'owner-manual-046', page: 46, source: 'Owner Manual',     label: 'Parts List' },
  { id: 'owner-manual-047', page: 47, source: 'Owner Manual',     label: 'Assembly Diagram' },
  { id: 'owner-manual-048', page: 48, source: 'Owner Manual',     label: 'Warranty' },
  { id: 'quick-start-001',  page: 1,  source: 'Quick Start Guide', label: 'Quick Start — Setup' },
  { id: 'quick-start-002',  page: 2,  source: 'Quick Start Guide', label: 'Quick Start — Cables' },
  { id: 'selection-chart-001', page: 1, source: 'Selection Chart', label: 'Process Selection Chart' },
]

function imageUrl(id: string) {
  return `/corpus/pages/${id}.png`
}

// ─── Zoom Modal ───────────────────────────────────────────────────────────────

interface ZoomModalProps {
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

function ZoomModal({ index, onClose, onNavigate }: ZoomModalProps) {
  const [inputValue, setInputValue] = useState(String(index + 1))
  const inputRef = useRef<HTMLInputElement>(null)
  const page = PAGES[index]

  // Sync input when index changes from arrow nav
  useEffect(() => {
    setInputValue(String(index + 1))
  }, [index])

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft')  { if (index > 0) onNavigate(index - 1) }
      if (e.key === 'ArrowRight') { if (index < PAGES.length - 1) onNavigate(index + 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [index, onClose, onNavigate])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleInputSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseInt(inputValue, 10)
    if (!isNaN(n) && n >= 1 && n <= PAGES.length) {
      onNavigate(n - 1)
    } else {
      setInputValue(String(index + 1))
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="manual-zoom-modal">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          maxWidth: 720,
          width: 'calc(100vw - 48px)',
          maxHeight: '92vh',
          background: 'rgba(10,10,20,0.96)',
          border: '1px solid rgba(129,140,248,0.2)',
          zIndex: 1,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ background: 'rgba(129,140,248,0.15)', color: '#a5b4fc' }}
            >
              p.{page.page}
            </span>
            <span className="text-sm font-semibold text-white truncate">{page.label}</span>
            <span className="text-xs text-white/35 flex-shrink-0 hidden sm:inline">{page.source}</span>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <form onSubmit={handleInputSubmit} className="flex items-center gap-1">
              <span className="text-xs text-white/40 hidden sm:inline">Go to</span>
              <input
                ref={inputRef}
                type="number"
                min={1}
                max={PAGES.length}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                data-testid="page-number-input"
                className="text-xs text-center rounded bg-white/[0.08] border border-white/[0.12] text-white outline-none focus:border-primary"
                style={{ width: 44, padding: '2px 4px' }}
              />
              <span className="text-xs text-white/40">/ {PAGES.length}</span>
            </form>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onNavigate(index - 1)}
                disabled={index === 0}
                data-testid="prev-button"
                aria-label="Previous page"
                className="flex items-center justify-center rounded transition-colors disabled:opacity-20"
                style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.07)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8">
                  <path d="M7.5 2.5L3 6l4.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={() => onNavigate(index + 1)}
                disabled={index === PAGES.length - 1}
                data-testid="next-button"
                aria-label="Next page"
                className="flex items-center justify-center rounded transition-colors disabled:opacity-20"
                style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.07)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4.5 2.5L9 6l-4.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close"
              className="flex items-center justify-center rounded text-white/50 hover:text-white transition-colors"
              style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.07)' }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" stroke="currentColor" strokeWidth="1.8">
                <path d="M1 1l9 9M10 1L1 10" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-white/[0.02]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(page.id)}
            alt={page.label}
            className="max-w-full object-contain rounded"
            style={{ maxHeight: 'calc(92vh - 120px)' }}
          />
        </div>

        {/* Footer navigation (large arrows for easy click/touch) */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.05] flex-shrink-0">
          <button
            onClick={() => onNavigate(index - 1)}
            disabled={index === 0}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white disabled:opacity-20 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8">
              <path d="M7.5 2.5L3 6l4.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {index > 0 ? PAGES[index - 1].label : 'First page'}
          </button>
          <span className="text-[10px] text-white/25">{index + 1} of {PAGES.length}</span>
          <button
            onClick={() => onNavigate(index + 1)}
            disabled={index === PAGES.length - 1}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white disabled:opacity-20 transition-colors"
          >
            {index < PAGES.length - 1 ? PAGES[index + 1].label : 'Last page'}
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8">
              <path d="M4.5 2.5L9 6l-4.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Thumbnail card ───────────────────────────────────────────────────────────

function ThumbnailCard({ page, index, onOpen }: { page: PageEntry; index: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      data-testid={`page-thumb-${page.id}`}
      className="group glass-card rounded-xl overflow-hidden text-left w-full hover:-translate-y-0.5 transition-all duration-150"
      aria-label={`Open ${page.label}`}
    >
      {/* Thumbnail image */}
      <div className="relative w-full bg-white overflow-hidden" style={{ aspectRatio: '3/4' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(page.id)}
          alt={page.label}
          loading="lazy"
          className="w-full h-full object-contain transition-opacity duration-150 group-hover:opacity-90"
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: 'rgba(10,10,26,0.35)' }}>
          <span className="text-white text-[10px] px-2 py-1 rounded-full"
            style={{ background: 'rgba(10,10,26,0.7)' }}>
            Open
          </span>
        </div>
      </div>

      {/* Caption */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-base-content/[0.05]">
        <span className="text-[11px] text-base-content/65 truncate leading-snug pr-1">{page.label}</span>
        <span className="text-[10px] text-base-content/30 flex-shrink-0">p.{page.page}</span>
      </div>
    </button>
  )
}

// ─── ManualViewer ─────────────────────────────────────────────────────────────

interface ManualViewerProps {
  onClose: () => void
}

export default function ManualViewer({ onClose }: ManualViewerProps) {
  const [modalIndex, setModalIndex] = useState<number | null>(null)

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="manual-viewer">
      {/* Header */}
      <div className="glass border-b flex items-center gap-3 px-5 py-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-base-content/50 hover:text-base-content transition-colors text-xs"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7.5 2.5L3 6l4.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to chat
        </button>
        <div className="h-3.5 w-px bg-base-content/10" />
        {/* Book icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" className="text-primary flex-shrink-0">
          <path d="M2 11V2a1 1 0 011-1h7a1 1 0 011 1v9"/>
          <path d="M2 11h9a1 1 0 000-2H2v2z"/>
          <path d="M5 4h4M5 6.5h4"/>
        </svg>
        <span className="text-sm font-semibold text-base-content">Manual Pages</span>
        <span className="text-xs text-base-content/40">{PAGES.length} pages</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {PAGES.map((page, i) => (
            <ThumbnailCard
              key={page.id}
              page={page}
              index={i}
              onOpen={() => setModalIndex(i)}
            />
          ))}
        </div>
      </div>

      {/* Zoom modal */}
      {modalIndex !== null && (
        <ZoomModal
          index={modalIndex}
          onClose={() => setModalIndex(null)}
          onNavigate={setModalIndex}
        />
      )}
    </div>
  )
}
