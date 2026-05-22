'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const FingerprintContext = createContext<string | null>(null)

export function useFingerprintId(): string | null {
  return useContext(FingerprintContext)
}

export default function FingerprintProvider({ children }: { children: React.ReactNode }) {
  const [visitorId, setVisitorId] = useState<string | null>(null)

  useEffect(() => {
    const fallbackKey = 'prox-client-id'
    const getFallbackId = () => {
      const existing = window.localStorage.getItem(fallbackKey)
      if (existing) return existing

      const generated = window.crypto.randomUUID()
      window.localStorage.setItem(fallbackKey, generated)
      return generated
    }

    setVisitorId(getFallbackId())

    import('@fingerprintjs/fingerprintjs')
      .then(FingerprintJS => FingerprintJS.load())
      .then(fp => fp.get())
      .then(result => setVisitorId(result.visitorId))
      .catch(() => {
        setVisitorId(getFallbackId())
      })
  }, [])

  return (
    <FingerprintContext.Provider value={visitorId}>
      {children}
    </FingerprintContext.Provider>
  )
}
