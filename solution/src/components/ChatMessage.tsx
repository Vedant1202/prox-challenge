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
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  pageImages?: PageImageData[]
  artifactHtml?: string
  artifactTitle?: string
  isStreaming?: boolean
  steps?: Step[]
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
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div
          style={{
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: '16px 16px 4px 16px',
            padding: '10px 14px',
            maxWidth: '75%',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#e5e5e5',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  const { cleaned, html, title } = parseArtifact(message.content)
  const finalHtml = message.artifactHtml || html
  const finalTitle = message.artifactTitle || title || 'Interactive Component'

  return (
    <div style={{ marginBottom: '24px', maxWidth: '100%' }}>
      {/* Avatar + name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#000',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          W
        </div>
        <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>Welder Assistant</span>
      </div>

      {/* Activity steps — visible while streaming */}
      {message.isStreaming && message.steps && message.steps.length > 0 && (
        <ActivitySteps steps={message.steps} />
      )}

      {/* Full response — only visible after done */}
      {!message.isStreaming && (
        <div className="message-reveal">
          <div className="prose" style={{ fontSize: '14px', lineHeight: '1.65' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleaned || message.content}
            </ReactMarkdown>
          </div>

          {message.pageImages && message.pageImages.length > 0 && (
            <div
              style={{
                marginTop: '12px',
                display: 'grid',
                gap: '8px',
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
                />
              ))}
            </div>
          )}

          {finalHtml && <ArtifactFrame html={finalHtml} title={finalTitle} />}
        </div>
      )}
    </div>
  )
}
