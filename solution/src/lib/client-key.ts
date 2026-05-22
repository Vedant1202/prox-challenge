import { createHash } from 'crypto'
import { NextRequest } from 'next/server'

export function extractIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

export function getClientKey(req: NextRequest): string {
  const ip = extractIp(req)
  const fingerprint = req.headers.get('x-client-fingerprint') ?? 'unknown'
  return createHash('sha256').update(`${ip}:${fingerprint}`).digest('hex')
}
