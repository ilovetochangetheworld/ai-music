import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Soundtrack, TranscriptAnalysis } from './types'

interface Store {
  soundtrack: Soundtrack | null
  analysis: TranscriptAnalysis | null
  setSoundtrack: (s: Soundtrack | null) => void
  setAnalysis: (a: TranscriptAnalysis | null) => void
  getSoundtrack: (id: string) => Soundtrack | null
}

const Ctx = createContext<Store | null>(null)
const KEY = 'sol_soundtrack'

function persist(s: Soundtrack | null) {
  try {
    if (s) sessionStorage.setItem(`${KEY}_${s.id}`, JSON.stringify(s))
  } catch { /* ignore */ }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [soundtrack, setSoundtrackState] = useState<Soundtrack | null>(null)
  const [analysis, setAnalysis] = useState<TranscriptAnalysis | null>(null)

  const setSoundtrack = (s: Soundtrack | null) => {
    persist(s)
    setSoundtrackState(s)
  }

  const getSoundtrack = (id: string): Soundtrack | null => {
    if (soundtrack?.id === id) return soundtrack
    try {
      const raw = sessionStorage.getItem(`${KEY}_${id}`)
      return raw ? (JSON.parse(raw) as Soundtrack) : null
    } catch {
      return null
    }
  }

  return (
    <Ctx.Provider value={{ soundtrack, analysis, setSoundtrack, setAnalysis, getSoundtrack }}>
      {children}
    </Ctx.Provider>
  )
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
