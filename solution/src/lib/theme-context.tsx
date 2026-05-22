'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'ai-dark' | 'ai-light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'ai-dark',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('ai-dark')

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'ai-dark' || saved === 'ai-light') {
      setTheme(saved)
      document.documentElement.dataset.theme = saved
    }
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'ai-dark' ? 'ai-light' : 'ai-dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
