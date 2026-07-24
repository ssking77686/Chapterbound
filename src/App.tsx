import { useState } from 'react'
import { LibraryPage } from './components/LibraryPage'
import { ReaderPage } from './components/ReaderPage'

export default function App() {
  const [readingBookId, setReadingBookId] = useState<string | null>(null)

  if (readingBookId) {
    return (
      <ReaderPage
        bookId={readingBookId}
        onBack={() => setReadingBookId(null)}
      />
    )
  }

  return <LibraryPage onOpenBook={setReadingBookId} />
}
