'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hotspot {
  id: string
  label: string
  shortLabel: string
  x: number  // % from left edge of image
  y: number  // % from top edge of image
  description: string
  importance: 'critical' | 'high' | 'normal'
  safetyNote?: string
  tips: string[]
}

// ─── Hotspot data — Front Panel (owner-manual-008) ────────────────────────────

const FRONT_PANEL_HOTSPOTS: Hotspot[] = [
  {
    id: 'lcd_display',
    label: 'LCD Display',
    shortLabel: 'LCD',
    x: 63, y: 37,
    description: 'Shows current process, wire speed, voltage, and material preset. Confirm what\'s displayed before striking an arc — it\'s your last safety check.',
    importance: 'critical',
    tips: [
      'Reads "MIG Steel C25" style labels — confirm process matches what you\'re doing',
      'Updates live as you turn knobs — watch it while adjusting',
      'Press Home button if you lose your place in menus',
    ],
  },
  {
    id: 'home_button',
    label: 'Home Button',
    shortLabel: 'Home',
    x: 22, y: 29,
    description: 'Returns to the main welding screen from any menu. Press any time you get lost in settings.',
    importance: 'high',
    tips: [
      'Safe to press mid-setup — does not interrupt active arc',
      'Use when the display shows an unfamiliar menu',
    ],
  },
  {
    id: 'back_button',
    label: 'Back Button',
    shortLabel: 'Back',
    x: 79, y: 28,
    description: 'Steps back one level in the settings menu without returning all the way home.',
    importance: 'normal',
    tips: ['Useful for navigating nested optional settings menus'],
  },
  {
    id: 'control_knob',
    label: 'Control Knob',
    shortLabel: 'Ctrl',
    x: 21, y: 37,
    description: 'Main selector knob. Turn to cycle through welding processes and menu options. Press to confirm a selection.',
    importance: 'critical',
    tips: [
      'Turn: MIG → Flux-Cored → TIG → Stick (cycles)',
      'Press: confirm the highlighted menu item',
      'In welding mode: adjusts wire speed for MIG/Flux-Cored',
    ],
  },
  {
    id: 'left_knob',
    label: 'Left Knob — Wire Speed / Amps',
    shortLabel: 'L Knob',
    x: 22, y: 49,
    description: 'Controls wire feed speed (IPM) for MIG/Flux-Cored or output amperage for TIG/Stick.',
    importance: 'critical',
    tips: [
      'MIG / Flux-Cored: wire speed in inches per minute',
      'TIG / Stick: output amperage directly',
      'Turn slowly — small changes have big effects on thin metal',
    ],
  },
  {
    id: 'right_knob',
    label: 'Right Knob — Voltage',
    shortLabel: 'R Knob',
    x: 78, y: 49,
    description: 'Sets output voltage for MIG/Flux-Cored. Balance this with wire speed — they must work together.',
    importance: 'critical',
    tips: [
      'Higher voltage = flatter, wider bead with more penetration',
      'Lower voltage = narrower bead, less penetration',
      'Mismatched voltage + wire speed = excessive spatter or burn-through',
    ],
  },
  {
    id: 'power_switch',
    label: 'Power Switch',
    shortLabel: 'Power',
    x: 20, y: 59,
    description: 'Main on/off switch. Always switch OFF before changing wire, swapping polarity, or opening the machine.',
    importance: 'critical',
    safetyNote: 'ALWAYS power off before: changing wire, swapping polarity connections, or performing any internal access. Failure to do so risks electric shock.',
    tips: [
      'Allow 30–60 sec after power-on before first arc',
      'If thermal protection trips: power off, let fan cool the unit, then restart',
    ],
  },
  {
    id: 'gun_socket',
    label: 'MIG Gun Socket',
    shortLabel: 'Gun Port',
    x: 22, y: 67,
    description: 'Euro-style socket for the MIG gun or spool gun cable. Twist-lock to secure. Polarity must match the process.',
    importance: 'critical',
    safetyNote: 'Polarity check required: MIG = gun to negative socket. Flux-Cored = gun to positive socket.',
    tips: [
      'Twist clockwise until firm — loose connections cause arc instability',
      'MIG: gun connects here (negative side)',
      'Flux-Cored: gun cable moves to positive socket (swap ground too)',
    ],
  },
  {
    id: 'gas_outlet',
    label: 'Spool Gun Gas Outlet',
    shortLabel: 'Gas Out',
    x: 20, y: 76,
    description: 'Gas hose fitting for an optional spool gun attachment. Standard MIG shielding gas connects at the rear regulator, not here.',
    importance: 'normal',
    tips: [
      'Only used with optional spool gun accessory',
      'Standard MIG: run shielding gas hose to the rear gas inlet',
    ],
  },
  {
    id: 'storage',
    label: 'Storage Compartment',
    shortLabel: 'Storage',
    x: 78, y: 60,
    description: 'Small door for keeping spare consumables within reach — contact tips, nozzles, or the electrode holder.',
    importance: 'normal',
    tips: [
      'Keep spare 0.030" and 0.035" contact tips here',
      'Store stick electrode holder here when TIG welding',
    ],
  },
  {
    id: 'positive_socket',
    label: 'Positive (+) Socket',
    shortLabel: 'Pos (+)',
    x: 76, y: 70,
    description: 'Positive output terminal. Ground clamp goes here for MIG, TIG, and Stick. For Flux-Cored the gun cable goes here instead.',
    importance: 'critical',
    safetyNote: 'MIG/TIG/Stick: ground clamp = positive. Flux-Cored: gun cable = positive. Wrong polarity causes poor fusion.',
    tips: [
      'MIG / TIG / Stick: ground clamp plugs in here',
      'Flux-Cored: gun cable moves here (reversed from MIG)',
      'Power off before swapping any connections',
    ],
  },
  {
    id: 'negative_socket',
    label: 'Negative (−) Socket',
    shortLabel: 'Neg (−)',
    x: 43, y: 83,
    description: 'Negative output terminal. Gun/torch plugs here for MIG, TIG, and Stick. For Flux-Cored the ground clamp goes here.',
    importance: 'critical',
    safetyNote: 'Verify polarity every session when switching between MIG and Flux-Cored.',
    tips: [
      'MIG / TIG / Stick: gun or torch = negative socket',
      'Flux-Cored: ground clamp = negative socket',
      'Hand-tighten firmly — loose connection = arc instability',
    ],
  },
  {
    id: 'wire_feed_cable',
    label: 'Wire Feed Power Cable',
    shortLabel: 'Feed',
    x: 58, y: 82,
    description: 'Integrated cable that powers the internal wire feed motor. Do not disconnect.',
    importance: 'normal',
    tips: ['Inspect cable sheath for cracks or damage before each session'],
  },
]

