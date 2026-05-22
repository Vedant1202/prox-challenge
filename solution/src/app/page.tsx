'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage, { Message, PageImageData } from '@/components/ChatMessage'
import type { Step } from '@/components/ActivitySteps'

const STEP_LABELS: Record<string, string> = {
  search_corpus: 'Searching manual…',
  get_page_image: 'Loading page image…',
  show_artifact: 'Building visual…',
}

const SUGGESTED_QUESTIONS = [
  "What's the duty cycle for MIG at 200A on 240V?",
  "What polarity setup do I need for TIG welding?",
  "I'm getting porosity in my flux-cored welds. What should I check?",
  "Show me the wire feed mechanism.",
  "What wire speed and voltage for MIG on 1/4\" steel?",
]

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: text.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    // Add streaming placeholder with initial "Thinking…" step
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      pageImages: [],
      isStreaming: true,
      steps: [{ label: 'Thinking…', status: 'active' }],
    }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      const pageImages: PageImageData[] = []
      // Local mutable steps array — only pushed to state on tool_call + done
      const steps: Step[] = [{ label: 'Thinking…', status: 'active' }]

      const advanceStep = (nextLabel: string) => {
        // Mark current active step as done
        const last = steps[steps.length - 1]
        if (last && last.status === 'active') last.status = 'done'
        // Push new active step
        steps.push({ label: nextLabel, status: 'active' })
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { ...next[next.length - 1], steps: [...steps] }
          return next
        })
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue

          try {
            const event = JSON.parse(raw)

            if (event.type === 'text') {
              // Buffer silently — revealed only on done
              fullText += event.text
            } else if (event.type === 'tool_call') {
              const label = STEP_LABELS[event.name] ?? `${event.name}…`
              advanceStep(label)
            } else if (event.type === 'page_image') {
              pageImages.push({
                page_id: event.page_id,
                url: event.url,
                page_num: event.page_num,
                source: event.source,
                summary: event.summary,
              })
            } else if (event.type === 'done') {
              // Reveal full response all at once
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: fullText,
                  pageImages: [...pageImages],
                  isStreaming: false,
                }
                return next
              })
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: `Sorry, something went wrong: ${err}. Please check your API key and try again.`,
          isStreaming: false,
        }
        return next
      })
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#111111',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #1e1e1e',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '13px',
            color: '#000',
          }}
        >
          V
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#e5e5e5' }}>
            Vulcan OmniPro 220
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>Welder Assistant</div>
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {isEmpty ? (
          <div style={{ paddingTop: '60px' }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '24px',
                  color: '#000',
                  margin: '0 auto 16px',
                }}
              >
                V
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e5e5e5', margin: '0 0 8px' }}>
                Vulcan OmniPro 220 Assistant
              </h1>
              <p style={{ fontSize: '14px', color: '#888', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
                Ask anything about setup, settings, troubleshooting, or how to use your welder.
                I have the full manual and can show you diagrams, tables, and interactive visuals.
              </p>
            </div>

            {/* Suggested questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '560px', margin: '0 auto' }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: '#ccc',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#1f1f1f'
                    e.currentTarget.style.borderColor = '#3a3a3a'
                    e.currentTarget.style.color = '#e5e5e5'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#1a1a1a'
                    e.currentTarget.style.borderColor = '#2a2a2a'
                    e.currentTarget.style.color = '#ccc'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '12px 20px 20px',
          borderTop: '1px solid #1a1a1a',
          flexShrink: 0,
          maxWidth: '800px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '8px',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '8px 8px 8px 14px',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about settings, troubleshooting, polarity, duty cycle…"
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e5e5e5',
              fontSize: '14px',
              resize: 'none',
              lineHeight: '1.5',
              maxHeight: '120px',
              overflow: 'auto',
              paddingTop: '4px',
              paddingBottom: '4px',
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: !input.trim() || isLoading ? '#2a2a2a' : '#f59e0b',
              color: !input.trim() || isLoading ? '#555' : '#000',
              cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
              fontSize: '14px',
            }}
            aria-label="Send"
          >
            ↑
          </button>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', color: '#444' }}>
              Press Enter to send · Shift+Enter for new line
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
