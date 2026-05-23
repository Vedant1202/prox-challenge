'use client'

/**
 * useSendMessage — orchestrates a streaming chat request and updates message state.
 *
 * Flow:
 *   1. Guard: skip if already loading or rate-limited
 *   2. Ensure a chat exists (creates one if activeChatId is null)
 *   3. Append the user message + a streaming placeholder for the assistant
 *   4. POST to /api/chat and read the SSE stream
 *   5. Process events: text, tool_call, page_image, artifact, checklist, done
 *   6. Finalize the assistant message and refresh the chat list
 */
import { useState, useRef, useCallback } from 'react'
import type { Message, PageImageData } from '@/components/ChatMessage'
import type { ChatRecord } from '@/components/ChatSidebar'
import type { Step } from '@/components/ActivitySteps'
import type { Model } from '@/components/ModelSelector'
import type { RateLimitState } from './useRateLimit'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Human-readable labels for each tool call, shown in the activity steps UI. */
const STEP_LABELS: Record<string, string> = {
  search_corpus: 'Searching manual…',
  get_page_image: 'Loading page image…',
  show_artifact: 'Building visual…',
  show_checklist: 'Building checklist…',
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MsgCache = Map<string, Message[]>
type ModelCache = Map<string, Model>

interface UseSendMessageParams {
  activeChatId: string | null
  activeChatIdRef: React.MutableRefObject<string | null>
  streamingChatId: React.MutableRefObject<string | null>
  chatMsgCache: React.MutableRefObject<MsgCache>
  chatModelCache: React.MutableRefObject<ModelCache>
  model: Model
  fingerprintId: string | null
  rateLimit: RateLimitState | null
  checklistState: Map<string, boolean[]>
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  setRateLimit: (rl: RateLimitState | null) => void
  setChecklistState: React.Dispatch<React.SetStateAction<Map<string, boolean[]>>>
  setChats: React.Dispatch<React.SetStateAction<ChatRecord[]>>
  createNewChat: () => Promise<string>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds an optional context string describing which checklist steps the user
 * has already completed. Appended to the user message so the assistant can
 * give follow-up advice that accounts for progress.
 */
function buildChecklistContext(
  msgs: Message[],
  state: Map<string, boolean[]>,
  chatId: string
): string {
  const parts: string[] = []
  msgs.forEach((msg, i) => {
    if (!msg.checklist) return
    const key = `${chatId}:${i}`
    const checked = state.get(key) ?? []
    const checkedCount = checked.filter(Boolean).length
    if (checkedCount === 0) return
    const checkedSteps = checked
      .map((c, j) => (c ? `step ${j + 1}` : null))
      .filter(Boolean)
      .join(', ')
    parts.push(
      `[Checklist "${msg.checklist.title}": ${checkedCount}/${msg.checklist.items.length} steps done (${checkedSteps} completed)]`
    )
  })
  return parts.length > 0 ? '\n\n' + parts.join('\n') : ''
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSendMessage({
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
}: UseSendMessageParams) {
  const [isLoading, setIsLoading] = useState(false)
  // Ref-based isLoading so the guard inside the callback always reads current value
  const isLoadingRef = useRef(false)

  /**
   * Applies an updater to the per-chat message cache and, if this chat is
   * currently active, also updates the visible messages state.
   */
  const makeApplyChatUpdate = useCallback(
    (chatId: string) =>
      (updater: (prev: Message[]) => Message[]) => {
        const current = chatMsgCache.current.get(chatId) ?? []
        const next = updater(current)
        chatMsgCache.current.set(chatId, next)
        if (activeChatIdRef.current === chatId) setMessages(next)
      },
    [chatMsgCache, activeChatIdRef, setMessages]
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoadingRef.current) return

      // Block while rate-limited
      if (rateLimit && rateLimit.used >= rateLimit.limit) return

      let chatId = activeChatId
      if (!chatId) chatId = await createNewChat()

      // Append checklist progress context if any steps have been checked
      const checklistCtx = buildChecklistContext(
        chatMsgCache.current.get(chatId!) ?? [],
        checklistState,
        chatId!
      )
      const messageContent = trimmed + checklistCtx

      // Record the model used for this chat (restored on next selectChat)
      chatModelCache.current.set(chatId, model)

      const applyChatUpdate = makeApplyChatUpdate(chatId)

      // Add user message to cache + visible state
      applyChatUpdate(prev => [...prev, { role: 'user', content: trimmed }])

      isLoadingRef.current = true
      setIsLoading(true)
      streamingChatId.current = chatId

      // Insert streaming placeholder for the assistant response
      const initialSteps: Step[] = [{ label: 'Thinking…', status: 'active' }]
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '',
        pageImages: [],
        isStreaming: true,
        steps: [...initialSteps],
      }
      // Capture the index before appending so checklist events can target it
      const assistantIdx = (chatMsgCache.current.get(chatId!) ?? []).length
      applyChatUpdate(prev => [...prev, assistantPlaceholder])

      // Build the message history for the API, substituting checklist-augmented content
      const historyForApi = (chatMsgCache.current.get(chatId) ?? [])
        .filter(m => !m.isStreaming)
        .map((m, i, arr) => {
          if (m.role === 'user' && i === arr.length - 1) {
            return { role: m.role, content: messageContent }
          }
          return { role: m.role, content: m.content }
        })

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (fingerprintId) headers['X-Client-Fingerprint'] = fingerprintId

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({ chatId, model, messages: historyForApi }),
        })

        // ── Rate limit exceeded ──────────────────────────────────────────────
        if (res.status === 429) {
          const data = (await res.json()) as {
            reset_at: number
            used: number
            limit: number
          }
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

        // Read rate limit headers from a successful response
        const rlUsed  = res.headers.get('X-Rate-Limit-Used')
        const rlLimit = res.headers.get('X-Rate-Limit-Limit')
        const rlReset = res.headers.get('X-Rate-Limit-Reset')
        if (rlUsed && rlLimit && rlReset) {
          setRateLimit({
            used: parseInt(rlUsed),
            limit: parseInt(rlLimit),
            resetAt: parseInt(rlReset),
          })
        }

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        // ── SSE stream processing ────────────────────────────────────────────
        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''
        let fullText  = ''
        const pageImages: PageImageData[] = []
        const steps: Step[] = [{ label: 'Thinking…', status: 'active' }]

        /** Marks the current step done and pushes a new active step. */
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
                  page_id:         event.page_id,
                  url:             event.url,
                  page_num:        event.page_num,
                  source:          event.source,
                  summary:         event.summary,
                  show_by_default: event.show_by_default ?? false,
                })
              } else if (event.type === 'artifact') {
                applyChatUpdate(prev => {
                  const next = [...prev]
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    artifactHtml:  event.html,
                    artifactTitle: event.title,
                  }
                  return next
                })
              } else if (event.type === 'checklist') {
                // Initialise checklist checked state (all unchecked) if not already set
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
                // Finalise the assistant message
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
                // Refresh the sidebar chat list to show the updated title
                fetch('/api/chats')
                  .then(r => r.json())
                  .then(({ chats: list }: { chats: ChatRecord[] }) => setChats(list))
                  .catch(console.error)
              }
            } catch { /* ignore malformed SSE lines */ }
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
        isLoadingRef.current = false
        setIsLoading(false)
        streamingChatId.current = null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeChatId, fingerprintId, model, rateLimit, checklistState, makeApplyChatUpdate, createNewChat]
  )

  return { sendMessage, isLoading }
}
