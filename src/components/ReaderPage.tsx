import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useAnimate } from 'motion/react'
import { useReader } from '../hooks/useReader'
import { useKeyboard } from '../hooks/useKeyboard'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useHighlightStore } from '../stores/highlightStore'
import { ArrowLeft, Bookmark, Highlighter, List, ChevronLeft, ChevronRight, Sun, Moon, Settings, X } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useSettingsStore } from '../stores/settingsStore'
import type { TOCItem } from '../core/types'

interface Props {
  bookId: string
  onBack: () => void
}

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }
const springSlide = { type: 'spring' as const, bounce: 0.15, duration: 0.3 }
const springBounce = { type: 'spring' as const, bounce: 0.4, duration: 0.35 }

const bookmarkColors = [
  { name: '琥珀', value: '#D4996A' },
  { name: '珊瑚', value: '#DA7A5A' },
  { name: '青蓝', value: '#6BA3A0' },
  { name: '藤绿', value: '#8FA87A' },
  { name: '紫罗兰', value: '#B89AC4' },
]

const sidebarTabs = [
  { key: 'toc' as const, label: '目录' },
  { key: 'bookmarks' as const, label: '书签' },
  { key: 'settings' as const, label: '设置' },
]

export function ReaderPage({ bookId, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { nextPage, prevPage, getEngine, pageInfo, applySettings } = useReader(bookId, containerRef)
  const book = useBookshelfStore((s) => s.books.find((b) => b.id === bookId))
  const { bookmarks, loadBookmarks, addBookmark, getBookmarkAt, removeBookmark } = useBookmarkStore()
  const { loadHighlights } = useHighlightStore()
  const { settings, updateSettings } = useSettingsStore()

  const [toc, setToc] = useState<TOCItem[]>([])
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'bookmarks' | 'settings' | null>(null)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [pageKey, setPageKey] = useState(0)
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnDirection = useRef(0)
  const pageInfoRef = useRef(pageInfo)
  pageInfoRef.current = pageInfo
  const [cardScope, cardAnimate] = useAnimate()
  const [bookmarkScope, bookmarkAnimate] = useAnimate()
  const { toggle: toggleTheme, isDark } = useTheme()

  const handleNext = useCallback(() => {
    turnDirection.current = 1
    nextPage()
  }, [nextPage])

  const handlePrev = useCallback(() => {
    turnDirection.current = -1
    prevPage()
  }, [prevPage])

  useKeyboard({ onPrev: handlePrev, onNext: handleNext })

  useEffect(() => {
    loadBookmarks(bookId)
    loadHighlights(bookId)
  }, [bookId, loadBookmarks, loadHighlights])

  // 页码变化触发动画
  useEffect(() => {
    setPageKey((k) => k + 1)
  }, [pageInfo.current])

  useEffect(() => {
    if (pageKey === 0) return
    const dir = turnDirection.current
    if (dir === 0) return
    cardAnimate(cardScope.current,
      { x: [dir * 24, 0], opacity: [0.6, 1] },
      { type: 'spring', bounce: 0, duration: 0.3 },
    )
  }, [pageKey])

  // 暗夜模式切换时更新 iframe 内文字颜色
  useEffect(() => {
    getEngine()?.setTheme(isDark ? 'dark' : 'light')
  }, [isDark, pageInfo.total, getEngine])

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

  const currentLocation = useCallback(() => getEngine()?.getCurrentLocation() ?? '', [getEngine])
  const currentBookmark = useCallback(() => {
    const loc = currentLocation()
    return loc ? getBookmarkAt(loc) : undefined
  }, [currentLocation, getBookmarkAt])

  const handleBookmarkClick = useCallback(() => {
    const loc = currentLocation()
    if (!loc) return
    const existing = getBookmarkAt(loc)
    if (existing) {
      // 已有书签 → 打开书签列表
      setSidebarTab('bookmarks')
      return
    }
    setPickerOpen((p) => !p)
  }, [currentLocation, getBookmarkAt])

  const handlePickColor = useCallback(async (color: string) => {
    const loc = currentLocation()
    if (!loc) return
    setPickerOpen(false)
    const { current, total } = pageInfoRef.current
    const progress = total > 0 ? Math.round((current / total) * 100) : 50
    await addBookmark(bookId, loc, `书签 ${bookmarks.length + 1}`, color, progress)
    bookmarkAnimate(bookmarkScope.current,
      { scale: [1, 1.35, 1] },
      { type: 'spring', bounce: 0.4, duration: 0.4 },
    )
  }, [currentLocation, addBookmark, bookId, bookmarks.length, bookmarkAnimate, bookmarkScope])

  const handleShowToc = async () => {
    const engine = getEngine()
    if (!engine) return
    const items = await engine.getTOC()
    setToc(items)
    setSidebarTab('toc')
  }

  const handleSettingsChange = (patch: Partial<typeof settings>) => {
    updateSettings(patch)
    applySettings({ ...settings, ...patch })
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
        <div className="relative">
          <motion.button
            ref={bookmarkScope}
            onClick={handleBookmarkClick}
            className="rounded-full p-2.5"
            whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
            whileTap={{ scale: 0.94 }}
            transition={springPress}
            style={{ color: currentBookmark()?.color ?? 'var(--color-text)' }}
            aria-label="添加书签"
          >
            <Bookmark
              className="h-5 w-5"
              fill={currentBookmark() ? (currentBookmark()!.color) : 'none'}
            />
          </motion.button>
          <AnimatePresence>
            {pickerOpen && (
              <>
                <motion.div
                  className="fixed inset-0 z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setPickerOpen(false)}
                />
                <motion.div
                  className="absolute right-0 top-full z-20 mt-2 flex gap-2 rounded-2xl px-3 py-2.5"
                  style={{
                    background: toolbarBg,
                    backdropFilter: toolbarBlur,
                    WebkitBackdropFilter: toolbarBlur,
                    boxShadow: 'var(--shadow-float)',
                    border: '1px solid var(--color-separator)',
                  }}
                  initial={{ scale: 0.7, opacity: 0, y: -8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.7, opacity: 0, y: -8 }}
                  transition={springBounce}
                >
                  {bookmarkColors.map((c) => (
                    <motion.button
                      key={c.value}
                      className="rounded-full"
                      style={{
                        width: 22,
                        height: 22,
                        background: c.value,
                        boxShadow: `0 0 0 2px var(--color-card), 0 2px 8px ${c.value}40`,
                      }}
                      whileHover={{ scale: 1.3 }}
                      whileTap={{ scale: 0.9 }}
                      transition={springPress}
                      onClick={() => handlePickColor(c.value)}
                      aria-label={c.name}
                    />
                  ))}
                  <div
                    className="mx-0.5 self-stretch"
                    style={{
                      width: 1,
                      background: 'var(--color-separator)',
                    }}
                  />
                  <motion.button
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 22,
                      height: 22,
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-separator)',
                    }}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.9 }}
                    transition={springPress}
                    onClick={() => setPickerOpen(false)}
                    aria-label="关闭"
                  >
                    <X className="h-2.5 w-2.5" style={{ color: 'var(--color-text-secondary)' }} />
                  </motion.button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
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
          onClick={toggleTheme}
          className="rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label={isDark ? '切换日间模式' : '切换暗夜模式'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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
        <motion.button
          onClick={() => setSidebarTab('settings')}
          className="rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="设置"
        >
          <Settings className="h-5 w-5" />
        </motion.button>
      </motion.header>

      {/* 阅读区域 */}
      <div className="relative flex-1 overflow-hidden px-4 pb-4 pt-2">
        {/* 阅读卡片 — 翻页滑入动效 */}
        <motion.div
          ref={cardScope}
          className="relative mx-auto h-full max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
          style={{
            background: 'var(--color-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
          }}
          onMouseMove={(e) => {
            resetHideTimer()
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            if (x < 60) setHoveredEdge('left')
            else if (x > rect.width - 60) setHoveredEdge('right')
            else setHoveredEdge(null)
          }}
          onMouseLeave={() => setHoveredEdge(null)}
          onClick={(e) => {
            const { clientX, currentTarget } = e
            const mid = currentTarget.clientWidth / 2
            if (clientX < mid) handlePrev()
            else handleNext()
          }}
        >
          <div ref={containerRef} className="h-full w-full" style={{ borderRadius: 'var(--radius-card)' }} />
          {/* 书签标记 — 右侧常驻 */}
          {bookmarks.length > 0 && (
            <div className="pointer-events-none absolute right-1.5 top-2 bottom-2 z-10 flex flex-col">
              {bookmarks.map((bm) => {
                const pct = bm.progress ?? 50
                return (
                  <div
                    key={bm.id}
                    className="pointer-events-auto relative flex items-center"
                    style={{
                      position: 'absolute',
                      top: `${Math.min(95, Math.max(5, pct))}%`,
                      right: 0,
                    }}
                  >
                    <motion.button
                      className="group/dot flex items-center gap-1.5"
                      initial={false}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      transition={springPress}
                      onClick={(e) => {
                        e.stopPropagation()
                        getEngine()?.goToLocation(bm.location)
                      }}
                      aria-label={`跳转到书签：${bm.label}`}
                    >
                      <span
                        className="block rounded-full opacity-30 transition-opacity duration-200 group-hover/dot:opacity-100"
                        style={{
                          width: 8,
                          height: 8,
                          background: bm.color,
                          boxShadow: `0 0 6px ${bm.color}60`,
                        }}
                      />
                      <span
                        className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium group-hover/dot:inline-block"
                        style={{
                          background: toolbarBg,
                          backdropFilter: toolbarBlur,
                          WebkitBackdropFilter: toolbarBlur,
                          boxShadow: 'var(--shadow-float)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-separator)',
                        }}
                      >
                        {bm.label}
                      </span>
                    </motion.button>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* 左边缘高亮区域 */}
        <motion.div
          className="pointer-events-none absolute left-0 z-10 rounded-l-2xl"
          style={{
            top: 8,
            bottom: 8,
            width: 80,
            background: isDark
              ? 'radial-gradient(ellipse 120% 50% at 8px 50%, rgba(212,153,106,0.22) 0%, rgba(212,153,106,0.08) 45%, transparent 80%)'
              : 'linear-gradient(to right, rgba(184,124,75,0.08), transparent)',
          }}
          animate={{
            opacity: toolbarVisible ? 0 : hoveredEdge === 'left' ? 1 : 0.4,
          }}
          transition={{ duration: 0.35 }}
        />

        {/* 左翻页按钮 — 全高长条 */}
        <motion.button
          onClick={handlePrev}
          className="absolute left-2 z-10 flex items-center justify-center rounded-2xl px-1"
          style={{
            top: 8,
            bottom: 8,
            ...navButtonClass,
          }}
          whileHover={{ scale: 1.04, boxShadow: isDark ? '0 0 36px rgba(212,153,106,0.30)' : '0 0 20px rgba(184,124,75,0.18)' }}
          whileTap={{ scale: 0.96 }}
          transition={springDefault}
          animate={{
            opacity: toolbarVisible ? 0 : hoveredEdge === 'left' ? 0.85 : 0.2,
          }}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </motion.button>

        {/* 右边缘高亮区域 */}
        <motion.div
          className="pointer-events-none absolute right-0 z-10 rounded-r-2xl"
          style={{
            top: 8,
            bottom: 8,
            width: 80,
            background: isDark
              ? 'radial-gradient(ellipse 120% 50% at calc(100% - 8px) 50%, rgba(212,153,106,0.22) 0%, rgba(212,153,106,0.08) 45%, transparent 80%)'
              : 'linear-gradient(to left, rgba(184,124,75,0.08), transparent)',
          }}
          animate={{
            opacity: toolbarVisible ? 0 : hoveredEdge === 'right' ? 1 : 0.4,
          }}
          transition={{ duration: 0.35 }}
        />

        {/* 右翻页按钮 — 全高长条 */}
        <motion.button
          onClick={handleNext}
          className="absolute right-2 z-10 flex items-center justify-center rounded-2xl px-1"
          style={{
            top: 8,
            bottom: 8,
            ...navButtonClass,
          }}
          whileHover={{ scale: 1.04, boxShadow: isDark ? '0 0 36px rgba(212,153,106,0.30)' : '0 0 20px rgba(184,124,75,0.18)' }}
          whileTap={{ scale: 0.96 }}
          transition={springDefault}
          animate={{
            opacity: toolbarVisible ? 0 : hoveredEdge === 'right' ? 0.85 : 0.2,
          }}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
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

      {/* 侧栏 — spring 滑入（目录 / 设置） */}
      <AnimatePresence>
        {sidebarTab !== null && (
          <div className="fixed inset-0 z-20 flex">
            <motion.div
              className="flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ background: 'rgba(60,50,38,0.15)' }}
              onClick={() => setSidebarTab(null)}
            />
            <motion.nav
              className="w-72 overflow-y-auto"
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
              {/* Tab 栏 */}
              <div
                className="flex border-b px-5 pt-5 pb-0"
                style={{ borderColor: 'var(--color-separator)' }}
              >
                {sidebarTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className="relative flex-1 pb-3 text-sm font-medium transition-colors"
                    style={{
                      color: sidebarTab === tab.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                    onClick={() => setSidebarTab(tab.key)}
                  >
                    {tab.label}
                    {sidebarTab === tab.key && (
                      <motion.div
                        layoutId="sidebar-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: 'var(--color-accent)' }}
                        transition={springDefault}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* 目录面板 */}
              {sidebarTab === 'toc' && (
                <div className="p-5">
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
                        setSidebarTab(null)
                      }}
                    >
                      {item.label}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* 书签面板 */}
              {sidebarTab === 'bookmarks' && (
                <div className="flex flex-col gap-2.5 p-5">
                  <AnimatePresence>
                    {bookmarks.length === 0 ? (
                      <motion.div
                        className="mt-8 flex flex-col items-center gap-3 text-center"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Bookmark
                          className="h-8 w-8"
                          style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }}
                        />
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          还没有书签哦，读到精彩处打个标记吧
                        </p>
                      </motion.div>
                    ) : (
                      bookmarks.map((bm) => (
                        <motion.div
                          key={bm.id}
                          className="flex items-center overflow-hidden rounded-xl"
                          style={{
                            background: 'var(--color-card)',
                            boxShadow: 'var(--shadow-card)',
                          }}
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                          transition={springDefault}
                          layout
                        >
                          <div
                            className="h-12 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: bm.color, marginLeft: 0 }}
                          />
                          <button
                            className="min-w-0 flex-1 px-3 py-2.5 text-left"
                            onClick={() => {
                              getEngine()?.goToLocation(bm.location)
                              setSidebarTab(null)
                            }}
                          >
                            <p
                              className="truncate text-sm font-medium"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {bm.label}
                            </p>
                            <p
                              className="text-xs"
                              style={{
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.75rem',
                              }}
                            >
                              {new Date(bm.createdAt).toLocaleString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </button>
                          <motion.button
                            className="flex-shrink-0 rounded-full p-2.5"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            transition={springPress}
                            style={{ color: 'var(--color-text-secondary)' }}
                            onClick={() => removeBookmark(bm.id)}
                            aria-label="删除书签"
                          >
                            <X className="h-3.5 w-3.5" />
                          </motion.button>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* 设置面板 */}
              {sidebarTab === 'settings' && (
                <div className="flex flex-col gap-6 p-5">
                  {/* 字号 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      字号
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>12</span>
                      <input
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        value={settings.fontSize}
                        onChange={(e) => handleSettingsChange({ fontSize: Number(e.target.value) })}
                        className="flex-1"
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>24</span>
                    </div>
                    <p
                      className="mt-1 text-center text-xs"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {settings.fontSize}px
                    </p>
                  </div>

                  {/* 字体 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      字体
                    </p>
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => handleSettingsChange({ fontFamily: e.target.value })}
                      className="w-full rounded-lg px-3 py-2.5 text-sm font-medium"
                      style={{
                        background: 'var(--color-card)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-separator)',
                      }}
                    >
                      <option value="">系统默认</option>
                      <option value="serif">宋体</option>
                      <option value="'KaiTi', 'STKaiti', serif">楷体</option>
                      <option value="'SimHei', 'Heiti SC', sans-serif">黑体</option>
                    </select>
                  </div>

                  {/* 行间距 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      行间距
                    </p>
                    <div className="flex gap-2">
                      {[
                        { label: '紧凑', value: 1.4 },
                        { label: '标准', value: 1.8 },
                        { label: '宽松', value: 2.2 },
                      ].map((opt) => (
                        <motion.button
                          key={opt.value}
                          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium"
                          style={{
                            background: settings.lineHeight === opt.value ? 'var(--color-accent)' : 'var(--color-card)',
                            color: settings.lineHeight === opt.value ? '#fff' : 'var(--color-text)',
                            border: settings.lineHeight === opt.value ? 'none' : '1px solid var(--color-separator)',
                          }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          transition={springPress}
                          onClick={() => handleSettingsChange({ lineHeight: opt.value })}
                        >
                          {opt.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
