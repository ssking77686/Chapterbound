import type { BookFormat, TOCItem } from '../types'

export interface IReaderEngine {
  readonly format: BookFormat
  readonly name: string

  load(data: ArrayBuffer, container: HTMLElement): Promise<void>
  destroy(): void

  nextPage(): void
  prevPage(): void
  goToLocation(loc: string): void
  getCurrentLocation(): string
  getProgress(): number

  getTOC(): Promise<TOCItem[]>
  getCover(): Promise<Blob | null>

  on(event: 'locationChange', cb: (loc: string, progress: number) => void): void
  on(event: 'selection', cb: (text: string, cfiRange: string) => void): void
  on(event: 'ready', cb: () => void): void
  off(event: string, cb: (...args: unknown[]) => void): void

  addHighlight(cfiRange: string, color: string): void
  removeHighlight(cfiRange: string): void
}
