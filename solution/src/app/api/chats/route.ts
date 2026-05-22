import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

export function GET() {
  const db = getDb()
  const stmt = db.prepare('SELECT id, title, updated_at FROM chats ORDER BY updated_at DESC')
  const chats = stmt.all() as { id: string; title: string; updated_at: number }[]
  return NextResponse.json({ chats })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { title?: string }
  const db = getDb()
  const id = randomUUID()
  const now = Date.now()
  const title = body.title?.slice(0, 60) || 'New Chat'

  db.prepare('INSERT INTO chats (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, title, now, now)

  return NextResponse.json({ chat: { id, title, created_at: now } }, { status: 201 })
}
