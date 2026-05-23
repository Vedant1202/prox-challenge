'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage, { Message, PageImageData } from '@/components/ChatMessage'
import ChatSidebar, { ChatRecord } from '@/components/ChatSidebar'
import { MachineDiagramPage } from '@/components/MachineDiagram'
import ManualViewer from '@/components/ManualViewer'
import SiriOrb from '@/components/SiriOrb'
import ThemeToggle from '@/components/ThemeToggle'
import RateLimitBadge from '@/components/RateLimitBadge'
import ModelSelector, { type Model } from '@/components/ModelSelector'
import FingerprintProvider, { useFingerprintId } from '@/components/FingerprintProvider'
import type { Step } from '@/components/ActivitySteps'

// Per-chat message snapshot — persists in-flight streaming state across chat switches
type MsgCache = Map<string, Message[]>
type ModelCache = Map<string, Model>

const STEP_LABELS: Record<string, string> = {
  search_corpus: 'Searching manual…',
  get_page_image: 'Loading page image…',
  show_artifact: 'Building visual…',
  show_checklist: 'Building checklist…',
}

const SUGGESTED_QUESTIONS = [
  "What's the duty cycle for MIG at 200A on 240V?",
  "What polarity setup do I need for TIG welding?",
  "I'm getting porosity in my flux-cored welds. What should I check?",
  "Show me the wire feed mechanism.",
  "What wire speed and voltage for MIG on 1/4\" steel?",
]

interface RateLimitState {
  used: number
  limit: number
  resetAt: number
}

