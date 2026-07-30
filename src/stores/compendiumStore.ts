import { create } from 'zustand'
import { registry } from '../core/registry'
import type { CompendiumEntry, CompendiumImportData } from '../core/types'

interface CompendiumState {
  entries: CompendiumEntry[]
  currentChapter: number

  loadCompendium: (bookId: string) => Promise<void>
  importFromJSON: (bookId: string, json: CompendiumImportData) => Promise<void>
  checkUnlock: (chapter: number) => void
  addEntry: (entry: CompendiumEntry) => Promise<void>
  updateEntry: (id: string, patch: Partial<CompendiumEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getEntriesByCategory: (category: 'character' | 'location') => CompendiumEntry[]
  getEntryById: (id: string) => CompendiumEntry | undefined
}

export const useCompendiumStore = create<CompendiumState>((set, get) => ({
  entries: [],
  currentChapter: 0,

  loadCompendium: async (bookId: string) => {
    const storage = registry.getStorage()
    const list = await storage.getEntriesByBook(bookId)
    const { currentChapter } = get()
    for (const entry of list) {
      for (const rev of entry.entries) {
        rev.unlocked = rev.chapter <= currentChapter
      }
    }
    set({ entries: list })
  },

  importFromJSON: async (bookId: string, json: CompendiumImportData) => {
    const storage = registry.getStorage()
    await storage.importCompendium(bookId, json)
    await get().loadCompendium(bookId)
  },

  checkUnlock: (chapter: number) => {
    if (chapter <= get().currentChapter) return
    set((state) => {
      const updated = state.entries.map((entry) => {
        let changed = false
        const newEntries = entry.entries.map((rev) => {
          if (!rev.unlocked && rev.chapter <= chapter) {
            changed = true
            return { ...rev, unlocked: true }
          }
          return rev
        })
        return changed ? { ...entry, entries: newEntries, updatedAt: Date.now() } : entry
      })
      return { entries: updated, currentChapter: chapter }
    })
  },

  addEntry: async (entry: CompendiumEntry) => {
    const storage = registry.getStorage()
    await storage.saveEntry(entry)
    set({ entries: [...get().entries, entry] })
  },

  updateEntry: async (id: string, patch: Partial<CompendiumEntry>) => {
    const storage = registry.getStorage()
    await storage.updateEntry(id, patch)
    set({
      entries: get().entries.map((e) =>
        e.id === id ? { ...e, ...patch, updatedAt: Date.now() } : e,
      ),
    })
  },

  deleteEntry: async (id: string) => {
    const storage = registry.getStorage()
    await storage.deleteEntry(id)
    set({ entries: get().entries.filter((e) => e.id !== id) })
  },

  getEntriesByCategory: (category: 'character' | 'location') => {
    return get()
      .entries.filter((e) => e.category === category)
      .sort((a, b) => {
        const aUnlocked = a.entries.filter((r) => r.unlocked).length
        const bUnlocked = b.entries.filter((r) => r.unlocked).length
        return bUnlocked - aUnlocked
      })
  },

  getEntryById: (id: string) => {
    return get().entries.find((e) => e.id === id)
  },
}))
