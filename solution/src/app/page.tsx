'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage, { Message, PageImageData } from '@/components/ChatMessage'
import ChatSidebar, { ChatRecord } from '@/components/ChatSidebar'
import SiriOrb from '@/components/SiriOrb'
import ThemeToggle from '@/components/ThemeToggle'
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
  const [chats, setChats] = useState<ChatRecord[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/chats')
      .then(r => r.json())
      .then(({ chats: list }: { chats: ChatRecord[] }) => {
        if (list.length > 0) {
          setChats(list)
          selectChat(list[0].id)
        }
        // No chats yet → stay on welcome screen; chat is created on first message
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createNewChat(): Promise<string> {
    const res = await fetch('/api/chats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const { chat } = await res.json() as { chat: ChatRecord }
    setChats(prev => [chat, ...prev])
    setActiveChatId(chat.id)
    setMessages([])
    return chat.id
  }

  function selectChat(id: string) {
    setActiveChatId(id)
    fetch(`/api/chats/${id}/messages`)
      .then(r => r.json())
      .then(({ messages: loaded }: { messages: Message[] }) => setMessages(loaded))
      .catch(console.error)
  }

  function handleNewChat() {
    setActiveChatId(null)
    setMessages([])
    setInput('')
  }

  function handleDeleteChat(id: string) {
    fetch(`/api/chats/${id}`, { method: 'DELETE' }).catch(console.error)
    setChats(prev => prev.filter(c => c.id !== id))
    if (activeChatId === id) {
      const remaining = chats.filter(c => c.id !== id)
      if (remaining.length > 0) selectChat(remaining[0].id)
      else handleNewChat()
    }
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    let chatId = activeChatId
    if (!chatId) chatId = await createNewChat()

    const userMessage: Message = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

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
          chatId,
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      const pageImages: PageImageData[] = []
      const steps: Step[] = [{ label: 'Thinking…', status: 'active' }]

      const advanceStep = (nextLabel: string) => {
        const last = steps[steps.length - 1]
        if (last?.status === 'active') last.status = 'done'
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
              fullText += event.text
            } else if (event.type === 'tool_call') {
              advanceStep(STEP_LABELS[event.name] ?? `${event.name}…`)
            } else if (event.type === 'page_image') {
              pageImages.push({
                page_id: event.page_id,
                url: event.url,
                page_num: event.page_num,
                source: event.source,
                summary: event.summary,
                show_by_default: event.show_by_default ?? false,
              })
            } else if (event.type === 'done') {
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
              fetch('/api/chats')
                .then(r => r.json())
                .then(({ chats: list }: { chats: ChatRecord[] }) => setChats(list))
                .catch(console.error)
            }
          } catch { /* ignore malformed SSE */ }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, activeChatId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Aurora background */}
      <div className="aurora-bg" aria-hidden="true" />

      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={selectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>

        {/* Header */}
        <header className="glass border-b flex items-center gap-3 px-5 py-3 flex-shrink-0">
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 13,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            V
          </div>
          <div>
            <div className="font-semibold text-sm text-base-content">Vulcan OmniPro 220</div>
            <div className="text-xs text-base-content/50">Welder Assistant</div>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        {/* Messages area */}
        <div
          className="flex-1 overflow-y-auto py-6 px-5"
          style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}
        >
          {isEmpty ? (
            <div style={{ paddingTop: 48 }}>
              {/* Siri orb hero */}
              <div style={{ marginBottom: 32 }}>
                <SiriOrb size={160} />
              </div>
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <h1 className="text-2xl font-bold text-base-content mb-2">
                  Vulcan OmniPro 220 Assistant
                </h1>
                <p className="text-sm text-base-content/55 max-w-sm mx-auto" style={{ lineHeight: 1.65 }}>
                  Ask anything about setup, settings, troubleshooting, or how to use your welder.
                  I have the full manual and can show you diagrams and interactive visuals.
                </p>
              </div>

              {/* Suggested questions */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxWidth: 560,
                  margin: '0 auto',
                }}
              >
                {SUGGESTED_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="glass-card text-left rounded-xl px-4 py-3 text-sm text-base-content/80 hover:text-base-content transition-colors duration-150 cursor-pointer w-full"
                    style={{ lineHeight: 1.45 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '')}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 px-5 pb-5 pt-3"
          style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}
        >
          <div className="input-glow">
            <div className="glass-card rounded-2xl px-4 py-2 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about settings, troubleshooting, polarity, duty cycle…"
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-sm text-base-content placeholder:text-base-content/35 resize-none leading-relaxed"
                style={{ maxHeight: 120, overflow: 'auto', paddingTop: 4, paddingBottom: 4 }}
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
                className="btn btn-sm btn-circle flex-shrink-0 border-none transition-all duration-150"
                style={{
                  background: !input.trim() || isLoading
                    ? 'rgba(129,140,248,0.12)'
                    : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                  color: !input.trim() || isLoading ? 'rgba(129,140,248,0.4)' : '#fff',
                }}
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>
          {!isEmpty && (
            <div className="text-center mt-2">
              <span className="text-xs text-base-content/30">Press Enter to send · Shift+Enter for new line</span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
