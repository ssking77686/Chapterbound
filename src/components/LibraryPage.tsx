import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { BookOpen, Trash2, Plus, Sun, Moon, ImageIcon, Undo2 } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

interface Props {
  onOpenBook: (id: string) => void
}

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }
const springPop = { type: 'spring' as const, bounce: 0.15, duration: 0.3 }

export function LibraryPage({ onOpenBook }: Props) {
  const { books, loading, loadBooks, importBook, removeBook, updateCover, resetCover } = useBookshelfStore()
  const { toggle: toggleTheme, isDark } = useTheme()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [editingCoverId, setEditingCoverId] = useState<string | null>(null)

  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await importBook(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id))
    setTimeout(() => {
      removeBook(id)
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 250)
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editingCoverId) return
    await updateCover(editingCoverId, file)
    setEditingCoverId(null)
    if (coverInputRef.current) coverInputRef.current.value = ''
  }

  const toolbarBg = 'var(--color-toolbar)'
  const toolbarBlur = 'blur(24px) saturate(180%)'

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-page-bg)' }}>
      {/* 材质化导航栏 — scroll 联动 shadow */}
      <motion.header
        className="sticky top-0 z-10 px-4 py-3"
        style={{
          background: toolbarBg,
          backdropFilter: toolbarBlur,
          WebkitBackdropFilter: toolbarBlur,
          boxShadow: scrolled ? '0 1px 0 0 var(--color-separator)' : 'none',
        }}
      >
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-2">
          <h1
            className="text-3xl font-bold tracking-[-0.015em]"
            style={{ color: 'var(--color-text)', lineHeight: 1.15 }}
          >
            我的书架
          </h1>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={toggleTheme}
              className="rounded-full p-2.5"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              transition={springPress}
              style={{ color: 'var(--color-text)' }}
              aria-label={isDark ? '切换日间模式' : '切换暗夜模式'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </motion.button>
            <motion.label
            className="inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: 'var(--color-accent)' }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={springPress}
          >
            <Plus className="h-4 w-4" />
            导入书籍
            <input
              ref={fileInputRef}
              type="file"
              accept=".epub,.pdf,.txt"
              onChange={handleImport}
              className="hidden"
            />
          </motion.label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverChange}
            className="hidden"
          />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-[1800px] px-4 pt-6 pb-12">
        {loading ? (
          <div className="mt-20 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            加载中...
          </div>
        ) : books.length === 0 ? (
          <motion.div
            className="mt-24 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springDefault}
          >
            <div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
            >
              <BookOpen className="h-9 w-9" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
            <p className="text-base" style={{ color: 'var(--color-text-secondary)' }}>
              书架是空的，点击上方按钮导入你的第一本书
            </p>
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.04 } },
            }}
          >
            <AnimatePresence>
              {books.map((book) => {
                const isRemoving = removingIds.has(book.id)
                return (
                  <motion.div
                    key={book.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    transition={springDefault}
                    className="group relative cursor-pointer"
                    style={{ borderRadius: 'var(--radius-card)' }}
                    onClick={() => onOpenBook(book.id)}
                  >
                    <motion.div
                      className="overflow-hidden p-3"
                      style={{
                        background: 'var(--color-card)',
                        borderRadius: 'var(--radius-card)',
                        boxShadow: 'var(--shadow-card)',
                      }}
                      whileHover={{
                        y: -2,
                        boxShadow: 'var(--shadow-float)',
                        transition: springDefault,
                      }}
                      whileTap={{ scale: 0.97, transition: springPress }}
                    >
                      <div
                        className="relative aspect-[3/4] w-full overflow-hidden rounded-xl"
                        style={{ background: 'var(--color-page-bg)' }}
                      >
                        {book.coverData || book.coverUrl ? (
                          <img
                            src={book.coverData || book.coverUrl}
                            alt={book.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen
                              className="h-8 w-8"
                              style={{ color: 'var(--color-text-secondary)' }}
                            />
                          </div>
                        )}
                        <div className="absolute right-1.5 bottom-1.5 hidden gap-1 group-hover:flex">
                          <motion.button
                            className="rounded-full p-2"
                            style={{
                              background: 'var(--color-card)',
                              boxShadow: 'var(--shadow-float)',
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={springPress}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCoverId(book.id)
                              coverInputRef.current?.click()
                            }}
                            aria-label="编辑封面"
                          >
                            <ImageIcon className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                          </motion.button>
                          {book.coverData && (
                            <motion.button
                              className="rounded-full p-2"
                              style={{
                                background: 'var(--color-card)',
                                boxShadow: 'var(--shadow-float)',
                              }}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              transition={springPress}
                              onClick={(e) => {
                                e.stopPropagation()
                                resetCover(book.id)
                              }}
                              aria-label="重置封面"
                            >
                              <Undo2 className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                            </motion.button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {book.title}
                        </p>
                        <p
                          className="truncate text-xs"
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {book.author || '未知作者'}
                        </p>
                      </div>
                    </motion.div>
                    {/* 删除按钮 */}
                    <motion.button
                      className="absolute right-3 top-3 hidden rounded-full p-2 group-hover:flex items-center justify-center"
                      style={{
                        background: 'var(--color-card)',
                        boxShadow: 'var(--shadow-float)',
                      }}
                      initial={false}
                      animate={isRemoving ? { scale: 0.8, opacity: 0 } : { scale: 1, opacity: 1 }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      transition={springPop}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(book.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--color-danger)' }} />
                    </motion.button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  )
}
