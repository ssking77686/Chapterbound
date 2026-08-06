import { create } from 'zustand'

export interface PageThemeColors {
  background: string
  text: string
}

export interface ReaderSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  compendiumFontScale: number
  showProgressBar: boolean
  pageTheme: PageThemeColors
}

const STORAGE_KEY = 'ereader-settings'

const defaults: ReaderSettings = {
  fontSize: 16,
  fontFamily: '',
  lineHeight: 1.8,
  compendiumFontScale: 1.0,
  showProgressBar: true,
  pageTheme: {
    background: '#FDFBF7',
    text: '#3C3226',
  },
}

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 迁移：旧版本没有 pageTheme，用 ereader-theme 来定初始值
      if (!parsed.pageTheme) {
        const oldTheme = localStorage.getItem('ereader-theme')
        if (oldTheme === 'dark') {
          parsed.pageTheme = { background: '#2B2420', text: '#F5EFE6' }
        }
      }
      return { ...defaults, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...defaults }
}

function save(settings: ReaderSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

interface SettingsState {
  settings: ReaderSettings
  updateSettings: (patch: Partial<ReaderSettings>) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: load(),

  updateSettings: (patch) =>
    set((state) => {
      const next = { ...state.settings, ...patch }
      save(next)
      return { settings: next }
    }),
}))
