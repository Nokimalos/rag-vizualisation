import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'
export interface ThemeContextValue { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
