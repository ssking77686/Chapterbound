import type { BookRecord } from '../types'

export interface IStorageAdapter {
  saveBook(book: BookRecord): Promise<void>
  getBook(id: string): Promise<BookRecord | null>
  getAllBooks(): Promise<BookRecord[]>
  deleteBook(id: string): Promise<void>

  set(key: string, value: unknown): Promise<void>
  get<T>(key: string): Promise<T | null>
  delete(key: string): Promise<void>

  getUsageInfo(): Promise<{ used: number; quota: number }>
}
