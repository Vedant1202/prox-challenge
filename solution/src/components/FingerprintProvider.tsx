'use client'

import { createContext, useContext, useEffect, useState } from 'react'

const FingerprintContext = createContext<string | null>(null)

export function useFingerprintId(): string | null {
  return useContext(FingerprintContext)
}

export default function FingerprintProvider({ children }: { children: React.ReactNode }) {
  const [visitorId, setVisitorId] = useState<string | null>(null)

  useEffect(() => {
    import('@fingerprintjs/fingerprintjs').then(FingerprintJS => {
      FingerprintJS.load().then(fp => fp.get()).then(result => {
        setVisitorId(result.visitorId)
      })
    })
  }, [])

  return (
    <FingerprintContext.Provider value={visitorId}>
      {children}
    </FingerprintContext.Provider>
  )
}
