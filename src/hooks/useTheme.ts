import { useCallback, useEffect } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { PAGE_THEME_DEFAULT_DARK, PAGE_THEME_DEFAULT_LIGHT, isDarkBackground } from '../data/themes'

export function useTheme() {
  const pageTheme = useSettingsStore((s) => s.settings.pageTheme)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const isDark = isDarkBackground(pageTheme.background)

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  }, [isDark])

  const toggle = useCallback(() => {
    const next = isDark ? PAGE_THEME_DEFAULT_LIGHT : PAGE_THEME_DEFAULT_DARK
    updateSettings({ pageTheme: { background: next.background, text: next.text } })
  }, [isDark, updateSettings])

  return { isDark, toggle } as const
}
