import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme-context'

export const metadata: Metadata = {
  title: 'Vulcan OmniPro 220 — Welder Assistant',
  description: 'AI-powered support assistant for the Vulcan OmniPro 220 multiprocess welder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="ai-dark" suppressHydrationWarning>
      <head>
        {/* Restore theme before React hydrates to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='ai-light'||t==='ai-dark')document.documentElement.dataset.theme=t;}catch(e){}})();` }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
