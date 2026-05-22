import { NextRequest, NextResponse } from 'next/server'
import { getClientKey } from '@/lib/client-key'
import { deleteChat } from '@/lib/storage'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteChat(getClientKey(req), id)
  return NextResponse.json({ ok: true })
}
