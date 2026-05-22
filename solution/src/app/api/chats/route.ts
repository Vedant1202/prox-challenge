import { NextRequest, NextResponse } from 'next/server'
import { getClientKey } from '@/lib/client-key'
import { createChat, listChats } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const clientKey = getClientKey(req)
  const chats = await listChats(clientKey)
  return NextResponse.json({ chats })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { title?: string }
  const clientKey = getClientKey(req)
  const chat = await createChat(clientKey, body.title)

  return NextResponse.json({ chat }, { status: 201 })
}
