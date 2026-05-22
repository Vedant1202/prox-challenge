import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vulcan OmniPro 220 — Welder Assistant',
  description: 'AI-powered support assistant for the Vulcan OmniPro 220 multiprocess welder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
