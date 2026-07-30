import type { BookRecord, Bookmark, CompendiumEntry, CompendiumImportData, Highlight, ReadingProgress } from '../types'

export interface IStorageAdapter {
  saveBook(book: BookRecord): Promise<void>
  getBook(id: string): Promise<BookRecord | null>
  getAllBooks(): Promise<BookRecord[]>
  deleteBook(id: string): Promise<void>

  set(key: string, value: unknown): Promise<void>
  get<T>(key: string): Promise<T | null>
  delete(key: string): Promise<void>

  saveFileData(bookId: string, data: ArrayBuffer): Promise<void>
  getFileData(bookId: string): Promise<ArrayBuffer | null>

  getUsageInfo(): Promise<{ used: number; quota: number }>

  saveBookmark(bookmark: Bookmark): Promise<void>
  getBookmarks(bookId: string): Promise<Bookmark[]>
  deleteBookmark(id: string): Promise<void>

  saveProgress(progress: ReadingProgress): Promise<void>
  getProgress(bookId: string): Promise<ReadingProgress | null>

  saveHighlight(highlight: Highlight): Promise<void>
  getHighlights(bookId: string): Promise<Highlight[]>
  deleteHighlight(id: string): Promise<void>

  saveEntry(entry: CompendiumEntry): Promise<void>
  getEntry(id: string): Promise<CompendiumEntry | null>
  getEntriesByBook(bookId: string): Promise<CompendiumEntry[]>
  updateEntry(id: string, patch: Partial<CompendiumEntry>): Promise<void>
  deleteEntry(id: string): Promise<void>
  importCompendium(bookId: string, data: CompendiumImportData): Promise<void>
}
