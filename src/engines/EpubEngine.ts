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

  async load(data: ArrayBuffer, container: HTMLElement, startLoc?: string): Promise<void> {
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
      start: { cfi: string; index: number; displayed: { page: number; total: number } }
      end: { cfi: string }
    }) => {
      const cfi = location.start.cfi
      const progress = this.computeProgress(cfi)
      const page = location.start.displayed.page
      const total = location.start.displayed.total
      console.log('[EpubEngine] relocated spineIndex:', location.start.index, 'page:', page, 'total:', total)
      this.emit('locationChange', cfi, progress, page, total, location.start.index)
    })

    this.rendition.on('selected', (cfiRange: string, contents: { window: { getSelection: () => Selection } }) => {
      const text = contents.window.getSelection()?.toString() ?? ''
      this.emit('selection', text, cfiRange)
    })

    await this.book.ready
    try {
      await this.rendition.display(startLoc)
    } catch {
      // 保存的 CFI 可能损坏，fallback 到首页
      await this.rendition.display()
    }
    this.emit('ready')

    this.book.locations.generate(150).catch(() => {
      // locations 生成失败不影响阅读
    })
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
    try {
      const loc = this.rendition?.currentLocation()
      return (loc as any)?.start?.cfi ?? ''
    } catch {
      return ''
    }
  }

  getProgress(): number {
    try {
      const loc = this.rendition?.currentLocation()
      const cfi = (loc as any)?.start?.cfi
      if (!cfi) return 0
      return this.computeProgress(cfi)
    } catch {
      return 0
    }
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

  applySettings(settings: { fontSize: number; fontFamily: string; lineHeight: number }): void {
    if (!this.rendition) return
    this.rendition.themes.fontSize(`${settings.fontSize}px`)
    if (settings.fontFamily) {
      this.rendition.themes.font(settings.fontFamily)
    }
    this.rendition.themes.override('line-height', String(settings.lineHeight))
  }

  getProgressForLocation(cfi: string): number {
    return this.computeProgress(cfi)
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

  async getChapterMap(): Promise<Map<number, number>> {
    const map = new Map<number, number>()
    if (!this.book) return map

    const toc = await this.getTOC()
    const spine = (this.book as any).spine
    let chapterNum = 0

    const walk = (items: TOCItem[]) => {
      for (const item of items) {
        let mapped = false
        try {
          const section = spine.get(item.href)
          if (section) {
            chapterNum++
            map.set(section.index, chapterNum)
            mapped = true
          }
        } catch {
          // 跳过无法解析的 TOC 条目
        }

        if (item.children && item.children.length > 0) {
          walk(item.children)
        } else if (!mapped) {
          // 叶子节点但无法映射到 spine，仍计为独立章节
          chapterNum++
        }
      }
    }

    walk(toc)
    return map
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
