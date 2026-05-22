import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface DbMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  page_images: string | null
  artifact_html: string | null
  checklist: string | null
  created_at: number
}

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const db = getDb()
    const rows = db.prepare(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC'
    ).all(id) as unknown as DbMessage[]

    const messages = rows.map(row => ({
      role: row.role,
      content: row.content,
      pageImages: row.page_images ? JSON.parse(row.page_images) : undefined,
      artifactHtml: row.artifact_html || undefined,
      checklist: row.checklist ? JSON.parse(row.checklist as string) : undefined,
    }))

    return NextResponse.json({ messages })
  })
}
