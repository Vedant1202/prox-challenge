'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ArtifactFrame from './ArtifactFrame'
import PageImage from './PageImage'
import ActivitySteps, { Step } from './ActivitySteps'

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

export default function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="chat chat-end mb-4">
        <div className="chat-bubble text-sm leading-relaxed max-w-[75%]">
          {message.content}
        </div>
      </div>
    )
  }

  const { cleaned, html, title } = parseArtifact(message.content)
  const finalHtml = message.artifactHtml || html
  const finalTitle = message.artifactTitle || title || 'Interactive Visual'

  return (
    <div className="chat chat-start mb-6">
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

            {message.pageImages && message.pageImages.length > 0 && (
              <div
                className="mt-3"
                style={{
                  display: 'grid',
                  gap: 8,
                  gridTemplateColumns: message.pageImages.length > 1 ? '1fr 1fr' : '1fr',
                }}
              >
                {message.pageImages.map(img => (
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

            {finalHtml && (
              <ArtifactFrame html={finalHtml} title={finalTitle} defaultExpanded={false} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
