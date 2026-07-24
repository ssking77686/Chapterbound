import { useEffect, useRef } from 'react'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { BookOpen, Trash2, Plus } from 'lucide-react'

interface Props {
  onOpenBook: (id: string) => void
}

export function LibraryPage({ onOpenBook }: Props) {
  const { books, loading, loadBooks, importBook, removeBook } = useBookshelfStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await importBook(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">我的书架</h1>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800">
            <Plus className="h-4 w-4" />
            导入书籍
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,.pdf,.txt"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {loading ? (
          <p className="mt-20 text-center text-gray-400">加载中...</p>
        ) : books.length === 0 ? (
          <div className="mt-20 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-400">书架是空的，点击上方按钮导入你的第一本书</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {books.map((book) => (
              <div
                key={book.id}
                className="group relative cursor-pointer overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md"
                onClick={() => onOpenBook(book.id)}
              >
                <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <p className="truncate text-sm font-medium">{book.title}</p>
                  <p className="truncate text-xs text-gray-400">{book.author}</p>
                </div>
                <button
                  className="absolute right-2 top-2 hidden rounded-lg bg-white/90 p-1.5 text-red-500 shadow transition hover:bg-red-50 group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeBook(book.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
