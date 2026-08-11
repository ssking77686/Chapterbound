import { create } from 'zustand'
import { registry } from '../core/registry'
import type { CompendiumEntry, CompendiumImportData, CompendiumImportEntry } from '../core/types'

export interface SearchResult {
  entry: CompendiumEntry
  score: number
}

interface CompendiumState {
  entries: CompendiumEntry[]
  currentChapter: number
  lastViewedAt: number

  loadCompendium: (bookId: string) => Promise<void>
  importFromJSON: (bookId: string, json: CompendiumImportData, readerChapter?: number) => Promise<void>
  checkUnlock: (chapter: number) => void
  markViewed: () => void
  addEntry: (entry: CompendiumEntry) => Promise<void>
  updateEntry: (id: string, patch: Partial<CompendiumEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getEntriesByCategory: (category: 'character' | 'location' | 'monster') => CompendiumEntry[]
  getEntryById: (id: string) => CompendiumEntry | undefined
  searchEntries: (query: string, category?: 'character' | 'location' | 'monster') => SearchResult[]
}

function scoreEntry(entry: CompendiumEntry, query: string): number {
  const q = query.toLowerCase()
  let score = 0

  // 名字精确匹配
  if (entry.name === query) { score += 100 }
  // 名字模糊匹配
  else if (entry.name.toLowerCase().includes(q)) { score += 50 }

  // 别名匹配
  for (const alias of entry.aliases) {
    if (alias === query) { score += 60 }
    else if (alias.toLowerCase().includes(q)) { score += 30 }
  }

  // 描述匹配
  if (entry.description.toLowerCase().includes(q)) { score += 10 }

  return score
}

/** 运行时校验导入的图鉴数据，阻止脏数据进入 IndexedDB */
function validateImportData(json: CompendiumImportData): CompendiumImportData {
  const validCategories = new Set(['character', 'location', 'monster'])
  const validateItem = (item: unknown) => {
    if (!item || typeof item !== 'object') {
      throw new Error('导入数据格式错误：条目不是有效对象')
    }
    const obj = item as Record<string, unknown>
    if (typeof obj.id !== 'string' || !obj.id.trim()) {
      throw new Error('导入数据格式错误：条目缺少 id')
    }
    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      throw new Error(`导入数据格式错误：条目 "${String(obj.id)}" 缺少 name`)
    }
    return {
      ...obj,
      name: obj.name,
      id: obj.id,
      category: validCategories.has(obj.category as string) ? obj.category : 'character',
      description: typeof obj.description === 'string' ? obj.description : '',
      aliases: Array.isArray(obj.aliases) ? obj.aliases : [],
      history: typeof obj.history === 'string' ? obj.history : '',
      image: typeof obj.image === 'string' ? obj.image : undefined,
      relations: Array.isArray(obj.relations) ? obj.relations : [],
      quotations: Array.isArray(obj.quotations) ? obj.quotations : [],
      entries: Array.isArray(obj.entries) ? obj.entries : [],
    } as CompendiumImportEntry
  }

  return {
    bookId: json.bookId,
    characters: (json.characters ?? []).map(validateItem),
    locations: (json.locations ?? []).map(validateItem),
    monsters: (json.monsters ?? []).map(validateItem),
  }
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
      const newEntries = (entry.entries ?? []).map((rev) => {
        if (!rev.unlocked && rev.chapter <= currentChapter) {
          changed = true
          return { ...rev, unlocked: true }
        }
        return rev
      })
      const newQuotations = (entry.quotations ?? []).map((q) => {
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

  importFromJSON: async (bookId: string, json: CompendiumImportData, readerChapter?: number) => {
    const storage = registry.getStorage()
    // 优先用阅读器传入的当前章节，fallback 到 store 内存中的值
    const effectiveChapter = readerChapter ?? get().currentChapter
    await storage.importCompendium(bookId, validateImportData(json))
    await get().loadCompendium(bookId)
    if (effectiveChapter > 0) {
      get().checkUnlock(effectiveChapter)
    }
  },

  checkUnlock: (chapter: number) => {
    if (chapter <= get().currentChapter) return
    set((state) => {
      const updated = state.entries.map((entry) => {
        let changed = false
        const newEntries = (entry.entries ?? []).map((rev) => {
          if (!rev.unlocked && rev.chapter <= chapter) {
            changed = true
            return { ...rev, unlocked: true }
          }
          return rev
        })
        const newQuotations = (entry.quotations ?? []).map((q) => {
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
      .entries.filter((e) => e.category === category)
      .sort((a, b) => {
        const aUnlocked = (a.entries ?? []).filter((r) => r.unlocked).length
        const bUnlocked = (b.entries ?? []).filter((r) => r.unlocked).length
        return bUnlocked - aUnlocked
      })
  },

  getEntryById: (id: string) => {
    return get().entries.find((e) => e.id === id)
  },

  searchEntries: (query: string, category?: 'character' | 'location' | 'monster') => {
    const q = query.trim()
    if (!q) return []
    const results: SearchResult[] = []
    for (const entry of get().entries) {
      if (category && entry.category !== category) continue
      const score = scoreEntry(entry, q)
      if (score >= 20) results.push({ entry, score })
    }
    results.sort((a, b) => b.score - a.score)
    return results
  },
}))
