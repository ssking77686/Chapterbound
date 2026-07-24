import Epub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'
import type { IReaderEngine } from '../core/interfaces/IReaderEngine'
import { BookFormat, type TOCItem } from '../core/types'

type EventCallback = (...args: unknown[]) => void

export class EpubEngine implements IReaderEngine {
  readonly format = BookFormat.EPUB
  readonly name = 'EPUB Engine'

  private book: Book | null = null
  private rendition: Rendition | null = null
  private listeners = new Map<string, Set<EventCallback>>()

  async load(data: ArrayBuffer, container: HTMLElement): Promise<void> {
    this.book = Epub(data) as Book

    const rect = container.getBoundingClientRect()
    this.rendition = this.book.renderTo(container, {
      width: rect.width || 800,
      height: rect.height || 600,
      spread: 'auto',
      flow: 'paginated',
      allowScriptedContent: true,
    })

    this.rendition.on('relocated', (location: {
      start: { cfi: string; displayed: { page: number; total: number } }
      end: { cfi: string }
    }) => {
      const cfi = location.start.cfi
      const progress = this.computeProgress(cfi)
      const page = location.start.displayed.page
      const total = location.start.displayed.total
      this.emit('locationChange', cfi, progress, page, total)
    })

    this.rendition.on('selected', (cfiRange: string, contents: { window: { getSelection: () => Selection } }) => {
      const text = contents.window.getSelection()?.toString() ?? ''
      this.emit('selection', text, cfiRange)
    })

    await this.book.ready
    await this.rendition.display()
    this.emit('ready')
  }

  destroy(): void {
    this.rendition?.destroy()
    this.book?.destroy()
    this.book = null
    this.rendition = null
    this.listeners.clear()
  }

  nextPage(): void {
    this.rendition?.next()
  }

  prevPage(): void {
    this.rendition?.prev()
  }

  goToLocation(loc: string): void {
    this.rendition?.display(loc)
  }

  getCurrentLocation(): string {
    const loc = this.rendition?.currentLocation()
    return (loc as any)?.cfi ?? ''
  }

  getProgress(): number {
    const loc = this.rendition?.currentLocation()
    const cfi = (loc as any)?.cfi
    if (!cfi) return 0
    return this.computeProgress(cfi)
  }

  async getTOC(): Promise<TOCItem[]> {
    if (!this.book) return []
    const nav = await this.book.loaded.navigation
    return (nav?.toc ?? []).map((item: NavItem) => this.mapNavItem(item, 0))
  }

  async getCover(): Promise<Blob | null> {
    if (!this.book) return null
    try {
      const coverUrl = await this.book.loaded.cover
      if (!coverUrl) return null
      const response = await fetch(coverUrl)
      if (!response.ok) return null
      return await response.blob()
    } catch {
      return null
    }
  }

  on(event: string, cb: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(cb)
  }

  off(event: string, cb: EventCallback): void {
    this.listeners.get(event)?.delete(cb)
  }

  addHighlight(cfiRange: string, color: string): void {
    this.rendition?.annotations.add(
      'highlight',
      cfiRange,
      {},
      undefined,
      undefined,
      { fill: color },
    )
  }

  removeHighlight(cfiRange: string): void {
    this.rendition?.annotations.remove(cfiRange, 'highlight')
  }

  setTheme(theme: 'light' | 'dark'): void {
    if (!this.rendition) return
    if (theme === 'dark') {
      this.rendition.themes.override('color', '#F5EFE6')
      this.rendition.themes.override('background', '#2B2420')
    } else {
      this.rendition.themes.override('color', '#3C3226')
      this.rendition.themes.override('background', '#FDFBF7')
    }
  }

  resize(width: number, height: number): void {
    this.rendition?.resize(width, height)
  }

  // ── private ──

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args))
  }

  private computeProgress(cfi: string): number {
    if (!this.book) return 0
    try {
      const ratio = this.book.locations.percentageFromCfi(cfi)
      return Math.round(ratio * 100)
    } catch {
      return 0
    }
  }

  private mapNavItem(item: NavItem, depth: number): TOCItem {
    return {
      label: item.label,
      href: item.href,
      level: depth,
      children: item.subitems?.map((child) => this.mapNavItem(child, depth + 1)),
    }
  }
}
