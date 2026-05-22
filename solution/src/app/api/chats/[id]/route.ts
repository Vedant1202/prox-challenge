import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const db = getDb()
    db.prepare('DELETE FROM chats WHERE id = ?').run(id)
    return NextResponse.json({ ok: true })
  })
}
