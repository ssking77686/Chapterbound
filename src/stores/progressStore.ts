import { create } from 'zustand'
import { registry } from '../core/registry'
import type { ReadingProgress } from '../core/types'

interface ProgressState {
  current: ReadingProgress | null
  loadProgress: (bookId: string) => Promise<void>
  saveProgress: (bookId: string, location: string, progress: number) => Promise<void>
}

export const useProgressStore = create<ProgressState>((set) => ({
  current: null,

  loadProgress: async (bookId: string) => {
    const storage = registry.getStorage() as any
    const p = await storage.getProgress(bookId)
    set({ current: p })
  },

  saveProgress: async (bookId: string, location: string, progress: number) => {
    const storage = registry.getStorage() as any
    const record: ReadingProgress = {
      bookId,
      location,
      progress,
      updatedAt: Date.now(),
    }
    await storage.saveProgress(record)
    set({ current: record })
  },
}))
