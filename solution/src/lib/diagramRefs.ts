/**
 * Diagram reference detection for chat messages.
 *
 * Scans assistant message text for mentions of machine components and returns
 * the matching hotspot IDs. These are used to render "jump to diagram" chips
 * below a message, linking directly to the relevant hotspot on the machine diagram.
 */

// ── Keyword map ───────────────────────────────────────────────────────────────

/**
 * Maps machine component IDs to the keywords that indicate the assistant is
 * talking about them. Keywords are matched case-insensitively anywhere in the
 * message text. First keyword match wins (no duplicates per component).
 */
const DIAGRAM_KEYWORD_MAP: Array<{ id: string; label: string; keywords: string[] }> = [
  { id: 'lcd_display',     label: 'LCD Display',          keywords: ['LCD display', 'LCD screen', 'LCD panel', 'LCD'] },
  { id: 'home_button',     label: 'Home Button',           keywords: ['Home button', 'Home key', 'home button'] },
  { id: 'back_button',     label: 'Back Button',           keywords: ['Back button', 'back button'] },
  { id: 'control_knob',    label: 'Control Knob',          keywords: ['control knob', 'selector knob', 'process knob'] },
  { id: 'left_knob',       label: 'Left Knob',             keywords: ['left knob', 'Left Knob', 'wire speed knob'] },
  { id: 'right_knob',      label: 'Right Knob',            keywords: ['right knob', 'Right Knob', 'voltage knob'] },
  { id: 'power_switch',    label: 'Power Switch',          keywords: ['power switch', 'power button', 'on/off switch', 'Power Switch'] },
  { id: 'gun_socket',      label: 'MIG Gun Socket',        keywords: ['gun socket', 'MIG gun socket', 'torch socket', 'Euro socket', 'euro-style socket', 'gun port'] },
  { id: 'gas_outlet',      label: 'Gas Outlet',            keywords: ['gas outlet', 'spool gun gas outlet'] },
  { id: 'storage',         label: 'Storage Compartment',   keywords: ['storage compartment', 'accessory storage'] },
  { id: 'positive_socket', label: 'Positive (+) Socket',   keywords: ['positive socket', 'positive terminal', 'positive (+)', '(+) socket'] },
  { id: 'negative_socket', label: 'Negative (−) Socket',   keywords: ['negative socket', 'negative terminal', 'negative (−)', '(−) socket', 'negative (-)'] },
  { id: 'wire_spool',      label: 'Wire Spool Hub',         keywords: ['wire spool', 'spool hub', 'wire reel'] },
  { id: 'tension_knob',    label: 'Feed Tensioner',         keywords: ['tension knob', 'feed tensioner', 'tensioner arm', 'drive roll tension', 'feed tension'] },
  { id: 'drive_rolls',     label: 'Drive Rolls',            keywords: ['drive rolls', 'drive roll', 'V-groove roll', 'knurled roll'] },
  { id: 'wire_liner',      label: 'Wire Liner',             keywords: ['wire liner', 'wire inlet liner', 'gun liner', 'torch liner'] },
  { id: 'cold_feed',       label: 'Cold Feed Switch',       keywords: ['cold feed', 'cold wire feed', 'cold feed switch', 'Cold Wire Feed'] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escapes special regex characters in a string for safe use in RegExp. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Scans text and returns the machine component hotspot IDs + labels that appear
 * to be referenced. Deduplicates by component ID — only one entry per component
 * even if multiple keywords match.
 */
export function detectDiagramRefs(text: string): Array<{ id: string; label: string }> {
  const found: Array<{ id: string; label: string }> = []
  const seen = new Set<string>()

  for (const entry of DIAGRAM_KEYWORD_MAP) {
    if (seen.has(entry.id)) continue
    for (const kw of entry.keywords) {
      if (new RegExp(escapeRegex(kw), 'i').test(text)) {
        found.push({ id: entry.id, label: entry.label })
        seen.add(entry.id)
        break // move on to next component
      }
    }
  }

  return found
}
