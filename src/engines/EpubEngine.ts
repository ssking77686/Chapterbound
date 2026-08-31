import Epub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'
import type { IReaderEngine } from '../core/interfaces/IReaderEngine'
import { BookFormat, type TOCItem } from '../core/types'
import { detectTouch } from '../hooks/useIsTouch'

type EventCallback = (...args: unknown[]) => void

export class EpubEngine implements IReaderEngine {
  readonly format = BookFormat.EPUB
  readonly name = 'EPUB Engine'

  private book: Book | null = null
  private rendition: Rendition | null = null
  private containerEl: HTMLElement | null = null
  private listeners = new Map<string, Set<EventCallback>>()
  // 触屏手势：已绑定手势的 contents（epub.js 跨 section 重建 iframe，须防重复绑定）
  private gestureBoundContents = new Set<object>()
  private touchStart: { x: number; y: number; t: number } | null = null

  async load(data: ArrayBuffer, container: HTMLElement, startLoc?: string): Promise<void> {
    this.containerEl = container
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
      // console.debug('[EpubEngine] relocated spineIndex:', location.start.index, 'page:', page, 'total:', total)
      this.emit('locationChange', cfi, progress, page, total, location.start.index)
    })

    this.rendition.on('selected', (cfiRange: string, contents: { window: { getSelection: () => Selection } }) => {
      const selection = contents.window.getSelection()
      const text = selection?.toString() ?? ''
      let selX = 0, selY = 0
      try {
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          const iframe = this.containerEl?.querySelector('iframe')
          if (iframe && rect.width > 0) {
            const iframeRect = iframe.getBoundingClientRect()
            selX = rect.left + iframeRect.left + rect.width / 2
            selY = rect.top + iframeRect.top
          }
        }
      } catch { /* 选区坐标获取失败不影响选字功能 */ }
      this.emit('selection', text, cfiRange, selX, selY)
    })

    // 触屏手势（B 类：仅触屏设备注册，桌面端行为零变化）
    // iframe 内 touch 事件不冒泡，epub.js Contents 以事件名转发到 contents.on（DOM_EVENTS 含 touch 三件套）。
    // default manager 无 tap 处理，手势无冲突；跨 section 翻页重建 iframe 后由 'rendered' 重新绑定。
    if (detectTouch()) {
      this.rendition.on('rendered', (_section: unknown, view: { contents?: unknown }) => {
        if (view?.contents) this.bindGestures(view.contents)
      })
    }

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
    this.containerEl = null
    this.listeners.clear()
    this.gestureBoundContents.clear()
    this.touchStart = null
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

  setColumnMode(mode: 'auto' | 'single'): void {
    this.rendition?.spread(mode === 'single' ? 'none' : 'auto')
  }

  setPageColors(colors: { background: string; text: string }): void {
    if (!this.rendition) return
    this.rendition.themes.override('color', colors.text)
    this.rendition.themes.override('background', colors.background)
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

  /**
   * 触屏手势：swipe（翻页）与 tap（点按翻页/呼出工具栏）。
   * 事件对象为 iframe 内原始 DOM 事件（Contents 转发）。手势状态机只记录起点，
   * touchmove 不主动 preventDefault —— touch-action: pan-y 已声明横向手势归 JS。
   */
  private bindGestures(contents: unknown): void {
    const c = contents as { document: Document; on: (ev: string, cb: (e: TouchEvent) => void) => void }
    if (this.gestureBoundContents.has(c)) return
    this.gestureBoundContents.add(c)

    // 纵向滚动保留给系统，横向滑动手势交由 JS 判定
    try {
      if (!c.document.head.querySelector('[data-epub-gesture]')) {
        const style = c.document.createElement('style')
        style.setAttribute('data-epub-gesture', '')
        style.textContent = 'html, body { touch-action: pan-y; overscroll-behavior: none; }'
        c.document.head.appendChild(style)
      }
    } catch { /* iframe 文档未就绪时跳过注入，不影响手势 */ }

    c.on('touchstart', (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      this.touchStart = { x: t.clientX, y: t.clientY, t: Date.now() }
    })

    c.on('touchend', (e: TouchEvent) => {
      const start = this.touchStart
      this.touchStart = null
      if (!start) return
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const dt = Date.now() - start.t

      // swipe：横向位移 ≥60px、横向显著大于纵向、时长 ≤600ms
      if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 2 && dt <= 600) {
        this.emit('gesture:swipe', dx > 0 ? 'right' : 'left')
        return
      }

      // tap：时长 ≤350ms、位移 ≤10px；长按选词保护 —— 选区非空时抑制
      if (dt <= 350 && Math.abs(dx) <= 10 && Math.abs(dy) <= 10) {
        try {
          const selected = c.document.getSelection()?.toString() ?? ''
          if (selected.trim().length > 0) return
        } catch { /* 选区读取失败仍按 tap 处理 */ }
        const width = c.document.documentElement.clientWidth || 1
        this.emit('gesture:tap', { xRatio: t.clientX / width })
      }
    })
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
