import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LibraryPage } from './components/LibraryPage'
import { ReaderPage } from './components/ReaderPage'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { useOnboardingStore } from './stores/onboardingStore'
import { useBookshelfStore } from './stores/bookshelfStore'
import { registry } from './core/registry'
import { BookFormat, type CompendiumImportData } from './core/types'
import testCompendium from './data/test-compendium.json'

const springPage = { type: 'spring' as const, bounce: 0, duration: 0.35 }
const TEST_BOOK_ID = 'test-book-star-sand-town'

async function ensureTestData() {
  const storage = registry.getStorage()
  const existing = await storage.getBook(TEST_BOOK_ID)
  if (existing) return

  const resp = await fetch('./test-book.epub')
  const buffer = await resp.arrayBuffer()

  const parser = registry.getParser(BookFormat.EPUB)
  let title = '星砂镇'
  let author = 'AI 创作'
  if (parser) {
    try {
      const meta = await parser.getMetadata(buffer)
      title = meta.title || title
      author = meta.author || author
    } catch { /* use defaults */ }
  }

  await storage.saveFileData(TEST_BOOK_ID, buffer)
  await storage.saveBook({
    id: TEST_BOOK_ID,
    title,
    author,
    format: BookFormat.EPUB,
    fileSize: buffer.byteLength,
    fileName: '星砂镇.epub',
    fileDataKey: TEST_BOOK_ID,
    addedAt: Date.now(),
  })

  await storage.importCompendium(TEST_BOOK_ID, testCompendium as CompendiumImportData)

  // Refresh the bookshelf so the test book appears immediately
  await useBookshelfStore.getState().loadBooks()
}

export default function App() {
  const [readingBookId, setReadingBookId] = useState<string | null>(null)
  const dismissed = useOnboardingStore((s) => s.dismissedPermanently)
  const isActive = useOnboardingStore((s) => s.isActive)
  const pendingNav = useOnboardingStore((s) => s.pendingNavigation)
  const clearNav = useOnboardingStore((s) => s.clearNavigation)
  const startOnboarding = useOnboardingStore((s) => s.start)

  // Start onboarding on every launch unless user permanently dismissed
  useEffect(() => {
    if (!dismissed) {
      ensureTestData().then(() => {
        startOnboarding()
      }).catch(() => {})
    }
  }, [dismissed, startOnboarding])

  // Respond to cross-page navigation from onboarding
  useEffect(() => {
    if (pendingNav === 'reader' && !readingBookId) {
      setReadingBookId(TEST_BOOK_ID)
      clearNav()
    }
  }, [pendingNav, readingBookId, clearNav])

  return (
    <>
      <AnimatePresence mode="wait">
        {readingBookId ? (
          <motion.div
            key="reader"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={springPage}
          >
            <ReaderPage bookId={readingBookId} onBack={() => setReadingBookId(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="library"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03 }}
            transition={springPage}
          >
            <LibraryPage onOpenBook={setReadingBookId} />
          </motion.div>
        )}
      </AnimatePresence>

      {!dismissed && isActive && <OnboardingOverlay />}
    </>
  )
}
