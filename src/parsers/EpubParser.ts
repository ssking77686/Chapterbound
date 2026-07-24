import Epub from 'epubjs'
import type { IBookParser } from '../core/interfaces/IBookParser'
import type { ParsedBook, BookMetadata } from '../core/types'
import { BookFormat } from '../core/types'

export class EpubParser implements IBookParser {
  readonly format = BookFormat.EPUB

  async parse(data: ArrayBuffer): Promise<ParsedBook> {
    const book = Epub(data)
    await book.ready

    const [metadata, cover] = await Promise.all([
      book.loaded.metadata,
      this.extractCover(book),
    ])

    return {
      metadata: {
        title: metadata?.title ?? 'Untitled',
        author: (metadata as any)?.creator ?? 'Unknown Author',
        format: BookFormat.EPUB,
        cover,
        language: metadata?.language,
        publisher: (metadata as any)?.publisher,
        description: (metadata as any)?.description,
      },
      content: data,
    }
  }

  async getCover(data: ArrayBuffer): Promise<Blob | null> {
    try {
      const book = Epub(data)
      await book.ready
      return await this.extractCover(book)
    } catch {
      return null
    }
  }

  async getMetadata(data: ArrayBuffer): Promise<BookMetadata> {
    const result = await this.parse(data)
    return result.metadata
  }

  private async extractCover(book: ReturnType<typeof Epub>): Promise<Blob | null> {
    try {
      const coverUrl = await book.loaded.cover
      if (!coverUrl) return null
      const response = await fetch(coverUrl)
      if (!response.ok) return null
      return await response.blob()
    } catch {
      return null
    }
  }
}
