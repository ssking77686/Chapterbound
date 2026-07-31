import { create } from 'zustand'
import { registry } from '../core/registry'
import type { CompendiumEntry, CompendiumImportData } from '../core/types'

interface CompendiumState {
  entries: CompendiumEntry[]
  currentChapter: number
  lastViewedAt: number

  loadCompendium: (bookId: string) => Promise<void>
  importFromJSON: (bookId: string, json: CompendiumImportData) => Promise<void>
  checkUnlock: (chapter: number) => void
  markViewed: () => void
  addEntry: (entry: CompendiumEntry) => Promise<void>
  updateEntry: (id: string, patch: Partial<CompendiumEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getEntriesByCategory: (category: 'character' | 'location' | 'monster') => CompendiumEntry[]
  getEntryById: (id: string) => CompendiumEntry | undefined
}

function hasUnlockedContent(entry: CompendiumEntry): boolean {
  return entry.entries.some((r) => r.unlocked) ||
    entry.quotations.some((q) => q.unlocked !== false)
}

export const useCompendiumStore = create<CompendiumState>((set, get) => ({
  entries: [],
  currentChapter: 0,
  lastViewedAt: 0,

  loadCompendium: async (bookId: string) => {
    const storage = registry.getStorage()
    const list = await storage.getEntriesByBook(bookId)
    // 从存储读取当前书籍的章节进度，实现按 bookId 隔离
    const currentChapter = await storage.getCompendiumChapter(bookId)
    const updated = list.map((entry) => {
      let changed = false
      const newEntries = entry.entries.map((rev) => {
        if (!rev.unlocked && rev.chapter <= currentChapter) {
          changed = true
          return { ...rev, unlocked: true }
        }
        return rev
      })
      const newQuotations = entry.quotations.map((q) => {
        if (!q.unlocked && q.chapter !== undefined && q.chapter <= currentChapter) {
          changed = true
          return { ...q, unlocked: true }
        }
        return q
      })
      return changed ? { ...entry, entries: newEntries, quotations: newQuotations } : entry
    })
    set({ entries: updated, currentChapter })
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
        const newQuotations = entry.quotations.map((q) => {
          if (!q.unlocked && q.chapter !== undefined && q.chapter <= chapter) {
            changed = true
            return { ...q, unlocked: true }
          }
          return q
        })
        return changed ? { ...entry, entries: newEntries, quotations: newQuotations, updatedAt: Date.now() } : entry
      })
      return { entries: updated, currentChapter: chapter }
    })
    // 持久化章节进度，按 bookId 隔离；fire-and-forget 不阻塞翻页
    const bookId = get().entries[0]?.bookId
    if (bookId) {
      registry.getStorage().saveCompendiumChapter(bookId, chapter).catch(() => {})
    }
  },

  markViewed: () => {
    set({ lastViewedAt: Date.now() })
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

  getEntriesByCategory: (category: 'character' | 'location' | 'monster') => {
    return get()
      .entries.filter((e) => e.category === category && hasUnlockedContent(e))
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
