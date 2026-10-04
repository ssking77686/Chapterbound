import Epub from 'epubjs'
import type Book from 'epubjs/types/book'
import type Rendition from 'epubjs/types/rendition'
import type { NavItem } from 'epubjs/types/navigation'
import type { IReaderEngine } from '../core/interfaces/IReaderEngine'
import { BookFormat, type TOCItem } from '../core/types'
import { detectTouch } from '../hooks/useIsTouch'

type EventCallback = (...args: unknown[]) => void

/** 深度优先找下一个节点（元素则下沉到首子节点），用于从 Range 起点向后收集文本 */
function nextTextNode(node: Node): Node | null {
  if (node.nodeType !== 3 && node.firstChild) return node.firstChild
  let cur: Node | null = node
  while (cur) {
    if (cur.nextSibling) return cur.nextSibling
    cur = cur.parentNode
  }
  return null
}

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'LI', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'TD', 'TH', 'TR', 'UL', 'OL', 'PRE', 'TABLE', 'BODY',
])

/** 向上找最近的块级容器（摘录跨块时补空格用；同一段落内的行内标签不算跨块） */
function closestBlockElement(node: Node | null): Element | null {
  let cur: Node | null = node
  while (cur) {
    if (cur.nodeType === 1) {
      const tag = (cur as Element).tagName?.toUpperCase()
      if (tag && BLOCK_TAGS.has(tag)) return cur as Element
    }
    cur = cur.parentNode
  }
  return null
}

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
  /** 重排后要钉回去的锚点（见 pinAfterResize） */
  private anchorAfterResize: string | null = null
  /** 书文件字节（位置接力码的指纹材料），load 时记下 */
  private fileData: ArrayBuffer | null = null
  /** 最近一次 relocated 的 spine index（位置卡片取章节标签用） */
  private lastSpineIndex = -1
  /** spine index → TOC 标签（位置卡片用，惰性构建、缓存） */
  private chapterLabelCache: Map<number, string> | null = null

  async load(data: ArrayBuffer, container: HTMLElement, startLoc?: string): Promise<void> {
    this.containerEl = container
    this.fileData = data
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
      this.lastSpineIndex = location.start.index
      const progress = this.computeProgress(cfi)
      const page = location.start.displayed.page
      const total = location.start.displayed.total
      // console.debug('[EpubEngine] relocated spineIndex:', location.start.index, 'page:', page, 'total:', total)
      this.emit('locationChange', cfi, progress, page, total, location.start.index)

      // 重排后的第一次 relocated：把位置钉回重排前那一刻（见 pinAfterResize）。
      // 只钉一次 —— 钉回去本身也会触发 relocated。
      if (this.anchorAfterResize) {
        const anchor = this.anchorAfterResize
        this.anchorAfterResize = null
        this.goToLocation(anchor)
      }
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
    this.anchorAfterResize = null
    this.fileData = null
    this.lastSpineIndex = -1
    this.chapterLabelCache = null
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

  /**
   * 重排视口。**必须带上当前位置的 cfi**。
   *
   * epub.js 重排后会自己重新定位：`rendition.onResized` 里是
   * `this.display(epubcfi || this.location.start.cfi)`（rendition.js:478）——
   * 给它 cfi 就用它，不给就用它自己缓存的位置。而重排之后"第 N 页"对应的文字已经变了，
   * 所以锚点必须由调用方给，否则阅读位置会漂（实测：只把视口高改 40px，从第 5 页跳到第 2 页）。
   *
   * 转屏 / 分屏 / 软键盘弹出 / 沉浸模式走的都是这一条路，锚点在这里统一处理。
   *
   * 第三个参数 epub.js 支持，但 v0.3.93 的 d.ts 只声明了两个（types/rendition.d.ts:123）
   * —— 又一次类型缺口，用一次断言绕开。
   * ⚠️ 光带 cfi 还不够，必须配套调 pinAfterResize —— 见那个方法的注释。
   */
  resize(width: number, height: number, cfi?: string): void {
    const r = this.rendition
    if (!r) return
    ;(r.resize as unknown as (w: number, h: number, c?: string) => void)(width, height, cfi)
  }

  /**
   * 重排后把阅读位置钉回 cfi。
   *
   * 为什么必须单独做这一步：epub.js 在 resize 内部**本来就会**重新定位 ——
   * `rendition.onResized` 里是 `this.display(epubcfi || this.location.start.cfi)`
   * （rendition.js:478），而 manager.resize 也接受并转发了这个 cfi。但实测它落不到那个位置：
   * 锚点 `epubcfi(/6/2!/4/26/1:0)`、重排后落在 `epubcfi(/6/2!/4/8/1:0)`，退了 18 个段落
   *（同时读过 epub.js 自己的缓存，值和锚点一致 —— 它知道该去哪，就是没去到）。
   * 所以改成：重排产出的第一次 relocated 之后，由我们显式再 display 一次。
   * `goToLocation` 就是书签跳转一直在走的路径，行为可靠。
   *
   * 转屏 / 分屏 / 软键盘 / 沉浸模式都经由 resize，所以锚点统一在这里兜。
   */
  pinAfterResize(cfi: string): void {
    if (cfi) this.anchorAfterResize = cfi
  }

  // ── 位置接力（位置卡片 / 短码）：生成端与接收端共用 ──

  /** 书文件字节数（位置码指纹材料） */
  getFileSize(): number {
    return this.fileData?.byteLength ?? 0
  }

  /** 书文件开头切片（位置码指纹材料；指纹只吃前 64KB） */
  getFileHead(maxBytes = 65536): Uint8Array {
    if (!this.fileData) return new Uint8Array(0)
    return new Uint8Array(this.fileData, 0, Math.min(maxBytes, this.fileData.byteLength))
  }

  /** epub.js 定位点是否已生成（未生成时百分比 / 位置号都不可用） */
  isLocationsReady(): boolean {
    try {
      return !!this.book && this.book.locations.length() > 0
    } catch {
      return false
    }
  }

  /**
   * 当前位置的百分比（0~1，精确比值）。
   * 注意与 computeProgress 的区别：那个是"尽力而为"的整数进度，这个是位置接力用的。
   */
  getCurrentPercent(): number {
    try {
      const cfi = this.getCurrentLocation()
      if (!cfi || !this.book || this.book.locations.length() === 0) return 0
      const ratio = this.book.locations.percentageFromCfi(cfi)
      return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
    } catch {
      return 0
    }
  }

  /** 当前位置的定位点序号（位置码载荷），拿不到返回 -1 */
  getCurrentLocationIndex(): number {
    try {
      const cfi = this.getCurrentLocation()
      if (!cfi || !this.book || this.book.locations.length() === 0) return -1
      const idx = this.book.locations.locationFromCfi(cfi)
      return typeof idx === 'number' && Number.isFinite(idx) ? idx : -1
    } catch {
      return -1
    }
  }

  /** 最近一次 relocated 的 spine index（位置卡片的章节号回退用） */
  getCurrentSpineIndex(): number {
    return this.lastSpineIndex
  }

  /** 定位点序号的百分比（0~1，短码跳转后的落点提示用；与 percentageFromCfi 同一口径） */
  getPercentForIndex(index: number): number {
    try {
      const n = this.book?.locations.length() ?? 0
      if (n <= 1) return 0
      return Math.min(1, Math.max(0, index / (n - 1)))
    } catch {
      return 0
    }
  }

  /**
   * 按百分比跳转（位置码的降级路径）。
   * 返回"是否真的发起了跳转"：定位点未就绪等情况返回 false，由调用方报错——
   * 位置接力里不许出现"面板关了、提示说已跳到，但其实什么都没发生"。
   */
  goToPercentage(p: number): boolean {
    if (!this.book || !this.rendition || this.book.locations.length() === 0) return false
    const clamped = Math.min(1, Math.max(0, p))
    try {
      const cfi = this.book.locations.cfiFromPercentage(clamped)
      if (cfi && typeof cfi === 'string') {
        this.rendition.display(cfi)
        return true
      }
    } catch {
      /* 定位点未就绪等情况 */
    }
    return false
  }

  /**
   * 按定位点序号跳转（短码路径）。返回是否真的发起了跳转（语义同上）。
   * 落点 = 该定位点起点 —— 定位点按书文本内容生成、与排版无关，
   * 同一个书文件在两台设备上序号↔文本完全一致，所以短码跨设备才成立。
   */
  goToLocationIndex(index: number): boolean {
    if (!this.book || !this.rendition) return false
    const n = this.book.locations.length()
    if (n <= 0) return false
    const i = Math.min(n - 1, Math.max(0, Math.round(index)))
    try {
      const cfi = this.book.locations.cfiFromLocation(i)
      if (cfi && typeof cfi === 'string') {
        this.rendition.display(cfi)
        return true
      }
    } catch {
      /* 同上 */
    }
    return false
  }

  /**
   * 位置接力专用：跳转前先验证 CFI 能解析、且确实指向本书内的 section。
   * 手抄 / 篡改的坐标不该"点了没反应"——无效返回 false，由调用方报错。
   * （书签 / 目录走的是 goToLocation，坐标可信，不改那条路。）
   */
  goToRelayCfi(cfi: string): boolean {
    if (!this.book || !this.rendition) return false
    try {
      const section = (this.book as any).spine.get(cfi)
      if (!section) return false
      this.rendition.display(cfi)
      return true
    } catch {
      return false
    }
  }

  /** 位置卡片里的"附近原文摘录"：从当前 cfi 起点向后收集一小段正文（取不到就不放摘录行） */
  getNearbyText(maxLen = 50): string {
    try {
      const cfi = this.getCurrentLocation()
      if (!cfi || !this.rendition) return ''
      const range = (this.rendition as unknown as {
        getRange?: (c: string) => Range | undefined
      }).getRange?.(cfi)
      if (!range) return ''
      let text = ''
      let node: Node | null = range.startContainer
      let offset = range.startOffset
      let lastBlock: Element | null = null
      while (node && text.length < maxLen) {
        if (node.nodeType === 3) {
          // 跨块补空格：标题/段落之间直接拼接会黏成"第一章 抵达夜幕低垂时"；
          // 同一段落内的行内标签（em/strong…）块容器不变，不会误插空格。
          const block = closestBlockElement(node.parentNode)
          if (lastBlock && block && block !== lastBlock && text.length > 0 && !/\s$/.test(text)) {
            text += ' '
          }
          if (block) lastBlock = block
          text += (node.textContent ?? '').slice(offset)
        }
        offset = 0
        node = nextTextNode(node)
      }
      return text.replace(/\s+/g, ' ').trim().slice(0, maxLen)
    } catch {
      return ''
    }
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

  /**
   * 位置卡片用：spine index 处最近的一个 TOC 标签（含之前的锚点）。
   * 单独一份缓存与 walk，**不动 getChapterMap**（图鉴解锁的编号语义零变化）。
   */
  async getChapterLabelForSpine(spineIndex: number): Promise<string | null> {
    if (!this.book || spineIndex < 0) return null
    if (!this.chapterLabelCache) {
      const map = new Map<number, string>()
      const toc = await this.getTOC()
      const spine = (this.book as any).spine
      const walk = (items: TOCItem[]) => {
        for (const item of items) {
          try {
            const section = spine.get(item.href)
            if (section) map.set(section.index, item.label)
          } catch {
            // 跳过无法解析的 TOC 条目
          }
          if (item.children?.length) walk(item.children)
        }
      }
      walk(toc)
      this.chapterLabelCache = map
    }
    let best = -1
    let label: string | null = null
    this.chapterLabelCache.forEach((l, i) => {
      if (i <= spineIndex && i > best) {
        best = i
        label = l
      }
    })
    return label
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
