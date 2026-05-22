import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

interface TestChat {
  id: string
  client_key: string
  title: string
  created_at: number
  updated_at: number
}

const state = vi.hoisted(() => ({
  chats: [] as TestChat[],
}))

vi.mock('@/lib/client-key', () => ({
  getClientKey: () => 'client-a',
}))

vi.mock('@/lib/storage', () => ({
  listChats: vi.fn(async (clientKey: string) => state.chats
    .filter(chat => chat.client_key === clientKey)
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(({ client_key: _clientKey, ...chat }) => chat)),
  createChat: vi.fn(async (clientKey: string, title = 'New Chat') => {
    const now = Date.now()
    const chat = {
      id: `chat-${state.chats.length + 1}`,
      client_key: clientKey,
      title: title.slice(0, 60) || 'New Chat',
      created_at: now,
      updated_at: now,
    }
    state.chats.push(chat)
    const { client_key: _clientKey, ...publicChat } = chat
    return publicChat
  }),
}))

beforeEach(() => {
  state.chats = []
})

async function getChats() {
  const { GET } = await import('../chats/route')
  return GET(new NextRequest('http://localhost/api/chats'))
}

async function postChat(body = {}) {
  const { POST } = await import('../chats/route')
  return POST(new NextRequest('http://localhost/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('GET /api/chats', () => {
  it('returns empty chats list initially', async () => {
    const res = await getChats()
    const data = await res.json()
    expect(data.chats).toEqual([])
  })

  it('returns chats ordered by updated_at descending', async () => {
    state.chats.push(
      { id: 'a', client_key: 'client-a', title: 'First', created_at: 1000, updated_at: 1000 },
      { id: 'b', client_key: 'client-a', title: 'Second', created_at: 2000, updated_at: 2000 },
    )

    const res = await getChats()
    const data = await res.json()
    expect(data.chats[0].id).toBe('b')
    expect(data.chats[1].id).toBe('a')
  })

  it('does not return chats from another client', async () => {
    state.chats.push(
      { id: 'mine', client_key: 'client-a', title: 'Mine', created_at: 1000, updated_at: 1000 },
      { id: 'theirs', client_key: 'client-b', title: 'Theirs', created_at: 2000, updated_at: 2000 },
    )

    const res = await getChats()
    const data = await res.json()
    expect(data.chats).toHaveLength(1)
    expect(data.chats[0].id).toBe('mine')
  })
})

describe('POST /api/chats', () => {
  it('creates a new chat and returns it', async () => {
    const res = await postChat()
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.chat).toHaveProperty('id')
    expect(data.chat).toHaveProperty('title', 'New Chat')
  })

  it('persists the chat for the current client', async () => {
    await postChat()
    expect(state.chats).toHaveLength(1)
    expect(state.chats[0].client_key).toBe('client-a')
  })

  it('accepts an optional title', async () => {
    const res = await postChat({ title: 'My Custom Chat' })
    const data = await res.json()
    expect(data.chat.title).toBe('My Custom Chat')
  })

  it('created chat appears in subsequent GET', async () => {
    await postChat()
    const res = await getChats()
    const data = await res.json()
    expect(data.chats).toHaveLength(1)
  })
})
