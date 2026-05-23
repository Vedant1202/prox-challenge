'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ArtifactFrame from './ArtifactFrame'
import PageImage from './PageImage'
import ActivitySteps, { Step } from './ActivitySteps'
import ChecklistCard, { ChecklistItem } from './ChecklistCard'

// ─── Diagram reference detection ──────────────────────────────────────────────

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectDiagramRefs(text: string): Array<{ id: string; label: string }> {
  const found: Array<{ id: string; label: string }> = []
  const seen = new Set<string>()
  for (const entry of DIAGRAM_KEYWORD_MAP) {
    if (seen.has(entry.id)) continue
    for (const kw of entry.keywords) {
      if (new RegExp(escapeRegex(kw), 'i').test(text)) {
        found.push({ id: entry.id, label: entry.label })
        seen.add(entry.id)
        break
      }
    }
  }
  return found
}

export interface PageImageData {
  page_id: string
  url: string
  page_num: number
  source: string
  summary?: string
  show_by_default?: boolean
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  pageImages?: PageImageData[]
  artifactHtml?: string
  artifactTitle?: string
  isStreaming?: boolean
  steps?: Step[]
  rateLimited?: boolean
  resetAt?: number
  checklist?: { title: string; items: ChecklistItem[] }
}

function parseArtifact(text: string): { cleaned: string; html: string | null; title: string | null } {
  const artifactRegex = /<artifact[^>]*type="html"[^>]*>([\s\S]*?)<\/artifact>/i
  const match = text.match(artifactRegex)
  if (!match) return { cleaned: text, html: null, title: null }

  const titleMatch = text.match(/<artifact[^>]*title="([^"]*)"/)
  const title = titleMatch ? titleMatch[1] : 'Interactive Component'
  const html = match[1].trim()
  const cleaned = text.replace(match[0], '').trim()
  return { cleaned, html, title }
}

interface ChatMessageProps {
  message: Message
  messageIndex?: number
  checklistChecked?: boolean[]
  onChecklistToggle?: (index: number) => void
  onDiagramRef?: (hotspotId: string) => void
}

export default function ChatMessage({ message, messageIndex, checklistChecked, onChecklistToggle, onDiagramRef }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="chat chat-end mb-4" data-message-index={messageIndex}>
        <div className="chat-bubble text-sm leading-relaxed max-w-[75%]">
          {message.content}
        </div>
      </div>
    )
  }

  const { cleaned, html, title } = parseArtifact(message.content)
  const finalHtml = message.artifactHtml || html
  const finalTitle = message.artifactTitle || title || 'Interactive Visual'

  const diagramRefs =
    onDiagramRef && !message.isStreaming
      ? detectDiagramRefs(cleaned || message.content)
      : []

  return (
    <div className="chat chat-start mb-6" data-message-index={messageIndex}>
      <div className="chat-image">
        <div
          className="flex items-center justify-center rounded-full text-white font-bold"
          style={{
            width: 28,
            height: 28,
            fontSize: 11,
            background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
            flexShrink: 0,
          }}
        >
          W
        </div>
      </div>
      <div className="chat-bubble" style={{ maxWidth: '100%' }}>
        {/* Show activity steps while streaming */}
        {message.isStreaming && message.steps && message.steps.length > 0 && (
          <ActivitySteps steps={message.steps} />
        )}

        {/* Rate-limited placeholder */}
        {!message.isStreaming && message.rateLimited && (
          <div className="flex items-center gap-2 text-sm text-base-content/50 py-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#ef4444" strokeWidth="1.5" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="6" />
              <path d="M7 4.5v3L8.5 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: '#ef4444' }}>Rate limit reached — see the countdown above to know when you can send again.</span>
          </div>
        )}

        {/* Full response after stream completes */}
        {!message.isStreaming && !message.rateLimited && (
          <div className="message-reveal">
            <div className="prose text-sm text-base-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {cleaned || message.content}
              </ReactMarkdown>
            </div>

            {/* Diagram reference chips — links to specific hotspots on the machine diagram */}
            {diagramRefs.length > 0 && onDiagramRef && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-base-content/[0.05]">
                <span className="flex items-center gap-1 text-[10px] text-base-content/30 mr-0.5 flex-shrink-0">
                  <svg width="9" height="9" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="4" y="4" width="6" height="6" rx="1" />
                    <path d="M7 1v3M7 10v3M1 7h3M10 7h3" />
                  </svg>
                  Diagram
                </span>
                {diagramRefs.map(ref => (
                  <button
                    key={ref.id}
                    onClick={() => onDiagramRef(ref.id)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all duration-150"
                    style={{
                      background: 'rgba(129,140,248,0.07)',
                      border: '1px solid rgba(129,140,248,0.15)',
                      color: 'rgba(129,140,248,0.72)',
                      cursor: 'pointer',
                    }}
                  >
                    {ref.label}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 6.5L6.5 1.5M3.5 1.5h3v3" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {(() => {
              const checklistImageIds = new Set(
                message.checklist?.items.map(i => i.image_id).filter(Boolean) ?? []
              )
              const visiblePageImages = (message.pageImages ?? []).filter(
                img => !checklistImageIds.has(img.page_id)
              )
              return visiblePageImages.length > 0 ? (
                <div
                  className="mt-3"
                  style={{
                    display: 'grid',
                    gap: 8,
                    gridTemplateColumns: visiblePageImages.length > 1 ? '1fr 1fr' : '1fr',
                  }}
                >
                  {visiblePageImages.map(img => (
                    <PageImage
                      key={img.page_id}
                      url={img.url}
                      pageNum={img.page_num}
                      source={img.source}
                      summary={img.summary}
                      defaultExpanded={img.show_by_default ?? false}
                    />
                  ))}
                </div>
              ) : null
            })()}

            {message.checklist && (
              <ChecklistCard
                title={message.checklist.title}
                items={message.checklist.items}
                checked={checklistChecked ?? message.checklist.items.map(() => false)}
                onToggle={onChecklistToggle ?? (() => {})}
              />
            )}

            {finalHtml && (
              <ArtifactFrame html={finalHtml} title={finalTitle} defaultExpanded={false} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
