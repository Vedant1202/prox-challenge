import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { NextRequest } from 'next/server'

let testDb: DatabaseSync

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
}))

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL,
    page_images TEXT,
    artifact_html TEXT,
    created_at INTEGER NOT NULL
  );
  PRAGMA foreign_keys = ON;
`

beforeEach(() => {
  testDb = new DatabaseSync(':memory:')
  testDb.exec(SCHEMA)
  testDb.prepare("INSERT INTO chats (id, title, created_at, updated_at) VALUES ('chat-1', 'Test Chat', 1000, 1000)").run()
  testDb.prepare("INSERT INTO messages (id, chat_id, role, content, created_at) VALUES ('msg-1', 'chat-1', 'user', 'Hello', 1001)").run()
  testDb.prepare("INSERT INTO messages (id, chat_id, role, content, created_at) VALUES ('msg-2', 'chat-1', 'assistant', 'Hi there!', 1002)").run()
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

  it('removes the chat from the database', async () => {
    await deleteChat('chat-1')
    const row = testDb.prepare("SELECT COUNT(*) as count FROM chats WHERE id = 'chat-1'").get() as { count: number }
    expect(row.count).toBe(0)
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
    testDb.prepare("INSERT INTO chats (id, title, created_at, updated_at) VALUES ('chat-empty', 'Empty', 1000, 1000)").run()
    const res = await getMessages('chat-empty')
    const data = await res.json()
    expect(data.messages).toEqual([])
  })

  it('parses page_images JSON when present', async () => {
    const images = JSON.stringify([{ page_id: 'owner-manual-007', url: '/corpus/pages/owner-manual-007.png', page_num: 7, source: 'owner-manual' }])
    testDb.prepare("INSERT INTO messages (id, chat_id, role, content, page_images, created_at) VALUES ('msg-3', 'chat-1', 'assistant', 'See page 7', ?, 1003)").run(images)

    const res = await getMessages('chat-1')
    const data = await res.json()
    const lastMsg = data.messages[data.messages.length - 1]
    expect(lastMsg.pageImages).toHaveLength(1)
    expect(lastMsg.pageImages[0].page_id).toBe('owner-manual-007')
  })
})
