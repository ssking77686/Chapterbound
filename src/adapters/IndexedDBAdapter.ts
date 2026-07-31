import Dexie, { type Table } from 'dexie'
import type { BookRecord, Bookmark, CompendiumEntry, CompendiumImportData, Highlight, ReadingProgress } from '../core/types'
import type { IStorageAdapter } from '../core/interfaces/IStorageAdapter'

// ── Database Schema ──────────────────────────────────────────

class ReaderDB extends Dexie {
  books!: Table<BookRecord, string>
  bookmarks!: Table<Bookmark, string>
  highlights!: Table<Highlight, string>
  readingProgress!: Table<ReadingProgress, string> // keyed by bookId
  files!: Table<{ id: string; data: ArrayBuffer }, string>
  kvStore!: Table<{ key: string; value: unknown }, string>
  compendium!: Table<CompendiumEntry, string>

  constructor() {
    super('EBookReader')

    this.version(1).stores({
      books: 'id, format, addedAt, lastReadAt',
      bookmarks: 'id, bookId, createdAt',
      highlights: 'id, bookId, createdAt',
      readingProgress: 'bookId',
      files: 'id',
      kvStore: 'key',
    })

    this.version(2).stores({
      compendium: 'id, bookId, category',
    })
  }
}

// ── Adapter Implementation ───────────────────────────────────

export class IndexedDBAdapter implements IStorageAdapter {
  private db = new ReaderDB()

  // 书籍
  async saveBook(book: BookRecord): Promise<void> {
    await this.db.books.put(book)
  }

  async getBook(id: string): Promise<BookRecord | null> {
    return (await this.db.books.get(id)) ?? null
  }

  async getAllBooks(): Promise<BookRecord[]> {
    return this.db.books.orderBy('addedAt').reverse().toArray()
  }

  async deleteBook(id: string): Promise<void> {
    await this.db.books.delete(id)
    await this.db.files.delete(id)
    await this.db.bookmarks.where('bookId').equals(id).delete()
    await this.db.highlights.where('bookId').equals(id).delete()
    await this.db.readingProgress.delete(id)
    await this.db.compendium.where('bookId').equals(id).delete()
  }

  // 文件二进制存储
  async saveFileData(bookId: string, data: ArrayBuffer): Promise<void> {
    await this.db.files.put({ id: bookId, data })
  }

  async getFileData(bookId: string): Promise<ArrayBuffer | null> {
    const record = await this.db.files.get(bookId)
    return record?.data ?? null
  }

  // 书签
  async saveBookmark(bookmark: Bookmark): Promise<void> {
    await this.db.bookmarks.put(bookmark)
  }

  async getBookmarks(bookId: string): Promise<Bookmark[]> {
    return this.db.bookmarks.where('bookId').equals(bookId).sortBy('createdAt')
  }

  async deleteBookmark(id: string): Promise<void> {
    await this.db.bookmarks.delete(id)
  }

  // 高亮
  async saveHighlight(highlight: Highlight): Promise<void> {
    await this.db.highlights.put(highlight)
  }

  async getHighlights(bookId: string): Promise<Highlight[]> {
    return this.db.highlights.where('bookId').equals(bookId).sortBy('createdAt')
  }

  async deleteHighlight(id: string): Promise<void> {
    await this.db.highlights.delete(id)
  }

  // 阅读进度
  async saveProgress(progress: ReadingProgress): Promise<void> {
    await this.db.readingProgress.put(progress)
  }

  async getProgress(bookId: string): Promise<ReadingProgress | null> {
    return (await this.db.readingProgress.get(bookId)) ?? null
  }

  // 通用键值
  async set(key: string, value: unknown): Promise<void> {
    await this.db.kvStore.put({ key, value })
  }

  async get<T>(key: string): Promise<T | null> {
    const record = await this.db.kvStore.get(key)
    return (record?.value as T) ?? null
  }

  async delete(key: string): Promise<void> {
    await this.db.kvStore.delete(key)
  }

  // 图鉴
  async saveEntry(entry: CompendiumEntry): Promise<void> {
    await this.db.compendium.put(entry)
  }

  async getEntry(id: string): Promise<CompendiumEntry | null> {
    return (await this.db.compendium.get(id)) ?? null
  }

  async getEntriesByBook(bookId: string): Promise<CompendiumEntry[]> {
    return this.db.compendium.where('bookId').equals(bookId).toArray()
  }

  async updateEntry(id: string, patch: Partial<CompendiumEntry>): Promise<void> {
    await this.db.compendium.update(id, patch)
  }

  async deleteEntry(id: string): Promise<void> {
    await this.db.compendium.delete(id)
  }

  async importCompendium(bookId: string, data: CompendiumImportData): Promise<void> {
    const now = Date.now()
    const entries: CompendiumEntry[] = [
      ...data.characters,
      ...data.locations,
      ...data.monsters,
    ].map((item) => ({
      ...item,
      bookId,
      aliases: item.aliases ?? [],
      quotations: (item.quotations ?? []).map((q) => (
        q.chapter !== undefined ? { ...q, unlocked: false } : { ...q, unlocked: true }
      )),
      entries: item.entries.map((e) => ({ ...e, unlocked: false })),
      createdAt: now,
      updatedAt: now,
    }))
    // 先清空旧数据再写入，避免重新导入时残留已删除条目
    await this.db.compendium.where('bookId').equals(bookId).delete()
    await this.db.compendium.bulkPut(entries)
    // 重置章节进度，避免新数据被旧进度批量解锁
    await this.db.kvStore.delete(`compendium:chapter:${bookId}`)
  }

  // 图鉴章节进度（按 bookId 隔离，存 kvStore）
  async saveCompendiumChapter(bookId: string, chapter: number): Promise<void> {
    await this.db.kvStore.put({ key: `compendium:chapter:${bookId}`, value: chapter })
  }

  async getCompendiumChapter(bookId: string): Promise<number> {
    const record = await this.db.kvStore.get(`compendium:chapter:${bookId}`)
    return (record?.value as number) ?? 0
  }

  // 存储用量
  async getUsageInfo(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        used: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      }
    }
    return { used: 0, quota: 0 }
  }
}
