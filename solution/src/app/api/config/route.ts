import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json({
    modelSwitchingAllowed: process.env.MODEL_SWITCHING_ALLOWED === 'true',
    defaultModel: process.env.DEFAULT_MODEL ?? 'claude-sonnet-4-6',
    rateLimit: {
      requests: parseInt(process.env.RATE_LIMIT_REQUESTS ?? '10', 10),
      windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES ?? '60', 10),
    },
  })
}
