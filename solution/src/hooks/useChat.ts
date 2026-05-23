'use client'

/**
 * useChat — manages the chat list, the active chat, and the per-chat message cache.
 *
 * Responsibilities:
 *   - Loads the initial chat list from the API on mount
 *   - Maintains a ref-based message cache (MsgCache) so switching between chats
 *     is instant (no blank flash) and in-flight streams are preserved
 *   - Exposes CRUD operations: createNewChat, selectChat, handleNewChat, handleDeleteChat
 *
 * Model restore: selectChat reads `chatModelCache` to restore the last-used model
 * for a given chat. Call `setModelSwitchingAllowed(true)` once config loads to
 * enable this feature at runtime (the ref approach avoids stale closure issues).
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '@/components/ChatMessage'
import type { ChatRecord } from '@/components/ChatSidebar'
import type { Model } from '@/components/ModelSelector'

// ── Types ─────────────────────────────────────────────────────────────────────

/** In-session snapshot of messages per chat (avoids blank flash on tab switch). */
type MsgCache = Map<string, Message[]>
/** Remembers the last-used model per chat so it is restored on re-selection. */
type ModelCache = Map<string, Model>

export interface UseChatReturn {
  chats: ChatRecord[]
  setChats: React.Dispatch<React.SetStateAction<ChatRecord[]>>
  activeChatId: string | null
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  /** Stable ref — safe to read from async stream callbacks without stale closure. */
  activeChatIdRef: React.MutableRefObject<string | null>
  /** Set to a chatId while its stream is active; selectChat skips DB fetch if it matches. */
  streamingChatId: React.MutableRefObject<string | null>
  chatMsgCache: React.MutableRefObject<MsgCache>
  chatModelCache: React.MutableRefObject<ModelCache>
  /** Enable per-chat model restore. Call once when the config API response arrives. */
  setModelSwitchingAllowed: (allowed: boolean) => void
  createNewChat: () => Promise<string>
  selectChat: (id: string) => void
  handleNewChat: () => void
  handleDeleteChat: (id: string) => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChat({
  model,
  setModel,
}: {
  model: Model
  setModel: (m: Model) => void
}): UseChatReturn {
  const [chats, setChats] = useState<ChatRecord[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  // Per-session caches — survive chat switching within a tab
  const chatMsgCache = useRef<MsgCache>(new Map())
  const chatModelCache = useRef<ModelCache>(new Map())

  // Ref mirrors for use inside async callbacks (avoids stale closures)
  const activeChatIdRef = useRef<string | null>(null)
  const streamingChatId = useRef<string | null>(null)
  const modelSwitchingAllowedRef = useRef(false)

  /** Flip on once config loads; controls per-chat model restore in selectChat. */
  function setModelSwitchingAllowed(allowed: boolean) {
    modelSwitchingAllowedRef.current = allowed
  }

  // Keep ref mirror of activeChatId in sync with state (needed by stream callbacks)
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  // Load the most-recent chat list on mount and auto-select the first chat
  useEffect(() => {
    fetch('/api/chats')
      .then(r => r.json())
      .then(({ chats: list }: { chats: ChatRecord[] }) => {
        if (list.length > 0) {
          setChats(list)
          // selectChat is a stable function (defined below with useCallback)
          // but we can't reference it directly in the effect — use a direct call
          const id = list[0].id
          setActiveChatId(id)
          activeChatIdRef.current = id
          chatMsgCache.current.set(id, chatMsgCache.current.get(id) ?? [])
          setMessages(chatMsgCache.current.get(id) ?? [])
          // Fetch actual messages from DB
          fetch(`/api/chats/${id}/messages`)
            .then(r => r.json())
            .then(({ messages: loaded }: { messages: Message[] }) => {
              if (activeChatIdRef.current !== id) return
              chatMsgCache.current.set(id, loaded)
              setMessages(loaded)
            })
            .catch(console.error)
        }
      })
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── CRUD operations ────────────────────────────────────────────────────────

  /** Creates a new chat via the API and makes it the active chat. */
  const createNewChat = useCallback(async (): Promise<string> => {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const { chat } = (await res.json()) as { chat: ChatRecord }
    setChats(prev => [chat, ...prev])
    setActiveChatId(chat.id)
    activeChatIdRef.current = chat.id
    chatMsgCache.current.set(chat.id, [])
    setMessages([])
    return chat.id
  }, [])

  /**
   * Switches the active chat. Shows the cached message snapshot immediately
   * to avoid a blank flash, then fetches from the DB in the background.
   * Skips the DB fetch if a stream for this chat is currently active.
   */
  const selectChat = useCallback(
    (id: string) => {
      setActiveChatId(id)
      activeChatIdRef.current = id

      // Show cached snapshot immediately
      const cached = chatMsgCache.current.get(id)
      setMessages(cached ?? [])

      // Restore the last model used for this chat (if feature is enabled)
      if (modelSwitchingAllowedRef.current) {
        const savedModel = chatModelCache.current.get(id)
        if (savedModel) setModel(savedModel)
      }

      // Skip DB fetch while this chat is actively streaming (cache is authoritative)
      if (streamingChatId.current === id) return

      fetch(`/api/chats/${id}/messages`)
        .then(r => r.json())
        .then(({ messages: loaded }: { messages: Message[] }) => {
          // Abort if we've switched away or if streaming started for this chat
          if (activeChatIdRef.current !== id || streamingChatId.current === id) return
          chatMsgCache.current.set(id, loaded)
          setMessages(loaded)
        })
        .catch(console.error)
    },
    [setModel]
  )

  /** Clears active chat state (used for the "New Chat" button before a message is sent). */
  function handleNewChat() {
    setActiveChatId(null)
    activeChatIdRef.current = null
    setMessages([])
  }

  /** Deletes a chat and falls back to the next available chat (or blank state). */
  function handleDeleteChat(id: string) {
    fetch(`/api/chats/${id}`, { method: 'DELETE' }).catch(console.error)
    setChats(prev => {
      const remaining = prev.filter(c => c.id !== id)
      if (activeChatIdRef.current === id) {
        if (remaining.length > 0) {
          selectChat(remaining[0].id)
        } else {
          handleNewChat()
        }
      }
      return remaining
    })
  }

  return {
    chats,
    setChats,
    activeChatId,
    messages,
    setMessages,
    activeChatIdRef,
    streamingChatId,
    chatMsgCache,
    chatModelCache,
    setModelSwitchingAllowed,
    createNewChat,
    selectChat,
    handleNewChat,
    handleDeleteChat,
  }
}
