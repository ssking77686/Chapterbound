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
  pageWidth: number
  columnMode: 'auto' | 'single'
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
  pageWidth: 0,
  columnMode: 'auto',
}

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { ...defaults }
      }
      // 迁移：旧版本没有 pageTheme，用 ereader-theme 来定初始值
      if (!parsed.pageTheme) {
        const oldTheme = localStorage.getItem('ereader-theme')
        if (oldTheme === 'dark') {
          parsed.pageTheme = { background: '#2B2420', text: '#F5EFE6' }
        }
      }
      return {
        fontSize: typeof parsed.fontSize === 'number' ? parsed.fontSize : defaults.fontSize,
        fontFamily: typeof parsed.fontFamily === 'string' ? parsed.fontFamily : defaults.fontFamily,
        lineHeight: typeof parsed.lineHeight === 'number' ? parsed.lineHeight : defaults.lineHeight,
        compendiumFontScale: typeof parsed.compendiumFontScale === 'number' ? parsed.compendiumFontScale : defaults.compendiumFontScale,
        showProgressBar: typeof parsed.showProgressBar === 'boolean' ? parsed.showProgressBar : defaults.showProgressBar,
        pageWidth: typeof parsed.pageWidth === 'number' ? parsed.pageWidth : defaults.pageWidth,
        columnMode: parsed.columnMode === 'single' || parsed.columnMode === 'auto' ? parsed.columnMode : defaults.columnMode,
        pageTheme: parsed.pageTheme && typeof parsed.pageTheme === 'object'
          ? {
              background: typeof parsed.pageTheme.background === 'string' ? parsed.pageTheme.background : defaults.pageTheme.background,
              text: typeof parsed.pageTheme.text === 'string' ? parsed.pageTheme.text : defaults.pageTheme.text,
            }
          : defaults.pageTheme,
      }
    }
  } catch { /* ignore */ }
  return { ...defaults }
}

function save(settings: ReaderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    console.warn('[settings] 保存失败，设置仅在当前会话生效')
  }
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
