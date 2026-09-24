/**
 * Chapterbound UI 检查台 —— 判据模块（唯一权威）
 *
 * 这里只做一件事：给定一个文档 + 一组安全区数值，判断界面上有没有「看不见所以点不到」
 * 的元素。所有规则都是从真实发生过的 bug 反推出来的，不是通用最佳实践：
 *
 *   I1  可交互元素必须完整落在「视口 − 安全区」内
 *       ← 书签取色气泡锚在按钮右缘，窄屏下左侧溢出 110px，3 个色块既看不见也点不到
 *   I2  元素必须「点得到」（命中测试命中它自己）
 *       ← 被弹层遮罩盖住、或落在屏幕外（elementFromPoint 对屏外坐标返回 null）
 *   I3  触屏下命中区 ≥44×44（Apple HIG）
 *       ← 关于面板的关闭按钮是 36×36
 *   I4  写了 `fixed inset-0` 的元素，实际矩形必须等于视口
 *       ← header 的 backdrop-filter 给后代的 fixed 重建了包含块，
 *          遮罩的 inset-0 解析成了 header 的尺寸（360×76），点正文关不掉气泡
 *
 * 三条**刻意**的设计选择，改之前先读理由：
 *
 * 1. 「可交互」= 语义选择器 ∪ cursor:pointer。React 用事件委托，从 DOM 里问不出
 *    「这个 div 有没有绑 onClick」，而本项目里最重要的两个控件恰好都不是标准元素
 *    （导入书籍是 <label>、书卡是 div onClick）。两者都显式写了 cursor-pointer，
 *    所以这条并集是真能命中的。代价：召回率依赖「凡可点的都带 cursor-pointer」这条约定。
 * 2. 被**模态**盖住的下层不算违规（正常弹层行为，报出来就是噪音）。但被**非模态**的东西
 *    盖住要报 —— 那才是可疑的遮挡。判定「模态」的方式是「覆盖者或其祖先面积 ≥ 视口 90%」。
 * 3. 面积 ≥ 视口 90% 的元素视为「背板」，豁免 I1（backdrop 本来就该铺进状态栏/手势条），
 *    但仍查 I2。代价：一个因为 bug 长到全屏的元素会被误判为背板而放过 —— 那种 bug 的形状
 *    是「肉眼可见地变大了」，本来就该由你的眼睛抓，不该由探针抓。
 */

export interface Insets {
  top: number
  bottom: number
  left: number
  right: number
}

export type RuleId = 'I1' | 'I2' | 'I3' | 'I4'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Violation {
  rule: RuleId
  /** 人类可读定位：'[关闭]' / '「导入书籍」' / '<div.card>' */
  label: string
  /** 具体数值，例如 '左越界 -110px' */
  detail: string
  box: Box
  /** I2：谁盖住了它 */
  occluder?: string
  /** 仅当「连下层一起审」打开：这条是正常的模态遮挡，不是 bug */
  underLayer?: boolean
}

export interface AuditOptions {
  insets: Insets
  /** 是否按触屏规则查 I3（桌面模式下 40px 图标是正常的，不该报） */
  touch: boolean
  /** 打开时连被模态盖住的下层也报出来（默认关：那是正常弹层行为） */
  includeUnderLayers: boolean
}

export interface AuditResult {
  violations: Violation[]
  stats: {
    viewport: { width: number; height: number }
    /** 纳入审计的可交互元素数量 */
    scanned: number
    /** 判定为背板的数量 */
    backdrops: number
    /** 因「正常模态遮挡」被跳过的数量 */
    occludedSkipped: number
    /** 等几何稳定实际花的时间 */
    settleMs: number
    /** 是否等超时了（超时说明还在动，结果可能不稳） */
    settleTimedOut: boolean
  }
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role="button"], [tabindex]'

