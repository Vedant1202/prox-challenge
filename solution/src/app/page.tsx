'use client'

/**
 * Home page — root layout and orchestration for the Vulcan OmniPro 220 chat UI.
 *
 * This component is intentionally thin. All heavy logic lives in hooks:
 *   - useChat        → chat list, active chat, message cache, CRUD
 *   - useRateLimit   → rate-limit state and countdown
 *   - useSendMessage → SSE stream parsing and message sending
 *
 * View routing: 'chat' | 'diagram' | 'manual' — controlled by local state.
 * The diagram view supports deep-linking from a chat message chip and returning
 * to the originating message on close.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import ChatMessage from '@/components/ChatMessage'
import ChatSidebar from '@/components/ChatSidebar'
import AppHeader from '@/components/AppHeader'
import ChatInput from '@/components/ChatInput'
import EmptyState from '@/components/EmptyState'
import { MachineDiagramPage } from '@/components/MachineDiagram'
import ManualViewer from '@/components/ManualViewer'
import FingerprintProvider, { useFingerprintId } from '@/components/FingerprintProvider'
import ModelSelector, { type Model } from '@/components/ModelSelector'
import { useChat } from '@/hooks/useChat'
import { useRateLimit } from '@/hooks/useRateLimit'
import { useSendMessage } from '@/hooks/useSendMessage'

// ── Inner component (needs FingerprintProvider context) ───────────────────────

function HomeInner() {
  const fingerprintId = useFingerprintId()

  // ── UI state ───────────────────────────────────────────────────────────────
  const [input, setInput] = useState('')
  const [view, setView] = useState<'chat' | 'diagram' | 'manual'>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [checklistState, setChecklistState] = useState<Map<string, boolean[]>>(new Map())
  const [model, setModel] = useState<Model>('claude-sonnet-4-6')
  const [modelSwitchingAllowed, setModelSwitchingAllowed] = useState(false)

  // Deep-link state — set when a diagram-ref chip in a message is clicked
  const [pendingDiagramHotspot, setPendingDiagramHotspot] = useState<string | null>(null)
  const [diagramReturnMsgIndex, setDiagramReturnMsgIndex] = useState<number | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Domain hooks ───────────────────────────────────────────────────────────
  const { rateLimit, setRateLimit, windowMinutes, setWindowMinutes, isRateLimited, countdown } =
    useRateLimit()

  const {
    chats, setChats,
    activeChatId,
    messages, setMessages,
    activeChatIdRef, streamingChatId,
    chatMsgCache, chatModelCache,
    setModelSwitchingAllowed: setChatModelSwitchingAllowed,
    createNewChat, selectChat, handleNewChat, handleDeleteChat,
  } = useChat({ model, setModel })

  const { sendMessage, isLoading } = useSendMessage({
    activeChatId,
    activeChatIdRef,
    streamingChatId,
    chatMsgCache,
    chatModelCache,
    model,
    fingerprintId,
    rateLimit,
    checklistState,
    setMessages,
    setRateLimit,
    setChecklistState,
    setChats,
    createNewChat,
  })

  // ── Config fetch (once on mount) ───────────────────────────────────────────
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then((cfg: {
        modelSwitchingAllowed: boolean
        defaultModel: string
        rateLimit: { requests: number; windowMinutes: number }
      }) => {
        setModelSwitchingAllowed(cfg.modelSwitchingAllowed)
        setChatModelSwitchingAllowed(cfg.modelSwitchingAllowed)
        setWindowMinutes(cfg.rateLimit.windowMinutes)
        setModel(cfg.defaultModel as Model)
      })
      .catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to the bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Wraps selectChat with sidebar close (sidebar should close on mobile). */
  const handleSelectChat = useCallback(
    (id: string) => {
      setSidebarOpen(false)
      selectChat(id)
    },
    [selectChat]
  )

  function handleModelChange(newModel: Model) {
    setModel(newModel)
    // Persist to the per-chat cache so it is restored on re-selection
    if (activeChatIdRef.current) {
      chatModelCache.current.set(activeChatIdRef.current, newModel)
    }
  }

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

  /** Switches view, clearing any diagram deep-link state. */
  function handleViewChange(v: 'chat' | 'diagram' | 'manual') {
    setPendingDiagramHotspot(null)
    setDiagramReturnMsgIndex(null)
    setSidebarOpen(false)
    setView(v)
  }

  /** Called when a diagram-ref chip in a message is clicked. */
  function handleDiagramChipClick(hotspotId: string, msgIndex: number) {
    setPendingDiagramHotspot(hotspotId)
    setDiagramReturnMsgIndex(msgIndex)
    setView('diagram')
  }

  /** Closes the diagram view, scrolling back to the originating message if deep-linked. */
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Aurora background */}
      <div className="aurora-bg" aria-hidden="true" />

      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        view={view}
        onViewChange={handleViewChange}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div className="flex flex-col flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>

        {/* ── Non-chat overlays ─────────────────────────────────────────────── */}
        {view === 'diagram' && (
          <MachineDiagramPage
            onClose={handleDiagramClose}
            initialHotspotId={pendingDiagramHotspot ?? undefined}
            onBackToMessage={diagramReturnMsgIndex !== null ? handleDiagramClose : undefined}
          />
        )}
        {view === 'manual' && <ManualViewer onClose={() => setView('chat')} />}

        {/* ── Chat view ─────────────────────────────────────────────────────── */}
        {view === 'chat' && (
          <>
            <AppHeader
              model={model}
              onModelChange={handleModelChange}
              modelSwitchingAllowed={modelSwitchingAllowed}
              rateLimit={rateLimit}
              windowMinutes={windowMinutes}
              onMenuOpen={() => setSidebarOpen(true)}
            />

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto" data-testid="scroll-container">
              <div className="py-6 px-5" style={{ maxWidth: 800, width: '100%', margin: '0 auto' }}>
                {isEmpty ? (
                  <EmptyState onSendMessage={sendMessage} />
                ) : (
                  messages.map((msg, i) => (
                    <ChatMessage
                      key={i}
                      message={msg}
                      messageIndex={i}
                      checklistChecked={
                        activeChatId
                          ? checklistState.get(`${activeChatId}:${i}`)
                          : undefined
                      }
                      onChecklistToggle={
                        activeChatId
                          ? itemIdx => handleChecklistToggle(activeChatId, i, itemIdx)
                          : undefined
                      }
                      onDiagramRef={hotspotId => handleDiagramChipClick(hotspotId, i)}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Rate-limit countdown card */}
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
                    <svg
                      width="16" height="16" viewBox="0 0 16 16"
                      fill="none" stroke="#ef4444" strokeWidth="1.5"
                    >
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

            {/* Input bar */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={text => { sendMessage(text); setInput('') }}
              disabled={isLoading}
              isRateLimited={isRateLimited}
              countdown={countdown}
              hasMessages={!isEmpty}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Public export — wraps with FingerprintProvider ────────────────────────────

export default function Home() {
  return (
    <FingerprintProvider>
      <HomeInner />
    </FingerprintProvider>
  )
}
