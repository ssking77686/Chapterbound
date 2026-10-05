/**
 * Chapterbound UI 检查台 —— 手动镜像
 *
 * 用途：把「当前窗格」的界面状态复制到另一个窗格。对照两种设备时，你只需要在一侧点到
 * 目标界面，然后按一次镜像，另一侧跟着走到同一个界面。
 *
 * 为什么是**手动**而不是自动联动：自动联动的失配是**静默**的 —— 某一侧会因为找不到目标
 * 而停在别的界面，而你会以为两边在对照同一个界面。那比不同步更糟。手动镜像把同步变成
 * 一次显式动作：成功了你看得见，失配了立刻看得见，而且失配点会报出来。
 *
 * 做法是「重载 + 重放」而不是「把当前状态拷过去」：
 *   1. 记录源窗格里的每一次点击（捕获阶段，归一化到最近的可点元素）
 *   2. 镜像时重载目标窗格，再按顺序重放这些点击
 * 重载保证了确定性 —— 目标窗格从干净状态出发，重放同一串点击，落到同一个界面。
 * 两个窗格共享同一个源的 IndexedDB，所以书库和阅读进度天然一致，重放才有意义。
 */

export interface ClickRecord {
  /** aria-label —— 最稳的标识 */
  aria: string | null
  /** 归一化文本 —— 次选 */
  text: string | null
  /** 从 documentElement 起的孩子序号路径 —— 兜底（两窗格跑同一个应用，DOM 结构基本一致） */
  path: number[]
}

const normText = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim()

/**
 * 跨 realm 安全的「是不是元素」判定。
 *
 * ⚠️ **绝对不要**用 `x instanceof Element` / `instanceof HTMLElement` 判断 iframe 里的元素：
 * iframe 是**独立的 JavaScript realm**，有自己的一套内置构造函数 —— 同源也一样。
 * 从 iframe 里取出的元素永远不是父窗口 Element 的实例，判定恒为 false，而且**不报任何错**。
 *
 * 这是本模块修过的第一个跨 realm 假阴性：点击记录器的 `if (!(t instanceof Element)) return`
 * 因此每次都在静默提前返回，于是镜像和「跳过引导层」一起静默失效 —— 界面上看起来完全正常。
 * nodeType === 1 就是 Element 节点的定义值，跨 realm 安全。
 */
export const isElement = (n: unknown): n is Element =>
  !!n && typeof n === 'object' && (n as Node).nodeType === 1

/** 能不能点：是元素且带 click 方法（同样避开 instanceof） */
export const isClickable = (n: unknown): n is HTMLElement =>
  isElement(n) && typeof (n as HTMLElement).click === 'function'

/** 从 documentElement 到该元素的孩子序号路径 */
export function pathOf(el: Element): number[] {
  const path: number[] = []
  let cur: Element | null = el
  while (cur?.parentElement) {
    path.unshift(Array.prototype.indexOf.call(cur.parentElement.children, cur))
    cur = cur.parentElement
  }
  return path
}

export function byPath(doc: Document, path: number[]): Element | null {
  let cur: Element | null = doc.documentElement
  for (const i of path) {
    cur = cur?.children[i] ?? null
    if (!cur) return null
  }
  return cur
}

/**
 * 把点击目标归一化到「最近的可点元素」。
 * 直接记录 e.target 会记到 <svg>/<path> 上 —— 那种记录既难匹配也没意义。
 */
function nearestTargetable(el: Element): Element {
  const doc = el.ownerDocument
  const win = doc.defaultView
  let cur: Element | null = el
  while (cur && cur !== doc.documentElement) {
    if (cur.hasAttribute('aria-label')) return cur
    const tag = cur.tagName.toLowerCase()
    if (tag === 'button' || tag === 'a' || tag === 'label' || tag === 'input') return cur
    if (win && win.getComputedStyle(cur).cursor === 'pointer') return cur
    cur = cur.parentElement
  }
  return el
}

export function describeTarget(el: Element): ClickRecord {
  const t = nearestTargetable(el)
  return {
    aria: t.getAttribute('aria-label'),
    text: normText(t.textContent) || null,
    path: pathOf(t),
  }
}

/**
 * 在目标文档里找同一次点击的落点。
 * 顺序：aria-label（最稳）→ 文本（取最深的匹配，避免匹配到外层容器）→ 路径（兜底）。
 */
export function findTarget(doc: Document, rec: ClickRecord): Element | null {
  if (rec.aria) {
    const escaped = rec.aria.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const byAria = doc.querySelector(`[aria-label="${escaped}"]`)
    if (byAria) return byAria
  }

  if (rec.text) {
    let best: Element | null = null
    let bestDepth = -1
    for (const el of doc.querySelectorAll('*')) {
      if (normText(el.textContent) !== rec.text) continue
      let depth = 0
      let cur: Element | null = el
      while (cur?.parentElement) {
        depth += 1
        cur = cur.parentElement
      }
      if (depth > bestDepth) {
        best = el
        bestDepth = depth
      }
    }
    if (best) return best
  }

  return byPath(doc, rec.path)
}

/** 给一条记录一个人能读的标签（报失配用） */
export function labelOf(rec: ClickRecord): string {
  if (rec.aria) return `[${rec.aria}]`
  if (rec.text) return `「${rec.text.slice(0, 18)}」`
  return `路径 ${rec.path.join('>')}`
}

/**
 * 在文档上装一个捕获阶段的点击记录器。返回卸载函数。
 * 用捕获阶段是为了在应用自己的处理逻辑之前拿到事件（哪怕它 stopPropagation 也不影响记录）。
 */
export function attachRecorder(doc: Document, onRecord: (rec: ClickRecord) => void): () => void {
  const handler = (e: Event) => {
    const t = e.target
    if (!isElement(t)) return // 跨 realm 安全，见 isElement
    onRecord(describeTarget(t))
  }
  doc.addEventListener('click', handler, true)
  return () => doc.removeEventListener('click', handler, true)
}

/**
 * 界面的「可访问性指纹」：当前所有 aria-label 的集合。
 *
 * 用途是**在镜像之后验证两侧是不是真的到了同一个界面**。这一步不能省：
 * 重放是「按顺序点一串东西」，任何一步没生效都会让后面全部走偏，而重放本身
 * 不会报错 —— 不比对的话，镜像会变成一次静默的半成功，正是手动镜像最该防的失败。
 *
 * 只取 aria-label 的名字，不取位置/数值：两侧视口不同，几何必然不同，但界面结构应该一致。
 */
export function surfaceSignature(doc: Document): string[] {
  const names = new Set<string>()
  doc.querySelectorAll('[aria-label]').forEach((el) => {
    const v = el.getAttribute('aria-label')
    if (v) names.add(v)
  })
  return [...names].sort()
}

export function diffSignatures(a: string[], b: string[]): { onlyA: string[]; onlyB: string[] } {
  const setA = new Set(a)
  const setB = new Set(b)
  return {
    onlyA: a.filter((x) => !setB.has(x)),
    onlyB: b.filter((x) => !setA.has(x)),
  }
}
