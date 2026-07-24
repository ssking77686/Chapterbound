import type { BookFormat, ParsedBook, BookMetadata } from '../types'

export interface IBookParser {
  readonly format: BookFormat

  parse(data: ArrayBuffer): Promise<ParsedBook>
  getCover(data: ArrayBuffer): Promise<Blob | null>
  getMetadata(data: ArrayBuffer): Promise<BookMetadata>
}
