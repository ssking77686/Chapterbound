import { create } from 'zustand'
import { registry } from '../core/registry'
import type { Bookmark } from '../core/types'

interface BookmarkState {
  bookmarks: Bookmark[]
  loadBookmarks: (bookId: string) => Promise<void>
  addBookmark: (bookId: string, location: string, label: string, color: string, progress: number) => Promise<void>
  removeBookmark: (id: string) => Promise<void>
  hasBookmarkAt: (location: string) => boolean
  getBookmarkAt: (location: string) => Bookmark | undefined
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],

  loadBookmarks: async (bookId: string) => {
    const storage = registry.getStorage()
    const list = await storage.getBookmarks(bookId)
    set({ bookmarks: list })
  },

  addBookmark: async (bookId: string, location: string, label: string, color: string, progress: number) => {
    const storage = registry.getStorage()
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      bookId,
      location,
      label,
      color,
      progress,
      createdAt: Date.now(),
    }
    await storage.saveBookmark(bookmark)
    set({ bookmarks: [...get().bookmarks, bookmark] })
  },

  removeBookmark: async (id: string) => {
    const storage = registry.getStorage()
    await storage.deleteBookmark(id)
    set({ bookmarks: get().bookmarks.filter((b) => b.id !== id) })
  },

  hasBookmarkAt: (location: string) => {
    return get().bookmarks.some((b) => b.location === location)
  },

  getBookmarkAt: (location: string) => {
    return get().bookmarks.find((b) => b.location === location)
  },
}))
