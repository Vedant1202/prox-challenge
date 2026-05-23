'use client'

/**
 * Renders a single chat message — either a user bubble or an assistant reply.
 *
 * Assistant messages can include:
 *   - Streaming activity steps (shown while the response is in flight)
 *   - Markdown text with ReactMarkdown
 *   - Diagram reference chips (deep-links to the machine diagram)
 *   - Manual page image thumbnails
 *   - Interactive checklist card
 *   - Sandboxed HTML artifact
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ArtifactFrame from './ArtifactFrame'
import PageImage from './PageImage'
import ActivitySteps, { Step } from './ActivitySteps'
import ChecklistCard, { ChecklistItem } from './ChecklistCard'
import { detectDiagramRefs } from '@/lib/diagramRefs'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: Message
  messageIndex?: number
  checklistChecked?: boolean[]
  onChecklistToggle?: (index: number) => void
  onDiagramRef?: (hotspotId: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChatMessage({
  message,
  messageIndex,
  checklistChecked,
  onChecklistToggle,
  onDiagramRef,
}: ChatMessageProps) {
  const isUser = message.role === 'user'

  // ── User bubble ────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="chat chat-end mb-4" data-message-index={messageIndex}>
        <div className="chat-bubble text-sm leading-relaxed max-w-[75%]">
          {message.content}
        </div>
      </div>
    )
  }

  // ── Assistant reply ────────────────────────────────────────────────────────

  // Detect diagram component references in the final text for jump-to chips
  const diagramRefs =
    onDiagramRef && !message.isStreaming
      ? detectDiagramRefs(message.content)
      : []

  // Filter page images that are already shown inside checklist steps
  const checklistImageIds = new Set(
    message.checklist?.items.map(i => i.image_id).filter(Boolean) ?? []
  )
  const visiblePageImages = (message.pageImages ?? []).filter(
    img => !checklistImageIds.has(img.page_id)
  )

  return (
    <div className="chat chat-start mb-6" data-message-index={messageIndex}>
      {/* Avatar */}
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
        {/* Activity steps — visible while streaming */}
        {message.isStreaming && message.steps && message.steps.length > 0 && (
          <ActivitySteps steps={message.steps} />
        )}

        {/* Rate-limited placeholder */}
        {!message.isStreaming && message.rateLimited && (
          <div className="flex items-center gap-2 text-sm text-base-content/50 py-1">
            <svg
              width="14" height="14" viewBox="0 0 14 14"
              fill="none" stroke="#ef4444" strokeWidth="1.5" style={{ flexShrink: 0 }}
            >
              <circle cx="7" cy="7" r="6" />
              <path d="M7 4.5v3L8.5 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: '#ef4444' }}>
              Rate limit reached — see the countdown above to know when you can send again.
            </span>
          </div>
        )}

        {/* Full response — rendered after streaming completes */}
        {!message.isStreaming && !message.rateLimited && (
          <div className="message-reveal">
            {/* Markdown text */}
            <div className="prose text-sm text-base-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>

            {/* Diagram reference chips — jump to specific hotspots on the machine diagram */}
            {diagramRefs.length > 0 && onDiagramRef && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-base-content/[0.05]">
                <span className="flex items-center gap-1 text-[10px] text-base-content/30 mr-0.5 flex-shrink-0">
                  <svg
                    width="9" height="9" viewBox="0 0 14 14"
                    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  >
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
                    <svg
                      width="8" height="8" viewBox="0 0 8 8"
                      fill="none" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M1.5 6.5L6.5 1.5M3.5 1.5h3v3" />
                    </svg>
                  </button>
                ))}
              </div>
            )}

            {/* Page image thumbnails (excluding those already inside checklist steps) */}
            {visiblePageImages.length > 0 && (
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
            )}

            {/* Interactive checklist */}
            {message.checklist && (
              <ChecklistCard
                title={message.checklist.title}
                items={message.checklist.items}
                checked={checklistChecked ?? message.checklist.items.map(() => false)}
                onToggle={onChecklistToggle ?? (() => {})}
              />
            )}

            {/* Sandboxed HTML artifact */}
            {message.artifactHtml && (
              <ArtifactFrame
                html={message.artifactHtml}
                title={message.artifactTitle ?? 'Interactive Visual'}
                defaultExpanded={false}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