function formatCountdown(resetAt: number): string {
  const ms = Math.max(0, resetAt - Date.now())
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function buildChecklistContext(msgs: Message[], state: Map<string, boolean[]>, cId: string): string {
  const parts: string[] = []
  msgs.forEach((msg, i) => {
    if (!msg.checklist) return
    const key = `${cId}:${i}`
    const checked = state.get(key) ?? []
    const checkedCount = checked.filter(Boolean).length
    if (checkedCount === 0) return
    const checkedSteps = checked
      .map((c, j) => (c ? `step ${j + 1}` : null))
      .filter(Boolean)
      .join(', ')
    parts.push(`[Checklist "${msg.checklist.title}": ${checkedCount}/${msg.checklist.items.length} steps done (${checkedSteps} completed)]`)
  })
  return parts.length > 0 ? '\n\n' + parts.join('\n') : ''
}

function HomeInner() {
  const fingerprintId = useFingerprintId()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [chats, setChats] = useState<ChatRecord[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const [view, setView] = useState<'chat' | 'diagram' | 'manual'>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [checklistState, setChecklistState] = useState<Map<string, boolean[]>>(new Map())

  // Deep-link state — set when a diagram ref chip is clicked in a chat message
  const [pendingDiagramHotspot, setPendingDiagramHotspot] = useState<string | null>(null)
  const [diagramReturnMsgIndex, setDiagramReturnMsgIndex] = useState<number | null>(null)

  const [rateLimit, setRateLimit] = useState<RateLimitState | null>(null)
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [model, setModel] = useState<Model>('claude-sonnet-4-6')
  const [modelSwitchingAllowed, setModelSwitchingAllowed] = useState(false)
  const [countdown, setCountdown] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Per-chat caches (session-only, survive chat switching)
  const chatMsgCache = useRef<MsgCache>(new Map())
  const chatModelCache = useRef<ModelCache>(new Map())
  // Ref mirrors of state for use inside async stream callbacks
  const activeChatIdRef = useRef<string | null>(null)
  const streamingChatId = useRef<string | null>(null)

  const requestHeaders = useCallback((withJson = false): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (withJson) headers['Content-Type'] = 'application/json'
    if (fingerprintId) headers['X-Client-Fingerprint'] = fingerprintId
    return headers
  }, [fingerprintId])

  // Keep ref mirror of activeChatId for use in async stream callbacks
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  // Load config once
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((cfg: { modelSwitchingAllowed: boolean; defaultModel: string; rateLimit: { requests: number; windowMinutes: number } }) => {
        setModelSwitchingAllowed(cfg.modelSwitchingAllowed)
        setWindowMinutes(cfg.rateLimit.windowMinutes)
        setModel(cfg.defaultModel as Model)
      })
      .catch(console.error)
  }, [])

  // Countdown ticker when rate-limited
  useEffect(() => {
    if (!rateLimit || rateLimit.used < rateLimit.limit) {
      setCountdown(null)
      return
    }
    const tick = () => setCountdown(formatCountdown(rateLimit.resetAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [rateLimit])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!fingerprintId) return

    fetch('/api/chats', { headers: requestHeaders() })
      .then(r => r.json())
      .then(({ chats: list }: { chats: ChatRecord[] }) => {
        if (list.length > 0) {
          setChats(list)
          selectChat(list[0].id)
        }
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprintId, requestHeaders])

  async function createNewChat(): Promise<string> {
    const res = await fetch('/api/chats', { method: 'POST', headers: requestHeaders(true), body: JSON.stringify({}) })
    const { chat } = await res.json() as { chat: ChatRecord }
    setChats(prev => [chat, ...prev])
    setActiveChatId(chat.id)
    activeChatIdRef.current = chat.id
    chatMsgCache.current.set(chat.id, [])
    setMessages([])
    return chat.id
  }

  function selectChat(id: string) {
    setActiveChatId(id)
    activeChatIdRef.current = id
    setSidebarOpen(false)

    // Show cached snapshot immediately — no blank flash for in-flight or visited chats
    const cached = chatMsgCache.current.get(id)
    setMessages(cached ?? [])

    // Restore last-used model for this chat
    if (modelSwitchingAllowed) {
      const savedModel = chatModelCache.current.get(id)
      if (savedModel) setModel(savedModel)
    }

    // Skip DB fetch while this chat is actively streaming (cache is authoritative)
    if (streamingChatId.current === id) return

    fetch(`/api/chats/${id}/messages`, { headers: requestHeaders() })
      .then(r => r.json())
      .then(({ messages: loaded }: { messages: Message[] }) => {
        // Abort if we've switched away or if streaming started for this chat
        if (activeChatIdRef.current !== id || streamingChatId.current === id) return
        chatMsgCache.current.set(id, loaded)
        setMessages(loaded)
      })
      .catch(console.error)
  }

  function handleNewChat() {
    setActiveChatId(null)
    setMessages([])
    setInput('')
    setSidebarOpen(false)
  }

  function handleDeleteChat(id: string) {
    fetch(`/api/chats/${id}`, { method: 'DELETE', headers: requestHeaders() }).catch(console.error)
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

    // Block if rate limited
    if (rateLimit && rateLimit.used >= rateLimit.limit) return

    let chatId = activeChatId
    if (!chatId) chatId = await createNewChat()

    // Append checklist context if any items are checked
    const checklistCtx = buildChecklistContext(
      chatMsgCache.current.get(chatId!) ?? [],
      checklistState,
      chatId!
    )
    const messageContent = trimmed + checklistCtx

    // Record model for this chat
    chatModelCache.current.set(chatId, model)

    // Helper: update the per-chat cache AND the visible messages state only if this chat is active
    const applyChatUpdate = (updater: (prev: Message[]) => Message[]) => {
      const current = chatMsgCache.current.get(chatId!) ?? []
      const next = updater(current)
      chatMsgCache.current.set(chatId!, next)
      if (activeChatIdRef.current === chatId) setMessages(next)
    }

    const userMessage: Message = { role: 'user', content: trimmed }
    applyChatUpdate(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    streamingChatId.current = chatId

    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      pageImages: [],
      isStreaming: true,
      steps: [{ label: 'Thinking…', status: 'active' }],
    }
    // Capture assistant index before adding it (cache already has user message)
    const assistantIdx = (chatMsgCache.current.get(chatId!) ?? []).length
    applyChatUpdate(prev => [...prev, assistantMsg])

    // Build history from cache — replace last user message content with checklist-augmented version
    const historyForApi = (chatMsgCache.current.get(chatId) ?? [])
      .filter(m => !m.isStreaming)
      .map((m, i, arr) => {
        if (m.role === 'user' && i === arr.length - 1) return { role: m.role, content: messageContent }
        return { role: m.role, content: m.content }
      })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: requestHeaders(true),
        body: JSON.stringify({
          chatId,
          model,
          messages: historyForApi,
        }),
      })

      // Handle rate limit
      if (res.status === 429) {
        const data = await res.json() as { reset_at: number; used: number; limit: number }
        setRateLimit({ used: data.used, limit: data.limit, resetAt: data.reset_at })
        applyChatUpdate(prev => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: '',
            isStreaming: false,
            rateLimited: true,
            resetAt: data.reset_at,
          }
          return next
        })
        return
      }

      // Read rate limit headers from successful response
      const rlUsed = res.headers.get('X-Rate-Limit-Used')
      const rlLimit = res.headers.get('X-Rate-Limit-Limit')
      const rlReset = res.headers.get('X-Rate-Limit-Reset')
      if (rlUsed && rlLimit && rlReset) {
        setRateLimit({ used: parseInt(rlUsed), limit: parseInt(rlLimit), resetAt: parseInt(rlReset) })
      }

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
        applyChatUpdate(prev => {
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
            } else if (event.type === 'artifact') {
              applyChatUpdate(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  artifactHtml: event.html,
                  artifactTitle: event.title,
                }
                return next
              })
            } else if (event.type === 'checklist') {
              setChecklistState(prev => {
                const key = `${chatId}:${assistantIdx}`
                if (prev.has(key)) return prev
                const m = new Map(prev)
                m.set(key, new Array(event.items.length).fill(false))
                return m
              })
              applyChatUpdate(prev => {
                const next = [...prev]
                next[assistantIdx] = {
                  ...next[assistantIdx],
                  checklist: { title: event.title, items: event.items },
                }
                return next
              })
            } else if (event.type === 'done') {
              applyChatUpdate(prev => {
                const next = [...prev]
                next[next.length - 1] = {
                  ...next[next.length - 1],
                  content: fullText,
                  pageImages: [...pageImages],
                  isStreaming: false,
                }
                return next
              })
              fetch('/api/chats', { headers: requestHeaders() })
                .then(r => r.json())
                .then(({ chats: list }: { chats: ChatRecord[] }) => setChats(list))
                .catch(console.error)
            }
          } catch { /* ignore malformed SSE */ }
        }
      }
    } catch (err) {
      applyChatUpdate(prev => {
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
      streamingChatId.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, activeChatId, model, rateLimit, checklistState, requestHeaders])

  function handleChecklistToggle(cId: string, msgIdx: number, itemIdx: number) {
    const key = `${cId}:${msgIdx}`
    setChecklistState(prev => {
      const m = new Map(prev)
      const current = m.get(key) ?? []
      const next = [...current]
      next[itemIdx] = !next[itemIdx]
      return new Map(m).set(key, next)
    })
  }

  function handleModelChange(newModel: Model) {
    setModel(newModel)
    if (activeChatIdRef.current) {
      chatModelCache.current.set(activeChatIdRef.current, newModel)
    }
  }

  // Clears deep-link state on normal (sidebar) view navigation
  function handleViewChange(v: 'chat' | 'diagram' | 'manual') {
    setPendingDiagramHotspot(null)
    setDiagramReturnMsgIndex(null)
    setSidebarOpen(false)
    setView(v)
  }

  // Called when a diagram ref chip in a message is clicked
  function handleDiagramChipClick(hotspotId: string, msgIndex: number) {
    setPendingDiagramHotspot(hotspotId)
    setDiagramReturnMsgIndex(msgIndex)
    setView('diagram')
  }

  // Called when closing the diagram view (both normal close and deep-link return)
  function handleDiagramClose() {
    const returnIdx = diagramReturnMsgIndex
    setPendingDiagramHotspot(null)
    setDiagramReturnMsgIndex(null)
    setView('chat')
    if (returnIdx !== null) {
      setTimeout(() => {
        const el = document.querySelector(`[data-message-index="${returnIdx}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0
  const isRateLimited = rateLimit !== null && rateLimit.used >= rateLimit.limit

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
        view={view}
        onViewChange={handleViewChange}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>
        {view === 'diagram' && (
          <MachineDiagramPage
            onClose={handleDiagramClose}
            initialHotspotId={pendingDiagramHotspot ?? undefined}
            onBackToMessage={diagramReturnMsgIndex !== null ? handleDiagramClose : undefined}
          />
        )}
        {view === 'manual' && <ManualViewer onClose={() => setView('chat')} />}
        {view !== 'chat' ? null : (<>

        {/* Header — z-index keeps it above chat bubbles (which create stacking contexts via backdrop-filter) */}
        <header className="glass border-b flex items-center gap-3 px-4 py-3 flex-shrink-0 relative z-10">
          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden btn btn-ghost btn-sm btn-circle flex-shrink-0"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M2 4h12M2 8h12M2 12h12"/>
            </svg>
          </button>
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
            <div className="text-xs text-base-content/50">Welder Assistant (made by @Vedant1202)</div>
          </div>
          <div className="flex-1" />

          <ModelSelector
            value={model}
            onChange={handleModelChange}
            readOnly={!modelSwitchingAllowed}
          />

          {rateLimit && (
            <RateLimitBadge
              used={rateLimit.used}
              limit={rateLimit.limit}
              resetAt={rateLimit.resetAt}
              windowMinutes={windowMinutes}
            />
          )}

          <ThemeToggle />
        </header>

        {/* Messages area — outer div spans full column width so wheel events fire everywhere */}
        <div className="flex-1 overflow-y-auto" data-testid="scroll-container">
          <div className="py-6 px-5" style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}>
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
              messages.map((msg, i) => (
                <ChatMessage
                  key={i}
                  message={msg}
                  messageIndex={i}
                  checklistChecked={activeChatId ? checklistState.get(`${activeChatId}:${i}`) : undefined}
                  onChecklistToggle={activeChatId ? (itemIdx) => handleChecklistToggle(activeChatId, i, itemIdx) : undefined}
                  onDiagramRef={(hotspotId) => handleDiagramChipClick(hotspotId, i)}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Rate limit countdown card */}
        {isRateLimited && countdown && (
          <div
            className="flex-shrink-0 px-5 pb-2"
            style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}
          >
            <div
              className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(239,68,68,0.2)' }}
            >
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 32, height: 32, background: 'rgba(239,68,68,0.1)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M8 5v3.5L10 10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-base-content">Rate limit reached</div>
                <div className="text-xs text-base-content/50">
                  You&apos;ve used all {rateLimit!.limit} messages for this window. Resets in{' '}
                  <span className="font-mono text-base-content/70">{countdown}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input area */}
        <div
          className="flex-shrink-0 px-3 sm:px-5 pb-5 pt-3"
          style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}
        >
          <div className="input-glow">
            <div className="glass-card rounded-2xl px-4 py-2 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRateLimited
                    ? `Rate limit reached — try again in ${countdown ?? '…'}`
                    : 'Ask about settings, troubleshooting, polarity, duty cycle…'
                }
                rows={1}
                className="flex-1 bg-transparent border-none outline-none text-sm text-base-content placeholder:text-base-content/35 resize-none leading-relaxed"
                style={{ maxHeight: 120, overflow: 'auto', paddingTop: 4, paddingBottom: 4 }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
                disabled={isLoading || isRateLimited}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading || isRateLimited}
                className="btn btn-sm btn-circle flex-shrink-0 border-none transition-all duration-150"
                style={{
                  background: !input.trim() || isLoading || isRateLimited
                    ? 'rgba(129,140,248,0.12)'
                    : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                  color: !input.trim() || isLoading || isRateLimited ? 'rgba(129,140,248,0.4)' : '#fff',
                }}
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>
          {!isEmpty && !isRateLimited && (
            <div className="text-center mt-2">
              <span className="text-xs text-base-content/30">Press Enter to send · Shift+Enter for new line</span>
            </div>
          )}
        </div>

        </>)}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <FingerprintProvider>
      <HomeInner />
    </FingerprintProvider>
  )
}