// ─── Hotspot data — Interior (owner-manual-009) ───────────────────────────────

const INTERIOR_HOTSPOTS: Hotspot[] = [
  {
    id: 'wire_spool',
    label: 'Wire Spool Hub',
    shortLabel: 'Spool',
    x: 19, y: 47,
    description: 'Accepts 4" (1–2 lb) spools directly, or 8" (10–12 lb) spools with the included plastic adapter. Center the spool on the hub and hand-tighten the retaining nut.',
    importance: 'high',
    tips: [
      'Hand-tighten the retaining nut only — over-tightening causes wire drag',
      'Use the plastic adapter for 8" spools',
      'Feed 6" of wire through the liner before closing the door on a new spool',
    ],
  },
  {
    id: 'tension_knob',
    label: 'Feed Tensioner',
    shortLabel: 'Tension',
    x: 79, y: 27,
    description: 'Controls the grip pressure the drive rolls apply to the wire. The #1 cause of bird\'s nesting is incorrect tension.',
    importance: 'critical',
    safetyNote: 'Set to minimum pressure that prevents slippage. Excess tension on flux-cored wire crushes the flux core.',
    tips: [
      'Start at minimum, increase by quarter-turns until feed is consistent',
      'Flux-cored wire needs less tension than solid wire',
      'Re-check whenever you change wire type or spool',
    ],
  },
  {
    id: 'drive_rolls',
    label: 'Wire Feed / Drive Rolls',
    shortLabel: 'Drive',
    x: 37, y: 42,
    description: 'Feeds wire from the spool through the liner to the gun. V-Groove rolls for solid MIG wire. Knurled rolls for flux-cored wire.',
    importance: 'critical',
    safetyNote: 'Wrong roll type = wire slippage or crush damage. V-Groove for solid wire. Knurled for flux-cored.',
    tips: [
      'Check the stamp on the roll — "V" for solid, "K" for knurled',
      'Clean rolls monthly with a stiff wire brush',
      'Worn grooves cause bird\'s nesting — replace if feed problems persist',
    ],
  },
  {
    id: 'wire_liner',
    label: 'Wire Inlet Liner',
    shortLabel: 'Liner',
    x: 34, y: 57,
    description: 'Flexible conduit guiding wire from the drive rolls into the gun cable. A kinked or dirty liner is a common cause of inconsistent wire feed.',
    importance: 'high',
    tips: [
      'Inspect for kinks near the gun connector',
      'Replace if feed remains rough after checking tension and rolls',
      'Blow out with compressed air monthly',
    ],
  },
  {
    id: 'cold_feed',
    label: 'Cold Wire Feed Switch',
    shortLabel: 'Cold Feed',
    x: 48, y: 19,
    description: 'Advances wire through the gun without energizing the output. Use this to thread wire after a spool change without striking an arc.',
    importance: 'high',
    tips: [
      'Hold the trigger on the gun while pressing this switch to thread wire',
      'Saves contact tips — no test arc needed after re-threading',
      'Also useful for clearing a bird\'s nest in the drive rolls',
    ],
  },
]

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'front' as const, label: 'Front Panel', image: '/corpus/pages/owner-manual-008.png', hotspots: FRONT_PANEL_HOTSPOTS },
  { id: 'interior' as const, label: 'Interior',    image: '/corpus/pages/owner-manual-009.png', hotspots: INTERIOR_HOTSPOTS },
]

