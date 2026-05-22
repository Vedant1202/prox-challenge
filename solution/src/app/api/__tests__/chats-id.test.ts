import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

interface TestChat {
  id: string
  client_key: string
  title: string
}

interface TestMessage {
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  pageImages?: Array<{ page_id: string; url: string; page_num: number; source: string }>
}

const state = vi.hoisted(() => ({
  chats: [] as TestChat[],
  messages: [] as TestMessage[],
}))

vi.mock('@/lib/client-key', () => ({
  getClientKey: () => 'client-a',
}))

vi.mock('@/lib/storage', () => ({
  deleteChat: vi.fn(async (clientKey: string, chatId: string) => {
    state.chats = state.chats.filter(chat => !(chat.id === chatId && chat.client_key === clientKey))
    state.messages = state.messages.filter(message => message.chat_id !== chatId)
  }),
  getChatMessages: vi.fn(async (clientKey: string, chatId: string) => {
    const ownsChat = state.chats.some(chat => chat.id === chatId && chat.client_key === clientKey)
    if (!ownsChat) return []
    return state.messages
      .filter(message => message.chat_id === chatId)
      .map(({ chat_id: _chatId, ...message }) => message)
  }),
}))

beforeEach(() => {
  state.chats = [{ id: 'chat-1', client_key: 'client-a', title: 'Test Chat' }]
  state.messages = [
    { chat_id: 'chat-1', role: 'user', content: 'Hello' },
    { chat_id: 'chat-1', role: 'assistant', content: 'Hi there!' },
  ]
})

async function deleteChat(id: string) {
  const { DELETE } = await import('../chats/[id]/route')
  return DELETE(
    new NextRequest(`http://localhost/api/chats/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) }
  )
}

async function getMessages(chatId: string) {
  const { GET } = await import('../chats/[id]/messages/route')
  return GET(
    new NextRequest(`http://localhost/api/chats/${chatId}/messages`),
    { params: Promise.resolve({ id: chatId }) }
  )
}

describe('DELETE /api/chats/[id]', () => {
  it('deletes an existing chat and returns ok', async () => {
    const res = await deleteChat('chat-1')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it('removes the chat from storage', async () => {
    await deleteChat('chat-1')
    expect(state.chats).toEqual([])
  })

  it('returns ok even for a nonexistent chat (no-op delete)', async () => {
    const res = await deleteChat('nonexistent')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })
})

describe('GET /api/chats/[id]/messages', () => {
  it('returns messages for the chat in chronological order', async () => {
    const res = await getMessages('chat-1')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.messages).toHaveLength(2)
    expect(data.messages[0].role).toBe('user')
    expect(data.messages[0].content).toBe('Hello')
    expect(data.messages[1].role).toBe('assistant')
  })

  it('returns empty messages for a chat with no messages', async () => {
    state.chats.push({ id: 'chat-empty', client_key: 'client-a', title: 'Empty' })
    const res = await getMessages('chat-empty')
    const data = await res.json()
    expect(data.messages).toEqual([])
  })

  it('does not return messages from another client', async () => {
    state.chats.push({ id: 'chat-private', client_key: 'client-b', title: 'Private' })
    state.messages.push({ chat_id: 'chat-private', role: 'user', content: 'Secret' })

    const res = await getMessages('chat-private')
    const data = await res.json()
    expect(data.messages).toEqual([])
  })

  it('returns page images when present', async () => {
    state.messages.push({
      chat_id: 'chat-1',
      role: 'assistant',
      content: 'See page 7',
      pageImages: [{ page_id: 'owner-manual-007', url: '/corpus/pages/owner-manual-007.png', page_num: 7, source: 'owner-manual' }],
    })

    const res = await getMessages('chat-1')
    const data = await res.json()
    const lastMsg = data.messages[data.messages.length - 1]
    expect(lastMsg.pageImages).toHaveLength(1)
    expect(lastMsg.pageImages[0].page_id).toBe('owner-manual-007')
  })
})
