import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useReader } from '../hooks/useReader'
import { useKeyboard } from '../hooks/useKeyboard'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useHighlightStore } from '../stores/highlightStore'
import { ArrowLeft, Bookmark, Highlighter, List, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TOCItem } from '../core/types'

interface Props {
  bookId: string
  onBack: () => void
}

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }
const springSlide = { type: 'spring' as const, bounce: 0.15, duration: 0.3 }

export function ReaderPage({ bookId, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { nextPage, prevPage, getEngine, pageInfo } = useReader(bookId, containerRef)
  const book = useBookshelfStore((s) => s.books.find((b) => b.id === bookId))
  const { bookmarks, loadBookmarks, addBookmark } = useBookmarkStore()
  const { loadHighlights } = useHighlightStore()

  const [toc, setToc] = useState<TOCItem[]>([])
  const [showToc, setShowToc] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [pageKey, setPageKey] = useState(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useKeyboard({ onPrev: prevPage, onNext: nextPage })

  useEffect(() => {
    loadBookmarks(bookId)
    loadHighlights(bookId)
  }, [bookId, loadBookmarks, loadHighlights])

  // 页码变化触发动画
  useEffect(() => {
    setPageKey((k) => k + 1)
  }, [pageInfo.current])

  const resetHideTimer = useCallback(() => {
    setToolbarVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 3000)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

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

  const toolbarBg = 'var(--color-toolbar)'
  const toolbarBlur = 'blur(24px) saturate(180%)'

  const navButtonClass = useMemo(
    () => ({
      background: toolbarBg,
      backdropFilter: toolbarBlur,
      WebkitBackdropFilter: toolbarBlur,
      boxShadow: 'var(--shadow-float)',
      color: 'var(--color-text)',
    }),
    [],
  )

  return (
    <div
      className="relative flex h-screen flex-col"
      style={{ background: 'var(--color-page-bg)' }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* 材质化工具栏 — 自动渐隐 */}
      <motion.header
        className="relative z-10 flex items-center gap-1 px-2 py-2"
        style={{
          background: toolbarBg,
          backdropFilter: toolbarBlur,
          WebkitBackdropFilter: toolbarBlur,
        }}
        animate={{
          opacity: toolbarVisible ? 1 : 0.3,
          transition: { duration: 0.5, ease: 'easeInOut' },
        }}
      >
        <motion.button
          onClick={onBack}
          className="rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        <span
          className="flex-1 truncate px-1 text-sm font-medium"
          style={{ color: 'var(--color-text)' }}
        >
          {book?.title ?? '阅读中'}
        </span>
        <motion.button
          onClick={handleBookmark}
          className="rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="添加书签"
        >
          <Bookmark className="h-5 w-5" />
        </motion.button>
        <motion.button
          className="rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="高亮"
        >
          <Highlighter className="h-5 w-5" />
        </motion.button>
        <motion.button
          onClick={handleShowToc}
          className="rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="目录"
        >
          <List className="h-5 w-5" />
        </motion.button>
      </motion.header>

      {/* 阅读区域 */}
      <div className="relative flex-1 overflow-hidden px-4 pb-4 pt-2">
        {/* 阅读卡片 */}
        <div
          className="mx-auto h-full max-w-3xl"
          style={{
            background: 'var(--color-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
          }}
          onClick={(e) => {
            const { clientX, currentTarget } = e
            const mid = currentTarget.clientWidth / 2
            if (clientX < mid) prevPage()
            else nextPage()
          }}
        >
          <div ref={containerRef} className="h-full w-full" style={{ borderRadius: 'var(--radius-card)' }} />
        </div>

        {/* 左翻页按钮 */}
        <motion.button
          onClick={prevPage}
          className="absolute left-6 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 opacity-0"
          style={navButtonClass}
          whileHover={{ scale: 1.12, opacity: 1 }}
          whileTap={{ scale: 0.9 }}
          transition={springDefault}
          animate={{ opacity: toolbarVisible ? 0 : undefined }}
          aria-label="上一页"
        >
          <ChevronLeft className="h-5 w-5" />
        </motion.button>

        {/* 右翻页按钮 */}
        <motion.button
          onClick={nextPage}
          className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 opacity-0"
          style={navButtonClass}
          whileHover={{ scale: 1.12, opacity: 1 }}
          whileTap={{ scale: 0.9 }}
          transition={springDefault}
          animate={{ opacity: toolbarVisible ? 0 : undefined }}
          aria-label="下一页"
        >
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </div>

      {/* 页码 — 浮动胶囊 */}
      <AnimatePresence>
        {pageInfo.total > 0 && (
          <motion.div
            className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2"
            key={pageKey}
            initial={{ y: 6, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={springDefault}
          >
            <span
              className="inline-block rounded-full px-3.5 py-1 text-xs font-medium tracking-tight"
              style={{
                background: toolbarBg,
                backdropFilter: toolbarBlur,
                WebkitBackdropFilter: toolbarBlur,
                boxShadow: 'var(--shadow-card)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {pageInfo.current} / {pageInfo.total}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOC 侧栏 — spring 滑入 */}
      <AnimatePresence>
        {showToc && (
          <div className="fixed inset-0 z-20 flex">
            <motion.div
              className="flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ background: 'rgba(60,50,38,0.15)' }}
              onClick={() => setShowToc(false)}
            />
            <motion.nav
              className="w-72 overflow-y-auto p-5"
              style={{
                background: toolbarBg,
                backdropFilter: toolbarBlur,
                WebkitBackdropFilter: toolbarBlur,
                borderLeft: '1px solid var(--color-separator)',
              }}
              initial={{ x: 288 }}
              animate={{ x: 0 }}
              exit={{ x: 288 }}
              transition={springSlide}
            >
              <h3
                className="mb-5 text-lg font-bold tracking-[-0.01em]"
                style={{ color: 'var(--color-text)', lineHeight: 1.15 }}
              >
                目录
              </h3>
              {toc.map((item, i) => (
                <motion.button
                  key={i}
                  className="block w-full rounded-lg py-2.5 text-left text-sm font-medium"
                  style={{
                    paddingLeft: item.level * 14 + 8,
                    color: 'var(--color-text)',
                  }}
                  whileHover={{ background: 'rgba(60,50,38,0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  transition={springPress}
                  onClick={() => {
                    getEngine()?.goToLocation(item.href)
                    setShowToc(false)
                  }}
                >
                  {item.label}
                </motion.button>
              ))}
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
