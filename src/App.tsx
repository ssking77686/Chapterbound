import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LibraryPage } from './components/LibraryPage'
import { ReaderPage } from './components/ReaderPage'

const springPage = { type: 'spring' as const, bounce: 0, duration: 0.35 }

export default function App() {
  const [readingBookId, setReadingBookId] = useState<string | null>(null)

  return (
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
  )
}
