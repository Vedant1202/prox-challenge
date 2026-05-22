import { NextRequest, NextResponse } from 'next/server'
import { getClientKey } from '@/lib/client-key'
import { getChatMessages } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const messages = await getChatMessages(getClientKey(req), id)
  return NextResponse.json({ messages })
}
