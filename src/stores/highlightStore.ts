import { create } from 'zustand'
import { registry } from '../core/registry'
import type { Highlight } from '../core/types'

interface HighlightState {
  highlights: Highlight[]
  loadHighlights: (bookId: string) => Promise<void>
  addHighlight: (bookId: string, location: string, text: string, color: string) => Promise<void>
  removeHighlight: (id: string) => Promise<void>
  updateNote: (id: string, note: string) => Promise<void>
}

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: [],

  loadHighlights: async (bookId: string) => {
    const storage = registry.getStorage()
    const list = await storage.getHighlights(bookId)
    set({ highlights: list })
  },

  addHighlight: async (bookId: string, location: string, text: string, color: string) => {
    const storage = registry.getStorage()
    const highlight: Highlight = {
      id: crypto.randomUUID(),
      bookId,
      location,
      text,
      color,
      createdAt: Date.now(),
    }
    await storage.saveHighlight(highlight)
    set({ highlights: [...get().highlights, highlight] })
  },

  removeHighlight: async (id: string) => {
    const storage = registry.getStorage()
    await storage.deleteHighlight(id)
    set({ highlights: get().highlights.filter((h) => h.id !== id) })
  },

  updateNote: async (id: string, note: string) => {
    const storage = registry.getStorage()
    const updated = get().highlights.map((h) => (h.id === id ? { ...h, note } : h))
    const target = updated.find((h) => h.id === id)
    if (target) await storage.saveHighlight(target)
    set({ highlights: updated })
  },
}))
