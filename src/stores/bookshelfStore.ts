import { create } from 'zustand'
import { registry } from '../core/registry'
import { BookFormat, type BookRecord } from '../core/types'

interface BookshelfState {
  books: BookRecord[]
  loading: boolean
  currentBookId: string | null

  loadBooks: () => Promise<void>
  importBook: (file: File) => Promise<void>
  removeBook: (id: string) => Promise<void>
  setCurrentBook: (id: string | null) => void
}

export const useBookshelfStore = create<BookshelfState>((set, get) => ({
  books: [],
  loading: false,
  currentBookId: null,

  loadBooks: async () => {
    set({ loading: true })
    const storage = registry.getStorage()
    const books = await storage.getAllBooks()
    set({ books, loading: false })
  },

  importBook: async (file: File) => {
    const storage = registry.getStorage()
    const buffer = await file.arrayBuffer()

    // 推断格式
    const ext = file.name.split('.').pop()?.toLowerCase()
    const formatMap: Record<string, BookFormat> = {
      epub: BookFormat.EPUB,
      pdf: BookFormat.PDF,
      txt: BookFormat.TXT,
      mobi: BookFormat.MOBI,
      azw3: BookFormat.AZW3,
    }
    const format = formatMap[ext ?? ''] ?? BookFormat.UNKNOWN

    // 提取元数据（EPUB 才有 parser，其他格式用基础信息）
    let title = file.name.replace(/\.[^.]+$/, '')
    let author = 'Unknown'
    let coverUrl: string | undefined

    const parser = registry.getParser(format)
    if (parser) {
      try {
        const meta = await parser.getMetadata(buffer)
        title = meta.title
        author = meta.author
        if (meta.cover) {
          coverUrl = URL.createObjectURL(meta.cover)
        }
      } catch {
        // 降级使用文件名
      }
    }

    const id = crypto.randomUUID()
    await storage.saveFileData(id, buffer)

    const book: BookRecord = {
      id,
      title,
      author,
      coverUrl,
      format,
      fileSize: file.size,
      fileName: file.name,
      fileDataKey: id,
      addedAt: Date.now(),
    }

    await storage.saveBook(book)
    await get().loadBooks()
  },

  removeBook: async (id: string) => {
    const storage = registry.getStorage()
    await storage.deleteBook(id)
    set((s) => ({
      books: s.books.filter((b) => b.id !== id),
      currentBookId: s.currentBookId === id ? null : s.currentBookId,
    }))
  },

  setCurrentBook: (id) => set({ currentBookId: id }),
}))
