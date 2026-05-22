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
})

async function getChats() {
  const { GET } = await import('../chats/route')
  return GET()
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
    testDb.prepare("INSERT INTO chats (id, title, created_at, updated_at) VALUES ('a', 'First', 1000, 1000)").run()
    testDb.prepare("INSERT INTO chats (id, title, created_at, updated_at) VALUES ('b', 'Second', 2000, 2000)").run()

    const res = await getChats()
    const data = await res.json()
    expect(data.chats[0].id).toBe('b')
    expect(data.chats[1].id).toBe('a')
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

  it('persists the chat to the database', async () => {
    await postChat()
    const row = testDb.prepare('SELECT COUNT(*) as count FROM chats').get() as { count: number }
    expect(row.count).toBe(1)
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
