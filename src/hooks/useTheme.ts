import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'ereader-theme'

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? getSystemTheme()
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        const systemTheme = getSystemTheme()
        setTheme(systemTheme)
        applyTheme(systemTheme)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { theme, toggle, isDark: theme === 'dark' } as const
}
