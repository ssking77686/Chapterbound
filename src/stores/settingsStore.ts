import { create } from 'zustand'

export interface ReaderSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  compendiumFontScale: number
  showProgressBar: boolean
}

const STORAGE_KEY = 'ereader-settings'

const defaults: ReaderSettings = {
  fontSize: 16,
  fontFamily: '',
  lineHeight: 1.8,
  compendiumFontScale: 1.0,
  showProgressBar: true,
}

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
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