/** 亚像素容差：calc() 和小数宽度会算出 0.3px 的「越界」，那是浮点不是 bug */
const EDGE_TOLERANCE = 0.5
/** 面积 ≥ 视口的这个比例 → 视为背板/全屏层 */
const BACKDROP_AREA_RATIO = 0.9
/** 面积 ≥ 视口的这个比例 → 命中测试取多点（大元素中心被盖住但边缘可点，仍算可点） */
const LARGE_AREA_RATIO = 0.25
/** Apple HIG 触屏最小命中区 */
const TOUCH_MIN = 44
/** 等几何稳定的上限 */
const SETTLE_TIMEOUT_MS = 1200
/** 连续多少帧几何不变才算稳定 */
const SETTLE_STABLE_FRAMES = 3

// ── 元素描述 ──────────────────────────────────────────────

/** 给违规条目一个人类能认出来的名字：优先 aria-label，其次文本，最后 tag+class */
export function describe(el: Element | null): string {
  if (!el) return '(视口外无元素)'
  const aria = el.getAttribute('aria-label')
  if (aria) return `[${aria}]`
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text) return `「${text.length > 18 ? `${text.slice(0, 18)}…` : text}」`
  const cls = (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('.')
  return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}>`
}

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

function areaOf(b: Box): number {
  return b.width * b.height
}

// ── 可见性 / 可审计性 ──────────────────────────────────────

/**
 * 元素是否「真的在那儿」。
 *
 * pointer-events:none 的元素必须排除 —— 不只是因为它点不到，更因为**命中测试会穿过它**，
 * 于是 I2 会把它判成「被下面的东西盖住」，产生纯误报。
 * 引导层的根就是 pointerEvents:'none'（OnboardingOverlay.tsx），正好踩这条。
 *
 * opacity 链检查是给动画兜底的：motion 的面板在入场途中 opacity≈0，此时量几何没有意义。
 */
function makeVisibilityTest(win: Window) {
  const opacityCache = new Map<Element, number>()

  const chainOpacity = (el: Element): number => {
    const cached = opacityCache.get(el)
    if (cached !== undefined) return cached
    const parent = el.parentElement
    const parentOpacity = parent ? chainOpacity(parent) : 1
    const own = Number.parseFloat(win.getComputedStyle(el).opacity)
    const value = parentOpacity * (Number.isFinite(own) ? own : 1)
    opacityCache.set(el, value)
    return value
  }

  return (el: Element): boolean => {
    const cs = win.getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return false
    if (cs.pointerEvents === 'none') return false
    if (chainOpacity(el) < 0.05) return false
    const b = boxOf(el)
    return b.width > 0 && b.height > 0
  }
}

// ── 收集可交互元素 ────────────────────────────────────────

function collectInteractive(doc: Document, win: Window, isVisible: (el: Element) => boolean): Element[] {
  const found = new Set<Element>()

  doc.querySelectorAll(INTERACTIVE_SELECTOR).forEach((el) => found.add(el))

  // cursor:pointer 补集 —— 抓 <label> / div onClick 这类非标准可交互元素（理由见文件头）
  //
  // ⚠️ 必须只取「pointer 子树的根」。cursor 是**继承属性**：一个 cursor:pointer 的元素，
  // 它所有后代算出来的 cursor 都是 pointer。不加这条限制，书卡里的每个 <p>、图标里的每个
  // <path>/<svg> 都会被当成可交互元素 —— 触屏模式下会刷出几十条假的 I3，一片红，
  // 工具立刻失去可信度。（这是本模块修过的第一个假阳性。）
  //
  // 判断「是不是继承来的」的办法就是看父元素：父元素已经是 pointer 说明它是继承的。
  // 卡本身（父元素是网格）仍会被收进来，卡里面的按钮靠语义选择器收进来，两边都不丢。
  doc.querySelectorAll('*').forEach((el) => {
    if (found.has(el)) return
    if (win.getComputedStyle(el).cursor !== 'pointer') return
    const parent = el.parentElement
    if (parent && win.getComputedStyle(parent).cursor === 'pointer') return
    found.add(el)
  })

  return [...found].filter(isVisible)
}

// ── 命中测试 ──────────────────────────────────────────────

/** 大元素取 5 点（中心 + 四角内缩），小元素只取中心 —— 手指点的就是中心 */
function probePoints(b: Box, multi: boolean): [number, number][] {
  const pts: [number, number][] = [[b.x + b.width / 2, b.y + b.height / 2]]
  if (multi) {
    const ix = b.width * 0.25
    const iy = b.height * 0.25
    pts.push(
      [b.x + ix, b.y + iy],
      [b.x + b.width - ix, b.y + iy],
      [b.x + ix, b.y + b.height - iy],
      [b.x + b.width - ix, b.y + b.height - iy],
    )
  }
  return pts
}

/** 命中该点的是不是「它自己或它的后代」 */
function hitsSelf(el: Element, x: number, y: number, doc: Document): { ok: boolean; top: Element | null } {
  const top = doc.elementFromPoint(x, y)
  if (!top) return { ok: false, top: null } // 坐标在视口外
  return { ok: top === el || el.contains(top), top }
}

/**
 * 覆盖者是不是「模态弹层」—— 即：盖住它是正常弹层行为，不是 bug。
 *
 * ⚠️ 判据必须是「覆盖者是 fixed 定位」，**不能**是「覆盖者有个铺满视口的祖先」。
 * 后者看起来更自然，但在这个应用里恒为真：任何元素往上走都会遇到 #root / body 这种
 * 铺满视口的容器，于是所有遮挡都被判成「正常模态」而跳过 —— I2 会静默失效，
 * 面板上干干净净，但一条遮挡都抓不到。（这是本模块修过的第一个假阴性。）
 *
 * fixed 是本应用里弹层的可靠特征：关于面板的遮罩/面板、取色遮罩、侧栏外层、图鉴浮层、
 * 引导层全是 fixed，而页面内容不是。
 *
 * 加 `!el.contains(audited)` 是防一种假模态：万一将来出现一个 fixed 的整页容器，
 * 它包含被审元素本身，那这种「遮挡」发生在同一个容器内部，属于可疑，要报。
 */
function isModalOccluder(start: Element | null, audited: Element, win: Window): boolean {
  let el: Element | null = start
  while (el && el !== win.document.documentElement) {
    if (win.getComputedStyle(el).position === 'fixed' && !el.contains(audited)) return true
    el = el.parentElement
  }
  return false
}

// ── 几何稳定 ──────────────────────────────────────────────

function geomSignature(doc: Document): string {
  let s = ''
  for (const el of doc.querySelectorAll(INTERACTIVE_SELECTOR)) {
    const r = el.getBoundingClientRect()
    s += `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)};`
  }
  return s
}

/**
 * 等几何稳定再量。
 *
 * 这一条是**防误报的主力**：motion 的弹层在入场动画途中元素还在移动/半透明，
 * 此时量出来的「越界」全是假的。motion 的弹簧是 rAF 驱动的，不在 document.getAnimations()
 * 里，所以只能靠「连续几帧矩形不变」来判断，不能靠动画 API。
 */
async function waitForSettled(doc: Document): Promise<{ ms: number; timedOut: boolean }> {
  const win = doc.defaultView
  if (!win) return { ms: 0, timedOut: false }
  const t0 = performance.now()
  const nextFrame = () => new Promise<void>((r) => win.requestAnimationFrame(() => r()))

  let prev = geomSignature(doc)
  let stable = 0
  let timedOut = false

  while (performance.now() - t0 < SETTLE_TIMEOUT_MS) {
    await nextFrame()
    const sig = geomSignature(doc)
    if (sig === prev) {
      stable += 1
      if (stable >= SETTLE_STABLE_FRAMES) break
    } else {
      prev = sig
      stable = 0
    }
  }
  if (stable < SETTLE_STABLE_FRAMES) timedOut = true

  return { ms: Math.round(performance.now() - t0), timedOut }
}

// ── 主入口 ────────────────────────────────────────────────

function overflowText(b: Box, vw: number, vh: number, insets: Insets): string {
  const parts: string[] = []
  const safeL = insets.left
  const safeT = insets.top
  const safeR = vw - insets.right
  const safeB = vh - insets.bottom
  if (b.x < safeL - EDGE_TOLERANCE) parts.push(`左越界 ${Math.round(b.x - safeL)}px`)
  if (b.y < safeT - EDGE_TOLERANCE) parts.push(`上越界 ${Math.round(b.y - safeT)}px`)
  const overR = b.x + b.width - safeR
  if (overR > EDGE_TOLERANCE) parts.push(`右越界 ${Math.round(overR)}px`)
  const overB = b.y + b.height - safeB
  if (overB > EDGE_TOLERANCE) parts.push(`下越界 ${Math.round(overB)}px`)
  return parts.join(' / ')
}

export async function audit(doc: Document, opts: AuditOptions): Promise<AuditResult> {
  const win = doc.defaultView
  if (!win) {
    throw new Error('audit: 文档没有 window（跨源 iframe？同源才能审）')
  }

  const settle = await waitForSettled(doc)

  const vw = win.innerWidth
  const vh = win.innerHeight
  const vpArea = vw * vh
  const isVisible = makeVisibilityTest(win)
  const violations: Violation[] = []

  let backdrops = 0
  let occludedSkipped = 0

  const els = collectInteractive(doc, win, isVisible)

  for (const el of els) {
    const box = boxOf(el)
    const isBackdrop = areaOf(box) >= BACKDROP_AREA_RATIO * vpArea
    if (isBackdrop) backdrops += 1

    // I1 越界（背板豁免：遮罩本来就该铺进状态栏）
    if (!isBackdrop) {
      const detail = overflowText(box, vw, vh, opts.insets)
      if (detail) {
        violations.push({ rule: 'I1', label: describe(el), detail, box })
      }
    }

    // I2 遮挡
    const multi = areaOf(box) >= LARGE_AREA_RATIO * vpArea
    let ok = false
    let firstOccluder: Element | null = null
    for (const [x, y] of probePoints(box, multi)) {
      const hit = hitsSelf(el, x, y, doc)
      if (hit.ok) {
        ok = true
        break
      }
      if (!firstOccluder) firstOccluder = hit.top
    }
    if (!ok) {
      const modal = isModalOccluder(firstOccluder, el, win)
      if (modal && !opts.includeUnderLayers) {
        // 正常模态遮挡：下层本来就不该能点，跳过（这是默认，避免刷屏）
        occludedSkipped += 1
        continue
      }
      violations.push({
        rule: 'I2',
        label: describe(el),
        detail: firstOccluder ? `被 ${describe(firstOccluder)} 盖住` : '中心点在视口外',
        box,
        occluder: firstOccluder ? describe(firstOccluder) : undefined,
        underLayer: modal || undefined,
      })
    }

    // I3 命中区（只在触屏模式下有意义）
    if (opts.touch && (box.width < TOUCH_MIN || box.height < TOUCH_MIN)) {
      violations.push({
        rule: 'I3',
        label: describe(el),
        detail: `${Math.round(box.width)}×${Math.round(box.height)} < ${TOUCH_MIN}×${TOUCH_MIN}`,
        box,
      })
    }
  }

  // I4 —— 扫全部元素，不只可交互元素（这个 bug 的载体是遮罩，不是按钮）
  doc.querySelectorAll('*').forEach((el) => {
    const cs = win.getComputedStyle(el)
    if (cs.position !== 'fixed') return
    // 只查「意在图铺满」的：四边都显式为 0。只写 top/left 的不算
    if (!(cs.top === '0px' && cs.right === '0px' && cs.bottom === '0px' && cs.left === '0px')) return
    if (cs.display === 'none' || cs.visibility === 'hidden') return
    const box = boxOf(el)
    if (box.width === 0 && box.height === 0) return
    if (Math.abs(box.width - vw) > EDGE_TOLERANCE || Math.abs(box.height - vh) > EDGE_TOLERANCE) {
      violations.push({
        rule: 'I4',
        label: describe(el),
        detail:
          `写了 fixed inset-0，实际 ${Math.round(box.width)}×${Math.round(box.height)}` +
          `，视口是 ${vw}×${vh}`,
        box,
      })
    }
  })

  return {
    violations,
    stats: {
      viewport: { width: vw, height: vh },
      scanned: els.length,
      backdrops,
      occludedSkipped,
      settleMs: settle.ms,
      settleTimedOut: settle.timedOut,
    },
  }
}
