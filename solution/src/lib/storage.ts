import { randomUUID } from 'crypto'
import { ensureSchema, getSql } from './db'

export interface ChatRecord {
  id: string
  title: string
  created_at?: number
  updated_at: number
}

export interface StoredPageImage {
  page_id: string
  url: string
  page_num: number
  source: string
  summary?: string
  show_by_default?: boolean
}

export interface StoredChecklist {
  title: string
  items: Array<{
    step: string
    description: string
    image_id?: string
    tips?: string[]
  }>
}

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
  pageImages?: StoredPageImage[]
  artifactHtml?: string
  checklist?: StoredChecklist
}

interface ChatRow {
  id: string
  title: string
  created_at?: string | number
  updated_at: string | number
}

interface MessageRow {
  role: 'user' | 'assistant'
  content: string
  page_images: string | null
  artifact_html: string | null
  checklist: string | null
}

function toNumber(value: string | number | undefined): number {
  if (value === undefined) return Date.now()
  return typeof value === 'number' ? value : Number(value)
}

function parseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined
  return JSON.parse(value) as T
}

export async function listChats(clientKey: string): Promise<ChatRecord[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT id, title, updated_at
    FROM chats
    WHERE client_key = ${clientKey}
    ORDER BY updated_at DESC
  `) as ChatRow[]

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    updated_at: toNumber(row.updated_at),
  }))
}

export async function createChat(clientKey: string, title = 'New Chat'): Promise<ChatRecord> {
  await ensureSchema()
  const sql = getSql()
  const id = randomUUID()
  const now = Date.now()
  const safeTitle = title.slice(0, 60) || 'New Chat'

  await sql`
    INSERT INTO chats (id, client_key, title, created_at, updated_at)
    VALUES (${id}, ${clientKey}, ${safeTitle}, ${now}, ${now})
  `

  return { id, title: safeTitle, created_at: now, updated_at: now }
}

export async function deleteChat(clientKey: string, chatId: string): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    DELETE FROM chats
    WHERE id = ${chatId}
      AND client_key = ${clientKey}
  `
}

export async function getChatMessages(clientKey: string, chatId: string): Promise<StoredMessage[]> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT m.role, m.content, m.page_images, m.artifact_html, m.checklist
    FROM messages m
    INNER JOIN chats c ON c.id = m.chat_id
    WHERE m.chat_id = ${chatId}
      AND c.client_key = ${clientKey}
    ORDER BY m.created_at ASC
  `) as MessageRow[]

  return rows.map(row => ({
    role: row.role,
    content: row.content,
    pageImages: parseJson<StoredPageImage[]>(row.page_images),
    artifactHtml: row.artifact_html || undefined,
    checklist: parseJson<StoredChecklist>(row.checklist),
  }))
}

export async function persistChatTurn(input: {
  clientKey: string
  chatId: string
  userContent?: string
  assistantContent: string
  pageImages: StoredPageImage[]
  checklist: StoredChecklist | null
  artifactHtml?: string | null
}): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  const now = Date.now()
  const fallbackTitle = (input.userContent || 'New Chat').slice(0, 60) || 'New Chat'

  const existing = (await sql`
    SELECT id, title
    FROM chats
    WHERE id = ${input.chatId}
      AND client_key = ${input.clientKey}
    LIMIT 1
  `) as Array<{ id: string; title: string }>

  if (existing.length === 0) {
    await sql`
      INSERT INTO chats (id, client_key, title, created_at, updated_at)
      VALUES (${input.chatId}, ${input.clientKey}, ${fallbackTitle}, ${now}, ${now})
    `
  } else if (existing[0].title === 'New Chat' && input.userContent) {
    await sql`
      UPDATE chats
      SET title = ${fallbackTitle}, updated_at = ${now}
      WHERE id = ${input.chatId}
        AND client_key = ${input.clientKey}
    `
  } else {
    await sql`
      UPDATE chats
      SET updated_at = ${now}
      WHERE id = ${input.chatId}
        AND client_key = ${input.clientKey}
    `
  }

  if (input.userContent) {
    await sql`
      INSERT INTO messages (id, chat_id, role, content, created_at)
      VALUES (${randomUUID()}, ${input.chatId}, 'user', ${input.userContent}, ${now - 1})
    `
  }

  await sql`
    INSERT INTO messages (id, chat_id, role, content, page_images, artifact_html, checklist, created_at)
    VALUES (
      ${randomUUID()},
      ${input.chatId},
      'assistant',
      ${input.assistantContent},
      ${input.pageImages.length > 0 ? JSON.stringify(input.pageImages) : null},
      ${input.artifactHtml ?? null},
      ${input.checklist ? JSON.stringify(input.checklist) : null},
      ${now}
    )
  `
}

export async function pruneRateLimitEntries(clientKey: string, cutoff: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    DELETE FROM rate_limit
    WHERE client_key = ${clientKey}
      AND timestamp < ${cutoff}
  `
}

export async function countRateLimitEntries(clientKey: string): Promise<number> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT COUNT(*) AS count
    FROM rate_limit
    WHERE client_key = ${clientKey}
  `) as Array<{ count: string | number }>

  return Number(rows[0]?.count ?? 0)
}

export async function getOldestRateLimitTimestamp(clientKey: string): Promise<number | null> {
  await ensureSchema()
  const sql = getSql()
  const rows = (await sql`
    SELECT timestamp
    FROM rate_limit
    WHERE client_key = ${clientKey}
    ORDER BY timestamp ASC
    LIMIT 1
  `) as Array<{ timestamp: string | number }>

  if (!rows[0]) return null
  return toNumber(rows[0].timestamp)
}

export async function recordRateLimitEntry(clientKey: string, timestamp: number): Promise<void> {
  await ensureSchema()
  const sql = getSql()
  await sql`
    INSERT INTO rate_limit (client_key, timestamp)
    VALUES (${clientKey}, ${timestamp})
  `
}
