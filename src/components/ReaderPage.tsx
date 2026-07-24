import { useRef, useState, useEffect } from 'react'
import { useReader } from '../hooks/useReader'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useHighlightStore } from '../stores/highlightStore'
import { ArrowLeft, Bookmark, Highlighter, List } from 'lucide-react'
import type { TOCItem } from '../core/types'

interface Props {
  bookId: string
  onBack: () => void
}

export function ReaderPage({ bookId, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { nextPage, prevPage, getEngine } = useReader(bookId, containerRef)
  const book = useBookshelfStore((s) => s.books.find((b) => b.id === bookId))
  const { bookmarks, loadBookmarks, addBookmark } = useBookmarkStore()
  const { loadHighlights } = useHighlightStore()

  const [toc, setToc] = useState<TOCItem[]>([])
  const [showToc, setShowToc] = useState(false)

  useEffect(() => {
    loadBookmarks(bookId)
    loadHighlights(bookId)
  }, [bookId, loadBookmarks, loadHighlights])

  const handleBookmark = async () => {
    const engine = getEngine()
    if (!engine) return
    const loc = engine.getCurrentLocation()
    await addBookmark(bookId, loc, `书签 ${bookmarks.length + 1}`)
  }

  const handleShowToc = async () => {
    const engine = getEngine()
    if (!engine) return
    const items = await engine.getTOC()
    setToc(items)
    setShowToc(true)
  }

  return (
    <div className="relative flex h-screen flex-col bg-gray-100">
      {/* Toolbar */}
      <header className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <button onClick={onBack} className="rounded-lg p-2 transition hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex-1 truncate text-sm font-medium">{book?.title ?? '阅读中'}</span>
        <button onClick={handleBookmark} className="rounded-lg p-2 transition hover:bg-gray-100">
          <Bookmark className="h-5 w-5" />
        </button>
        <button className="rounded-lg p-2 transition hover:bg-gray-100">
          <Highlighter className="h-5 w-5" />
        </button>
        <button onClick={handleShowToc} className="rounded-lg p-2 transition hover:bg-gray-100">
          <List className="h-5 w-5" />
        </button>
      </header>

      {/* Reading area */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="mx-auto h-full max-w-3xl bg-white shadow-lg"
          onClick={(e) => {
            const { clientX, currentTarget } = e
            const mid = currentTarget.clientWidth / 2
            if (clientX < mid) prevPage()
            else nextPage()
          }}
        />
      </div>

      {/* TOC sidebar */}
      {showToc && (
        <div className="fixed inset-0 z-20 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowToc(false)} />
          <nav className="w-72 overflow-y-auto border-l bg-white p-4 shadow-xl">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">目录</h3>
            {toc.map((item, i) => (
              <button
                key={i}
                className="block w-full py-1.5 text-left text-sm text-gray-700 transition hover:text-gray-900"
                style={{ paddingLeft: item.level * 12 + 4 }}
                onClick={() => {
                  getEngine()?.goToLocation(item.href)
                  setShowToc(false)
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Bottom page indicator */}
      <footer className="border-t bg-white px-4 py-1 text-center text-xs text-gray-400">
        点击左侧翻上一页，右侧翻下一页
      </footer>
    </div>
  )
}