type TabId = 'front' | 'interior'

// ─── Helper: compute popover position ────────────────────────────────────────
// Returns style for the popover bubble positioned near the pin (x%, y%).
// Clamps horizontally so it stays within the image container.
// Flips vertically: above the pin if y>50%, below if y≤50%.

function popoverStyle(x: number, y: number): React.CSSProperties {
  const above = y > 45
  return {
    position: 'absolute',
    left: `clamp(120px, ${x}%, calc(100% - 120px))`,
    top: above ? `calc(${y}% - 14px)` : `calc(${y}% + 14px)`,
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    zIndex: 20,
    width: 240,
    pointerEvents: 'auto',
  }
}

function caretStyle(above: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    ...(above
      ? { bottom: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(15,15,38,0.95)' }
      : { top: -6, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid rgba(15,15,38,0.95)' }),
  }
}

// ─── Popover bubble ───────────────────────────────────────────────────────────

function HotspotPopover({ hotspot, onClose }: { hotspot: Hotspot; onClose: () => void }) {
  const above = hotspot.y > 45

  return (
    <div style={popoverStyle(hotspot.x, hotspot.y)} data-testid="hotspot-popover">
      {/* Caret */}
      <div style={caretStyle(above)} />

      {/* Card */}
      <div
        className="rounded-xl shadow-2xl overflow-hidden"
        style={{
          background: 'rgba(15,15,38,0.97)',
          border: '1px solid rgba(129,140,248,0.2)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {hotspot.importance === 'critical' && (
              <span
                className="flex-shrink-0 rounded-full"
                style={{ width: 6, height: 6, background: '#f59e0b' }}
              />
            )}
            <span className="text-xs font-semibold text-white leading-snug">{hotspot.label}</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors"
            style={{ lineHeight: 1 }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 1l8 8M9 1l-8 8" />
            </svg>
          </button>
        </div>

        {/* Safety note */}
        {hotspot.safetyNote && (
          <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="flex items-start gap-1.5">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#f87171" strokeWidth="1.5" className="flex-shrink-0 mt-0.5">
                <path d="M5 1L9.5 9H.5L5 1z" strokeLinejoin="round"/>
                <path d="M5 4.5v2" strokeLinecap="round"/>
                <circle cx="5" cy="7.5" r="0.4" fill="#f87171"/>
              </svg>
              <p className="text-[10px] leading-relaxed" style={{ color: '#fca5a5' }}>{hotspot.safetyNote}</p>
            </div>
          </div>
        )}

        {/* Description */}
        <p className="px-3 pb-2 text-[11px] leading-relaxed" style={{ color: 'rgba(226,232,240,0.75)' }}>
          {hotspot.description}
        </p>

        {/* Tips */}
        {hotspot.tips.length > 0 && (
          <ul className="px-3 pb-3 space-y-1">
            {hotspot.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: 'rgba(148,163,184,0.8)' }}>
                <span className="flex-shrink-0 mt-0.5" style={{ color: 'rgba(129,140,248,0.5)' }}>›</span>
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Hotspot pin button ───────────────────────────────────────────────────────

function HotspotPin({ hotspot, active, onClick }: { hotspot: Hotspot; active: boolean; onClick: () => void }) {
  const criticalColor = '#f59e0b'
  const highColor = '#818cf8'
  const normalColor = '#94a3b8'

  const color = hotspot.importance === 'critical' ? criticalColor
    : hotspot.importance === 'high' ? highColor
    : normalColor

  return (
    <button
      onClick={onClick}
      data-testid={`hotspot-pin-${hotspot.id}`}
      aria-label={hotspot.label}
      title={hotspot.label}
      style={{
        position: 'absolute',
        left: `${hotspot.x}%`,
        top: `${hotspot.y}%`,
        transform: 'translate(-50%, -50%)',
        width: active ? 22 : 18,
        height: active ? 22 : 18,
        borderRadius: '50%',
        background: active ? color : 'rgba(10,10,26,0.7)',
        border: `2px solid ${color}`,
        boxShadow: active ? `0 0 0 3px ${color}33` : 'none',
        zIndex: 10,
        transition: 'all 0.15s',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: active ? '#0a0a1a' : color,
        fontSize: 8,
        fontWeight: 700,
      }}
    >
      {hotspot.shortLabel.charAt(0)}
    </button>
  )
}

// ─── Zoom modal ───────────────────────────────────────────────────────────────

function ZoomModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="zoom-modal" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        aria-hidden="true"
      />
      {/* Image container */}
      <div
        className="relative max-w-3xl w-full max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
        style={{ border: '1px solid rgba(129,140,248,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white transition-colors"
          style={{ width: 28, height: 28 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.8">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="w-full h-full object-contain bg-white" />
      </div>
    </div>,
    document.body
  )
}

// ─── Main MachineDiagram component ────────────────────────────────────────────

export interface MachineDiagramProps {
  highlight?: string
  initialTab?: TabId
}

export default function MachineDiagram({ highlight, initialTab = 'front' }: MachineDiagramProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [activeHotspot, setActiveHotspot] = useState<string | null>(highlight ?? null)
  const [zoomed, setZoomed] = useState(false)

  const tab = TABS.find(t => t.id === activeTab)!
  const hotspot = tab.hotspots.find(h => h.id === activeHotspot) ?? null

  // Auto-open highlight pin when prop changes
  useEffect(() => {
    if (!highlight) return
    const inFront = FRONT_PANEL_HOTSPOTS.some(h => h.id === highlight)
    const inInt   = INTERIOR_HOTSPOTS.some(h => h.id === highlight)
    if (inFront) setActiveTab('front')
    else if (inInt) setActiveTab('interior')
    setActiveHotspot(highlight)
  }, [highlight])

  // Close popover on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveHotspot(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function handlePinClick(id: string) {
    setActiveHotspot(prev => prev === id ? null : id)
  }

  const closePopover = useCallback(() => setActiveHotspot(null), [])

  return (
    <div className="glass-card rounded-xl overflow-hidden" data-testid="machine-diagram">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-base-content/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Circuit icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" className="text-primary">
            <rect x="4" y="4" width="6" height="6" rx="1" />
            <path d="M7 1v3M7 10v3M1 7h3M10 7h3" />
          </svg>
          <span className="text-sm font-semibold text-base-content">Machine Diagram</span>
          <span className="text-xs text-base-content/40">OmniPro 220</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.1)' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                data-testid={`tab-${t.id}`}
                onClick={() => { setActiveTab(t.id); setActiveHotspot(null) }}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-100"
                style={{
                  background: activeTab === t.id ? 'rgba(129,140,248,0.2)' : 'transparent',
                  color: activeTab === t.id ? 'rgb(var(--p, 129,140,248))' : 'rgba(var(--bc), 0.45)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Zoom button */}
          <button
            onClick={() => setZoomed(true)}
            data-testid="zoom-button"
            aria-label="Zoom diagram"
            className="text-base-content/40 hover:text-base-content/70 transition-colors"
            title="View full size"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Image + hotspots */}
      <div className="relative w-full" style={{ aspectRatio: '3/4', backgroundColor: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tab.image}
          alt={tab.label}
          className="absolute inset-0 w-full h-full object-contain"
        />

        {/* Hotspot pins */}
        {tab.hotspots.map(h => (
          <HotspotPin
            key={h.id}
            hotspot={h}
            active={activeHotspot === h.id}
            onClick={() => handlePinClick(h.id)}
          />
        ))}

        {/* Popover bubble — positioned near the active pin */}
        {hotspot && (
          <HotspotPopover hotspot={hotspot} onClose={closePopover} />
        )}

        {/* Tap hint (shown when nothing is selected) */}
        {!activeHotspot && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="text-[10px] px-2 py-1 rounded-full text-white/60"
              style={{ background: 'rgba(10,10,26,0.7)' }}>
              Tap any pin to learn more
            </span>
          </div>
        )}
      </div>

      {/* Pin legend / quick-select row */}
      <div className="px-3 py-2 border-t border-base-content/[0.04] flex flex-wrap gap-1">
        {tab.hotspots.map(h => (
          <button
            key={h.id}
            onClick={() => handlePinClick(h.id)}
            className="text-[10px] px-2 py-0.5 rounded-full transition-colors duration-100"
            style={{
              background: activeHotspot === h.id ? 'rgba(129,140,248,0.18)' : 'rgba(129,140,248,0.06)',
              border: '1px solid rgba(129,140,248,0.12)',
              color: activeHotspot === h.id ? 'rgb(var(--p, 129,140,248))' : 'rgba(var(--bc), 0.45)',
            }}
          >
            {h.shortLabel}
          </button>
        ))}
      </div>

      {/* Zoom modal */}
      {zoomed && (
        <ZoomModal
          src={tab.image}
          alt={tab.label}
          onClose={() => setZoomed(false)}
        />
      )}
    </div>
  )
}

// ─── Full-page wrapper for sidebar view ──────────────────────────────────────

export function MachineDiagramPage({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
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
        <span className="text-sm font-semibold text-base-content">Machine Diagram</span>
        <span className="text-xs text-base-content/40">interactive diagram</span>
      </div>

      {/* Diagram — scrollable container */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <MachineDiagram />
        </div>
      </div>
    </div>
  )
}
