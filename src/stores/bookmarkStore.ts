import { create } from 'zustand'
import { registry } from '../core/registry'
import type { Bookmark } from '../core/types'

interface BookmarkState {
  bookmarks: Bookmark[]
  loadBookmarks: (bookId: string) => Promise<void>
  addBookmark: (bookId: string, location: string, label: string) => Promise<void>
  removeBookmark: (id: string) => Promise<void>
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],

  loadBookmarks: async (bookId: string) => {
    const storage = registry.getStorage() as any
    const list = await storage.getBookmarks(bookId)
    set({ bookmarks: list })
  },

  addBookmark: async (bookId: string, location: string, label: string) => {
    const storage = registry.getStorage() as any
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      bookId,
      location,
      label,
      createdAt: Date.now(),
    }
    await storage.saveBookmark(bookmark)
    set({ bookmarks: [...get().bookmarks, bookmark] })
  },

  removeBookmark: async (id: string) => {
    const storage = registry.getStorage() as any
    await storage.deleteBookmark(id)
    set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) })
  },
}))
