import { useCallback, useEffect, useRef, useState } from 'react'
import { audit, waitForSettled, type AuditResult, type Insets, type RuleId, type Violation } from './audit'
import {
  INSET_PRESETS,
  INSET_KEYS,
  VIEWPORTS,
  insetsEqual,
  ratioLabel,
  type InsetKey,
} from './viewports'
import {
  attachRecorder,
  diffSignatures,
  findTarget,
  isClickable,
  labelOf,
  surfaceSignature,
  type ClickRecord,
} from './mirror'
import {
  applyOnboardingPolicy,
  markSeededIfBookPresent,
  setSuppressPreference,
  suppressPreference,
} from './onboarding-policy'
import './console.css'

/* ── 已知缺陷登记处 ──────────────────────────────────────────
 *
 * 已知未修的问题**不占警报通道**：面板上单列一块，不计入违规数。
 * 修好之后判据自然通过，它自己消失。
 *
 * ⚠️ 匹配条件目前只按规则号（任何 I4 违规都归到这里）。今天只有一个 I4 问题所以成立；
 *    如果将来出现**另一个** fixed-inset-0 尺寸错误，它会和这条混在一起 ——
 *    届时要把 test() 写细（例如按祖先链或 box 尺寸区分）。
 */
interface KnownDefect {
  id: string
  rule: RuleId
  test: (v: Violation) => boolean
  title: string
  cause: string
  fix: string
}

const KNOWN_DEFECTS: KnownDefect[] = [
  {
    id: 'reader-scrim-containing-block',
    rule: 'I4',
    test: (v) => v.rule === 'I4',
    title: '阅读器取色气泡的遮罩只有 header 那么大',
    cause:
      'header 的 backdrop-filter 给后代的 fixed 元素重建了包含块，于是遮罩的 inset-0 解析成 header 的尺寸而不是视口。后果：点书页正文关不掉气泡，只能靠右上角 X 或点工具栏。',
    fix: '把 backdrop-filter 从 header 挪到一个内层背景 div（absolute inset-0 -z-10 pointer-events-none），header 自身保留半透明底色。层级关系不用动。',
  },
]

const RULE_COLOR: Record<RuleId, string> = {
  I1: 'var(--c-i1)',
  I2: 'var(--c-i2)',
  I3: 'var(--c-i3)',
  I4: 'var(--c-i4)',
}

const RULE_NAME: Record<RuleId, string> = {
  I1: '在安全区内',
  I2: '点得到',
  I3: '命中区 ≥44',
  I4: 'fixed 铺满视口',
}

type TouchMode = 'auto' | 'on' | 'off'

/* ── 窗格 ─────────────────────────────────────────────────── */

const PANE_IDS = ['A', 'B'] as const
type PaneId = (typeof PANE_IDS)[number]

interface PaneState {
  width: number
  height: number
  presetId: string | null
  insets: Insets
}

const DEFAULT_PANES: Record<PaneId, PaneState> = {
  A: { width: 412, height: 915, presetId: 'phone-l', insets: INSET_PRESETS[1].insets },
  // B 默认给平板 —— 双窗最常见的对照就是「手机 vs 平板」
  B: { width: 768, height: 1024, presetId: 'pad-p', insets: INSET_PRESETS[0].insets },
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 轮询等某一步的目标出现。
 *
 * 不用固定延时的理由：重放一步会让应用切到下一个界面，下一步的目标要等那个界面挂载完
 * 才存在。固定值要么太短（把「还没渲染出来」误报成「失配」）、要么太长（每一步都白等）。
 * 找不到就返回 null，由调用方报出「第几步失配」。
 */
async function waitForTarget(doc: Document, rec: ClickRecord, timeoutMs = 5000): Promise<Element | null> {
  const t0 = performance.now()
  for (;;) {
    const el = findTarget(doc, rec)
    if (isClickable(el)) return el
    if (performance.now() - t0 > timeoutMs) return null
    await sleep(200)
  }
}

/* ── iframe 内文档的操作 ────────────────────────────────────── */

function readFrameTouch(doc: Document): boolean {
  return doc.documentElement.getAttribute('data-touch') === '1'
}

/**
 * 注入安全区，模拟 MainActivity.injectSafeArea() 的行为。
 *
 * inject=false 时**必须连标记一起摘掉** —— 标记的语义是「四个值都已注入」，
 * 只删变量不删标记会让 CSS 保底永久失效（那正是历史 bug 的形状）。
 */
function applyInsets(doc: Document, insets: Insets, inject: boolean) {
  const root = doc.documentElement
  if (!inject) {
    for (const k of ['top', 'bottom', 'left', 'right']) root.style.removeProperty(`--safe-${k}`)
    root.removeAttribute('data-safe-top-injected')
    return
  }
  root.style.setProperty('--safe-top', `${insets.top}px`)
  root.style.setProperty('--safe-bottom', `${insets.bottom}px`)
  root.style.setProperty('--safe-left', `${insets.left}px`)
  root.style.setProperty('--safe-right', `${insets.right}px`)
  root.setAttribute('data-safe-top-injected', '1')
}

/** 等应用真正渲染出内容（initializeApp 是异步的，iframe 的 load 早于它） */
async function waitForApp(doc: Document | null, timeoutMs = 10000): Promise<boolean> {
  if (!doc) return false
  const t0 = performance.now()
  while (performance.now() - t0 < timeoutMs) {
    if (doc.querySelector('#root')?.firstElementChild) return true
    await sleep(120)
  }
  return false
}

/* ── 主组件 ───────────────────────────────────────────────── */

export function ConsoleApp() {
  const stageRef = useRef<HTMLDivElement>(null)
  /** 量可用空间要量这一层，不是 .stage。
      .stage 会滚动，而**滚动条的出现/消失只改 clientWidth、不改元素的边框盒** ——
      ResizeObserver 观察的是边框盒，所以它不会为滚动条的变化再触发一次回调。
      用它当基准会卡在「带着滚动条」的那个尺寸上不动（实测首屏宽度永久少 21px）。
      .stage-wrap 不滚动，尺寸是稳定的。 */
  const stageWrapRef = useRef<HTMLDivElement>(null)
  const iframeA = useRef<HTMLIFrameElement>(null)
  const iframeB = useRef<HTMLIFrameElement>(null)
  const outerA = useRef<HTMLDivElement>(null)
  const outerB = useRef<HTMLDivElement>(null)
  const iframeRef = useCallback((id: PaneId) => (id === 'A' ? iframeA : iframeB), [])
  const outerRef = useCallback((id: PaneId) => (id === 'A' ? outerA : outerB), [])

  const [dual, setDual] = useState(false)
  const [active, setActive] = useState<PaneId>('A')
  const [panes, setPanes] = useState<Record<PaneId, PaneState>>(DEFAULT_PANES)
  const [injectNative, setInjectNative] = useState(true)

  // 共享参数：触屏模式与缩放**不能**按窗格分开 —— 触屏存在 localStorage 里，
  // 同源的两个窗格共享同一份；硬要分开就得直接注 data-touch，那会重新制造
  // 「JS 和 CSS 各说各话」这个我们刚消掉的问题。缩放共享则是因为一个舞台上
  // 两个不同缩放比例的框没法做视觉对照。
  const [touchMode, setTouchMode] = useState<TouchMode>('auto')
  const [scale, setScale] = useState(1)

  const [includeUnderLayers, setIncludeUnderLayers] = useState(false)
  const [results, setResults] = useState<Partial<Record<PaneId, AuditResult>>>({})
  const [auditing, setAuditing] = useState(false)
  const [frameTouch, setFrameTouch] = useState(false)
  const [ready, setReady] = useState<Record<PaneId, boolean>>({ A: false, B: false })
  const [status, setStatus] = useState('等待应用载入…')
  const [flash, setFlash] = useState<{ pane: PaneId; idx: number } | null>(null)
  const [clickCounts, setClickCounts] = useState<Record<PaneId, number>>({ A: 0, B: 0 })

  // 自动缩放：跟随舞台尺寸重算。手动按过 100%/50%/适应 就关掉，免得跟你抢。
  const [autoFit, setAutoFit] = useState(true)
  // 自动缩放的策略（两者是固有取舍，只能二选一）：
  //   fit   按高度和宽度里更紧的那一边 —— 整台设备完整可见，竖屏手机在横屏窗口里左右留白
  //   width 只按宽度 —— 左右贴边，代价是上下被裁、要滚动
  const [fillMode, setFillMode] = useState<'fit' | 'width'>(() =>
    localStorage.getItem('console.fill-mode') === 'width' ? 'width' : 'fit',
  )

  useEffect(() => {
    localStorage.setItem('console.fill-mode', fillMode)
  }, [fillMode])
  // 结果区：默认收起（它占版面），但**查出违规会自动展开** —— 否则检查完看不到是哪几条
  const [resultsCollapsed, setResultsCollapsed] = useState(true)
  const [sideCollapsed, setSideCollapsed] = useState(
    () => localStorage.getItem('console.side-collapsed') === '1',
  )
  const [suppressOnboarding, setSuppressOnboarding] = useState(suppressPreference)

  useEffect(() => {
    setSuppressPreference(suppressOnboarding)
  }, [suppressOnboarding])

  useEffect(() => {
    localStorage.setItem('console.side-collapsed', sideCollapsed ? '1' : '0')
  }, [sideCollapsed])

  /** 缩放上限。允许放大是必要的 —— 压在 1.0 的话，大屏上永远只能看到 412px 宽的手机。
      放大只改变观感（浏览器会把画面重采样，会略糊），**不改变布局**：
      媒体查询看的是 iframe 的 CSS 尺寸，审计也在那个坐标里量，所以放大不影响任何结论。 */
  const MAX_SCALE = 3

  // 点击记录（镜像用）。每个窗格一份，重载时清空 —— 因为重载后应用回到了初始状态，
  // 旧记录不再对应任何东西。
  const clickLog = useRef<Record<PaneId, ClickRecord[]>>({ A: [], B: [] })
  const attachedDoc = useRef<Record<PaneId, Document | null>>({ A: null, B: null })
  const recorderCleanup = useRef<Record<PaneId, (() => void) | null>>({ A: null, B: null })

  const visiblePanes: PaneId[] = dual ? ['A', 'B'] : ['A']
  const other = (id: PaneId): PaneId => (id === 'A' ? 'B' : 'A')

  const ensureRecorder = useCallback((id: PaneId) => {
    const doc = iframeRef(id).current?.contentDocument
    if (!doc) return
    if (attachedDoc.current[id] === doc) return // 已经挂在同一个文档上
    recorderCleanup.current[id]?.()
    attachedDoc.current[id] = doc
    recorderCleanup.current[id] = attachRecorder(doc, (rec) => {
      clickLog.current[id].push(rec)
      setClickCounts((c) => ({ ...c, [id]: clickLog.current[id].length }))
    })
  }, [iframeRef])

  // 安全区或注入开关一变，立刻反映到所有可见窗格（和原生一样：改值不需要重载页面）
  useEffect(() => {
    for (const id of visiblePanes) {
      const doc = iframeRef(id).current?.contentDocument
      if (doc?.documentElement) applyInsets(doc, panes[id].insets, injectNative)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panes, injectNative, dual, iframeRef])

  // 视口/安全区一变，之前那批红框的坐标就失效了 —— 清掉，别让它们画在错的位置上
  useEffect(() => {
    setResults({})
  }, [panes, injectNative, dual])

  const handleFrameLoad = useCallback(
    async (id: PaneId) => {
      setReady((r) => ({ ...r, [id]: false }))
      setResults((prev) => ({ ...prev, [id]: undefined }))
      clickLog.current[id] = []
      setClickCounts((c) => ({ ...c, [id]: 0 }))
      const doc = iframeRef(id).current?.contentDocument
      if (!doc) return
      if (!(await waitForApp(doc))) {
        setStatus(`⚠ 窗格 ${id} 没渲染出来（看框里的报错）`)
        return
      }
      ensureRecorder(id)
      applyInsets(doc, panes[id].insets, injectNative)
      // 见过书卡 = 测试书已经播过种了，之后的重载就可以安全地压掉引导层
      markSeededIfBookPresent(doc)
      const t = readFrameTouch(doc)
      setFrameTouch(t)
      setReady((r) => ({ ...r, [id]: true }))
      setStatus(t ? '已载入 · 触屏模式（44px 规则生效）' : '已载入 · 桌面模式（无 44px 约束）')
    },
    // panes/injectNative 故意不进依赖：重载时的注入用当下的值，别让值变化触发整个 load 流程
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ensureRecorder, iframeRef, injectNative],
  )

  const reloadFrame = useCallback(
    (id: PaneId) => {
      // 重载前先把引导层策略定好 —— 引导层在重载后自己走起来是镜像失配的根源
      applyOnboardingPolicy(suppressOnboarding)
      iframeRef(id).current?.contentWindow?.location.reload()
    },
    [iframeRef, suppressOnboarding],
  )

  const applyTouchMode = useCallback(
    (mode: TouchMode) => {
      setTouchMode(mode)
      // 同源，所以直接写的就是应用那份 localStorage
      if (mode === 'auto') localStorage.removeItem('force-touch')
      else localStorage.setItem('force-touch', mode === 'on' ? '1' : '0')
      for (const id of visiblePanes) reloadFrame(id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadFrame, dual],
  )

  const skipOnboarding = useCallback(
    (id: PaneId) => {
      const doc = iframeRef(id).current?.contentDocument
      if (!doc) return
      const btn = [...doc.querySelectorAll('button')].find(
        (b) => b.textContent?.replace(/\s+/g, '').trim() === '跳过',
      )
      if (isClickable(btn)) {
        btn.click() // pointer-events:none 挡不住 .click()
        setStatus(`窗格 ${id}：已跳过引导层`)
      } else {
        setStatus(`窗格 ${id}：没找到「跳过」按钮（引导层可能已经关了）`)
      }
    },
    [iframeRef],
  )

  /* ── 视口与安全区（改的是**当前窗格**）── */

  const patchActive = (patch: Partial<PaneState>) => {
    setPanes((prev) => ({ ...prev, [active]: { ...prev[active], ...patch } }))
  }

  const pickPreset = (id: string) => {
    const vp = VIEWPORTS.find((v) => v.id === id)
    if (!vp) return
    patchActive({ presetId: id, width: vp.width, height: vp.height })
  }

  const [lockRatio, setLockRatio] = useState(true)

  const changeWidth = (w: number) => {
    const cur = panes[active]
    const next: Partial<PaneState> = { presetId: null, width: w }
    if (lockRatio && cur.width > 0) next.height = Math.max(1, Math.round((w * cur.height) / cur.width))
    patchActive(next)
  }

  const activeInsetPresetId = INSET_PRESETS.find((p) => insetsEqual(p.insets, panes[active].insets))?.id ?? null

  /* ── 缩放 ──
   *
   * 两种策略只差一个取舍（竖屏设备横放在横屏窗口里时的固有矛盾）：
   *   fit   宽高都得装下 → 整台设备完整可见，左右必然留白
   *   width 只按宽度     → 左右贴边，上下被裁、要滚动
   * 放大/裁切**都不影响审计结论**：判据量的是 iframe 自己的 CSS 坐标，跟显示缩放无关。
   */

  /** 舞台里能用的宽高：减掉舞台内边距、双窗间距、以及双窗时每格那行说明文字的高度。
      漏掉说明文字会让总高度超几像素，于是「完整可见」之后仍然出现滚动条。 */
  /** 舞台里真正能用的宽高。
      量的是 .stage 而不是外层 .stage-wrap：结果面板就在 wrap 里面，用 wrap 的高度会把它算进
      可用空间（高估 43px），于是双窗时总高超出、冒出滚动条。内边距也要按实际值减（.stage 是
      padding:16px = 两侧共 32px，之前按 16 减，白多给 16px 也会溢出）。
      最后留 1px：差 1px 就会出现滚动条，而滚动条一出现就吃掉 11~21px —— 拿 1px 换掉这个放大效应。 */
  const stageBudget = () => {
    const stage = stageRef.current
    if (!stage) return null
    const cs = getComputedStyle(stage)
    const padX = Number.parseFloat(cs.paddingLeft) + Number.parseFloat(cs.paddingRight)
    const padY = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom)
    const captionH = dual ? 27 : 0 // 实测：说明文字 21px + .pane 的 6px 间距
    return {
      w: stage.clientWidth - padX - (dual ? 16 : 0) - 1,
      h: stage.clientHeight - padY - captionH - 1,
    }
  }

  /**
   * 算缩放系数。关键是**宽度项在所有窗格间共享**：
   * 双窗时两个框是并排的，各自照自己的宽度撑满必然横向溢出（实测过：左边空白变成负数）。
   * 高度项则取最紧的那一个 —— 谁最高谁说了算。
   * 两位小数**向下取整**：Math.round 会向上舍入，算出 97% 却还是差几像素装不下。
   */
  const computeScale = (): number | null => {
    const b = stageBudget()
    if (!b || b.w <= 0 || b.h <= 0) return null
    const totalW = visiblePanes.reduce((n, id) => n + panes[id].width, 0)
    const kWidth = b.w / totalW
    const kHeight = Math.min(...visiblePanes.map((id) => b.h / panes[id].height))
    const k = fillMode === 'width' ? kWidth : Math.min(kWidth, kHeight)
    return Math.min(MAX_SCALE, Math.max(0.1, Math.floor(k * 100) / 100))
  }

  /** 撑满宽度：左右贴边，上下裁掉一部分（要滚动） */
  const fitWidth = useCallback(() => {
    setFillMode('width')
    setAutoFit(true) // 交给自动缩放按新策略算，窗口变了也跟着走
  }, [])

  /** 完整可见：整台设备一眼看完（竖屏手机在横屏窗口里必然左右留白） */
  const fitWindow = useCallback(() => {
    setFillMode('fit')
    setAutoFit(true)
  }, [])

  /** 自动缩放：跟随舞台尺寸重算（窗口缩放、面板收起展开、换视口档、切策略都算）。
      加 16ms 去抖是因为拖动窗口时会连续触发，没必要每一帧都 setState。 */
  useEffect(() => {
    const wrap = stageWrapRef.current
    if (!wrap) return
    if (!autoFit) return

    let timer = 0
    const recompute = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const b = stageBudget()
        if (!b || b.w <= 0 || b.h <= 0) return
        const k = computeScale()
        if (k !== null) setScale(k)
      }, 16)
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(wrap)
    // 也观察舞台本身：结果面板展开/收起时舞台的边框盒会变，那是个真实的信号
    const stage = stageRef.current
    if (stage) ro.observe(stage)
    // 除了 ResizeObserver 再挂一个 window.resize：实测「窗口变小」时 RO 那条路不一定会生效
    // （变大时会），于是缩放会停在旧值。两条信号都挂，几行代码换确定性。
    window.addEventListener('resize', recompute)
    return () => {
      window.clearTimeout(timer)
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFit, fillMode, dual, panes, sideCollapsed, resultsCollapsed, active])

  /* ── 检查 ── */

  const runAudit = async () => {
    setAuditing(true)
    setStatus('等待几何稳定…')
    const next: Partial<Record<PaneId, AuditResult>> = {}
    try {
      for (const id of visiblePanes) {
        const doc = iframeRef(id).current?.contentDocument ?? null
        if (!(await waitForApp(doc))) {
          setStatus(`⚠ 窗格 ${id} 没渲染出来，跳过`)
          continue
        }
        next[id] = await audit(doc!, {
          insets: panes[id].insets,
          touch: readFrameTouch(doc!),
          includeUnderLayers,
        })
      }
      setResults(next)
      // 查出违规就把结果区亮出来（占满模式下它默认是收起的），否则你只知道「有 6 条」却看不到是哪 6 条
      const liveN = visiblePanes.reduce(
        (n, id) =>
          n +
          (next[id]?.violations.filter((v) => !KNOWN_DEFECTS.some((k) => k.test(v))).length ?? 0),
        0,
      )
      setResultsCollapsed(liveN === 0)
      const parts = visiblePanes
        .filter((id) => next[id])
        .map((id) => {
          const r = next[id]!
          const n = r.violations.filter((v) => !KNOWN_DEFECTS.some((k) => k.test(v))).length
          return `${id}: ${n} 条`
        })
        .join(' · ')
      const timedOut = visiblePanes.some((id) => next[id]?.stats.settleTimedOut)
      setStatus(
        timedOut
          ? `⚠ 几何一直在动（等满超时），结果可能不稳 —— 等动画停了再查一次`
          : `检查完成 · ${parts}`,
      )
    } catch (e) {
      setStatus(`⚠ 检查失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAuditing(false)
    }
  }

  /** 把某条违规滚到舞台中间并闪一下 —— 「点条目→定位」 */
  const locate = (paneId: PaneId, v: Violation, idx: number) => {
    const stage = stageRef.current
    const frame = outerRef(paneId).current
    if (!stage || !frame) return
    const fr = frame.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    stage.scrollTo({
      left: Math.max(
        0,
        stage.scrollLeft + (fr.left - sr.left) + v.box.x * scale - (stage.clientWidth - v.box.width * scale) / 2,
      ),
      top: Math.max(
        0,
        stage.scrollTop + (fr.top - sr.top) + v.box.y * scale - (stage.clientHeight - v.box.height * scale) / 2,
      ),
      behavior: 'smooth',
    })
    setFlash({ pane: paneId, idx })
    window.setTimeout(() => setFlash((cur) => (cur?.pane === paneId && cur.idx === idx ? null : cur)), 1500)
  }

  /* ── 镜像 ── */

  const mirror = async () => {
    const from = active
    const to = other(active)
    const log = clickLog.current[from]
    if (log.length === 0) {
      setStatus(`窗格 ${from} 还没有可镜像的操作记录 —— 先在它里面点到目标界面`)
      return
    }
    if (!dual) {
      setStatus('先打开双窗（顶栏「单窗/双窗」）才能镜像')
      return
    }
    setAuditing(true)
    setStatus(`镜像中：重载窗格 ${to}，然后重放 ${log.length} 步…`)
    try {
      reloadFrame(to)
      await sleep(600) // 让新文档先接管
      const doc = iframeRef(to).current?.contentDocument ?? null
      if (!(await waitForApp(doc))) {
        setStatus(`⚠ 窗格 ${to} 重载后没渲染出来，镜像中断`)
        return
      }
      ensureRecorder(to)
      applyInsets(doc!, panes[to].insets, injectNative)
      for (let i = 0; i < log.length; i++) {
        // 轮询等目标出现，而不是固定延时：重放某一步会让应用切到下一个界面，
        // 下一个目标要等那个界面挂载完才存在（引导动画、motion 的弹层都算）。
        // 固定延时要么太短（误报失配）要么太长（白等）—— 这里没有能猜准的固定值。
        const el = await waitForTarget(doc!, log[i])
        if (!isClickable(el)) {
          setStatus(`⚠ 镜像在第 ${i + 1} 步失配：找不到 ${labelOf(log[i])} —— 窗格 ${to} 停在半路`)
          return
        }
        // 点之前等几何稳定：目标「存在」不等于「可响应」——
        // 应用可能还在入场动画里，或者刚切过去的界面还在挂载。稳定了才是真能用。
        await waitForSettled(doc!)
        el.click()
        await sleep(300)
      }

      // 收尾验证：比对两侧的界面指纹。
      // 不做这一步，重放的任何一步没生效都会变成一次**静默的半成功** —— 而你会以为
      // 两边在对照同一个界面。宁可报「不一致」也不要假报成功。
      await waitForSettled(doc!)
      const docFrom = iframeRef(from).current?.contentDocument
      if (!docFrom) {
        setStatus(`镜像完成：窗格 ${to} 重放了 ${log.length} 步（源窗格文档读不到，跳过一致性比对）`)
        return
      }
      const { onlyA, onlyB } = diffSignatures(surfaceSignature(docFrom), surfaceSignature(doc!))
      const show = (xs: string[]) => xs.slice(0, 5).map((x) => `[${x}]`).join(' ') + (xs.length > 5 ? ` …+${xs.length - 5}` : '')
      if (onlyA.length === 0 && onlyB.length === 0) {
        setStatus(`镜像完成：窗格 ${to} 重放了 ${log.length} 步，两侧界面一致 ✓`)
      } else {
        setStatus(
          `⚠ 镜像重放了 ${log.length} 步，但两侧界面**不一致** —— ${from} 独有 ${show(onlyA) || '（无）'}；${to} 独有 ${show(onlyB) || '（无）'}。某一步可能没生效`,
        )
      }
    } finally {
      setAuditing(false)
    }
  }

  /* ── 渲染 ── */

  const paneViolations = (id: PaneId) => {
    const all = results[id]?.violations ?? []
    return {
      live: all.filter((v) => !KNOWN_DEFECTS.some((k) => k.test(v))),
      known: all.filter((v) => KNOWN_DEFECTS.some((k) => k.test(v))),
    }
  }
  const liveTotal = visiblePanes.reduce((n, id) => n + paneViolations(id).live.length, 0)
  const knownTotal = visiblePanes.reduce((n, id) => n + paneViolations(id).known.length, 0)
  const ruleCounts = (['I1', 'I2', 'I3', 'I4'] as RuleId[])
    .map(
      (r) =>
        [
          r,
          visiblePanes.reduce(
            (n, id) => n + paneViolations(id).live.filter((v) => v.rule === r).length,
            0,
          ),
        ] as const,
    )
    .filter(([, n]) => n > 0)

  const anyResult = visiblePanes.some((id) => results[id])

  const paneCaption = (id: PaneState & { id: PaneId }) => {
    const p = id
    return (
      <div className="pane-caption">
        <span className={`tag${active === p.id ? ' on' : ''}`}>窗格 {p.id}</span>
        <span className="note">
          {p.width}×{p.height} · {ratioLabel(p.width, p.height)} ·{' '}
          {injectNative
            ? `注入 ${p.insets.top}/${p.insets.bottom}/${p.insets.left}/${p.insets.right}`
            : '未注入（CSS 保底）'}
          {dual && clickCounts[p.id] > 0 && ` · 已记 ${clickCounts[p.id]} 步操作`}
        </span>
        {!ready[p.id] && <span className="note warn">载入中…</span>}
      </div>
    )
  }

  return (
    <div className="console">
      <div className="topbar">
        <h1>UI 检查台</h1>

        <button
          className={`btn tiny${dual ? ' sel' : ''}`}
          onClick={() => {
            setDual((v) => !v)
            setResults({})
          }}
        >
          {dual ? '▣ 双窗' : '▢ 单窗'}
        </button>
        <button className="btn tiny" onClick={() => setSideCollapsed((v) => !v)}>
          {sideCollapsed ? '▶ 展开控制' : '◀ 收起控制'}
        </button>

        <div className="state">
          {visiblePanes.map((id) => (
            <span className={`chip${active === id && dual ? ' on' : ''}`} key={id}>
              {dual ? `${id} ` : ''}
              {panes[id].width}×{panes[id].height} · {ratioLabel(panes[id].width, panes[id].height)}
            </span>
          ))}
          <span className={`chip${frameTouch ? ' on' : ''}`}>{frameTouch ? '触屏' : '桌面'}</span>
          <span className="chip">缩放 {Math.round(scale * 100)}%</span>
          <span className={`chip${anyResult && liveTotal > 0 ? ' bad' : ''}`}>
            {anyResult ? (liveTotal > 0 ? `${liveTotal} 条违规` : '无违规 ✓') : '未检查'}
          </span>
        </div>
      </div>

      <div className="body">
        <div className={`side${sideCollapsed ? ' collapsed' : ''}`}>
          {/* 当前窗格 */}
          {dual && (
            <div className="group">
              <h2>当前编辑</h2>
              <div className="row">
                {PANE_IDS.map((id) => (
                  <button
                    key={id}
                    className={`btn${active === id ? ' sel' : ''}`}
                    onClick={() => setActive(id)}
                  >
                    窗格 {id}
                  </button>
                ))}
              </div>
              <p className="hint">
                下面「视口」和「安全区」改的是这个窗格。触屏与缩放是**共享**的，见②。
              </p>
            </div>
          )}

          {/* 视口 */}
          <div className="group">
            <h2>① 视口{dual ? ` · 窗格 ${active}` : ''}</h2>
            <div className="grid-btns">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.id}
                  className={`btn${panes[active].presetId === v.id ? ' sel' : ''}`}
                  onClick={() => pickPreset(v.id)}
                  title={v.note ?? `${v.width}×${v.height}`}
                >
                  {v.label}
                  <br />
                  <span className="note">
                    {v.width}×{v.height}
                  </span>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="field">
                宽
                <input
                  type="number"
                  value={panes[active].width}
                  min={120}
                  max={4096}
                  onChange={(e) => changeWidth(Number(e.target.value) || 0)}
                />
              </label>
              <label className="field">
                高
                <input
                  type="number"
                  value={panes[active].height}
                  min={120}
                  max={4096}
                  onChange={(e) => patchActive({ presetId: null, height: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="row">
              <label className="check" style={{ marginBottom: 0 }}>
                <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
                比例锁定 {ratioLabel(panes[active].width, panes[active].height)}
              </label>
            </div>
            <p className="hint">
              改宽度时高度按当前比例跟 —— 防止你手抽出一个人造比例，去追一个真机上不存在的 bug。
            </p>
            <div className="row" style={{ marginTop: 8 }}>
              <button className={`btn${autoFit && fillMode === 'fit' ? ' sel' : ''}`} onClick={fitWindow}>
                完整可见
              </button>
              <button className={`btn${autoFit && fillMode === 'width' ? ' sel' : ''}`} onClick={fitWidth}>
                撑满宽度
              </button>
              <button className="btn" onClick={() => { setAutoFit(false); setScale(1) }}>
                100%
              </button>
              <button className="btn" onClick={() => { setAutoFit(false); setScale(0.5) }}>
                50%
              </button>
            </div>
            <p className="hint">
              **两种只差一个取舍**：竖屏设备放在横屏窗口里，「完整可见」必然左右留白；「撑满宽度」左右贴边、
              但上下要滚动。选哪个取决于你此刻是在看整体布局还是在抠细节。
            </p>
            <p className="hint">
              缩放**共享**：一个舞台上两个不同缩放比例的框没法做视觉对照。缩放只影响显示，审计是在
              iframe 自己的坐标里量的，**放大/裁切都不影响任何结论**。
            </p>
          </div>

          {/* 触屏 */}
          <div className="group">
            <h2>② 触屏模式（共享）</h2>
            <div className="row">
              {(
                [
                  ['auto', '自动'],
                  ['on', '强制触屏'],
                  ['off', '强制桌面'],
                ] as [TouchMode, string][]
              ).map(([m, label]) => (
                <button key={m} className={`btn${touchMode === m ? ' sel' : ''}`} onClick={() => applyTouchMode(m)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              切换会重载所有窗格（触屏判定只在启动时算一次）。写的是 localStorage['force-touch']
              —— 应用自己那条调试开关，不是外挂的旁路。
            </p>
            <p className="hint warn">
              两个窗格**没法**一个触屏一个桌面：它们同源、共享同一份 localStorage。要分别看就切换后各看一次。
            </p>
          </div>

          {/* 安全区 */}
          <div className="group">
            <h2>③ 安全区{dual ? ` · 窗格 ${active}` : ''}</h2>
            <div className="grid-btns">
              {INSET_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`btn${activeInsetPresetId === p.id ? ' sel' : ''}`}
                  onClick={() => patchActive({ insets: p.insets })}
                  title={p.note}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              {INSET_KEYS.map(({ key, label, max }) => (
                <div className="inset-row" key={key}>
                  <span className="name">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={max}
                    value={panes[active].insets[key as InsetKey]}
                    onChange={(e) =>
                      patchActive({
                        insets: { ...panes[active].insets, [key]: Number(e.target.value) },
                      })
                    }
                  />
                  <span className="val">{panes[active].insets[key as InsetKey]}px</span>
                </div>
              ))}
            </div>
            <label className="check" style={{ marginTop: 10 }}>
              <input
                type="checkbox"
                checked={injectNative}
                onChange={(e) => setInjectNative(e.target.checked)}
              />
              <span>
                模拟原生注入（写 data-safe-top-injected 标记）
                <br />
                <span className="note">关掉 = 让 CSS 保底接管（触屏下 16px），用来查注入失败那条路</span>
              </span>
            </label>
            <p className="hint">
              预设里的数字是**类别不是机型断言**，标了「估」。要精确值：用手机浏览器打开本页
              （普通浏览器里 env(safe-area-inset-*) 能解析出真值，Android WebView 里恒为 0），读出来拖滑块。
            </p>
          </div>

          {/* 检查 */}
          <div className="group">
            <h2>④ 检查</h2>
            <button className="btn primary" onClick={runAudit} disabled={!ready[active] || auditing}>
              {auditing ? '检查中…' : dual ? '▶ 检查两个窗格' : '▶ 检查当前画面'}
            </button>
            <p className="hint" style={{ marginTop: 8 }}>
              检查的是**当前这一屏**。要先看哪个界面，就在框里自己点过去 —— 导航归你，它只负责审你现在看的这一屏。
            </p>
            <label className="check" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={includeUnderLayers}
                onChange={(e) => setIncludeUnderLayers(e.target.checked)}
              />
              <span>
                连下层一起审
                <br />
                <span className="note">
                  默认只审最上层：弹层打开时被它盖住的下层不报（那是正常模态行为，报出来就是噪音）
                </span>
              </span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={suppressOnboarding}
                onChange={(e) => {
                  setSuppressOnboarding(e.target.checked)
                  applyOnboardingPolicy(e.target.checked)
                }}
              />
              <span>
                载入时压掉引导层（写应用的「不再提示」标记）
                <br />
                <span className="note">
                  引导层会自己走流程（在步骤里打开侧栏、演示书签列表），任何一次重载都会让它自顾自走起来 ——
                  这是镜像失配的根源。**首次载入必须先让它出现**（测试书靠它播种），所以确认播过种后才生效。
                  取消勾选会清掉标记、让引导层重新出现，方便审它。
                </span>
              </span>
            </label>
            <div className="row" style={{ marginTop: 10 }}>
              {visiblePanes.map((id) => (
                <button className="btn" key={id} onClick={() => reloadFrame(id)}>
                  ↻ 重载 {dual ? id : '应用'}
                </button>
              ))}
              <button className="btn" onClick={() => skipOnboarding(active)}>
                跳过引导层
              </button>
            </div>
            <p className="hint">
              首次载入会出现 9 步引导层盖住界面 —— 它从来没被测过，正好可以审它；不想看就点「跳过引导层」。
            </p>
          </div>

          {/* 对照 */}
          {dual && (
            <div className="group">
              <h2>⑤ 对照</h2>
              <button className="btn primary" onClick={mirror} disabled={auditing}>
                ⟳ 把 {active} 的界面镜像到 {other(active)}
              </button>
              <p className="hint" style={{ marginTop: 8 }}>
                在 {active} 里点到目标界面，然后按这里 —— {other(active)} 会重载并按顺序重放你在 {active}{' '}
                里的每一次点击。重载是为了确定性：从干净状态出发重放同一串操作，落到同一个界面。
              </p>
              <p className="hint">
                已记录：A {clickCounts.A} 步 · B {clickCounts.B} 步（重载会清零）。镜像失配会**报出来**停在第几步
                —— 不做静默的自动联动，因为静默失配会让你以为两边在对照同一个界面。
              </p>
            </div>
          )}

          <div className="group">
            <h2>状态</h2>
            <p className="hint" style={{ margin: 0 }}>{status}</p>
            <div className="stats">
              {visiblePanes.map((id) => (
                <span key={id}>
                  {dual ? `${id} ` : ''}
                  {results[id]
                    ? `审计 ${results[id]!.stats.scanned} · 背板 ${results[id]!.stats.backdrops} · 遮挡跳过 ${results[id]!.stats.occludedSkipped} · 等稳定 ${results[id]!.stats.settleMs}ms`
                    : '未检查'}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="stage-wrap" ref={stageWrapRef}>
          <div className={`stage${dual ? ' dual' : ''}`} ref={stageRef}>
            {visiblePanes.map((id) => {
              const p = panes[id]
              const viols = results[id]?.violations ?? []
              return (
                <div className="pane" key={id}>
                  {dual && (
                    <button className="pane-caption-btn" onClick={() => setActive(id)}>
                      {paneCaption({ ...p, id })}
                    </button>
                  )}
                  <div
                    className="frame-outer"
                    ref={outerRef(id)}
                    onMouseDown={() => setActive(id)}
                    style={{ width: p.width * scale, height: p.height * scale }}
                  >
                    <div className="frame-scale" style={{ width: p.width, height: p.height, transform: `scale(${scale})` }}>
                      <iframe
                        ref={iframeRef(id)}
                        src="/"
                        title={`被测应用 ${id}`}
                        onLoad={() => handleFrameLoad(id)}
                      />
                      <div className="overlay">
                        {p.insets.top > 0 && (
                          <div className="sysband" style={{ top: 0, left: 0, right: 0, height: p.insets.top }} />
                        )}
                        {p.insets.bottom > 0 && (
                          <div className="sysband" style={{ bottom: 0, left: 0, right: 0, height: p.insets.bottom }} />
                        )}
                        {p.insets.left > 0 && (
                          <div
                            className="sysband"
                            style={{ top: p.insets.top, left: 0, bottom: p.insets.bottom, width: p.insets.left }}
                          />
                        )}
                        {p.insets.right > 0 && (
                          <div
                            className="sysband"
                            style={{ top: p.insets.top, right: 0, bottom: p.insets.bottom, width: p.insets.right }}
                          />
                        )}
                        {p.insets.top > 0 && (
                          <div className="sysband-label" style={{ top: 2, left: 4 }}>
                            状态栏 {p.insets.top}px
                          </div>
                        )}
                        {p.insets.bottom > 0 && (
                          <div className="sysband-label" style={{ bottom: 2, left: 4 }}>
                            手势/导航条 {p.insets.bottom}px
                          </div>
                        )}

                        {/* 净空边界线：可交互内容不许越过这里 */}
                        <div style={{ position: 'absolute', left: 0, right: 0, top: p.insets.top, borderTop: '1px solid var(--c-i1)' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, bottom: p.insets.bottom, borderBottom: '1px solid var(--c-i1)' }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: p.insets.left, borderLeft: '1px solid var(--c-i1)' }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, right: p.insets.right, borderRight: '1px solid var(--c-i1)' }} />

                        {viols.map((v, i) => (
                          <div
                            key={`${v.rule}-${i}`}
                            className={`violbox${flash?.pane === id && flash.idx === i ? ' flash' : ''}`}
                            style={{
                              left: v.box.x,
                              top: v.box.y,
                              width: v.box.width,
                              height: v.box.height,
                              borderColor: RULE_COLOR[v.rule],
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className={`results${resultsCollapsed ? ' collapsed' : ''}`}>
            <h2 onClick={() => setResultsCollapsed((v) => !v)}>
              <span className="caret">{resultsCollapsed ? '▲' : '▼'}</span>
              违规
              <span className="count">
                {liveTotal} 条
                {ruleCounts.length > 0 && ` · ${ruleCounts.map(([r, n]) => `${r} 类 ${n}`).join(' · ')}`}
              </span>
              <span className="note">点这行收起/展开</span>
            </h2>
            <div className="results-body">
              <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
                判据：{(['I1', 'I2', 'I3', 'I4'] as RuleId[]).map((r) => `${r} ${RULE_NAME[r]}`).join(' · ')}
              </p>
              {!anyResult ? (
                <p className="empty">还没查。调好参数后点左上「▶ 检查」。</p>
              ) : liveTotal === 0 ? (
                <p className="empty">这一屏没有违规。✓</p>
              ) : (
                visiblePanes.map((id) => {
                  const { live } = paneViolations(id)
                  if (live.length === 0) return null
                  return (
                    <div key={id}>
                      {dual && (
                        <p className="hint" style={{ margin: '6px 0 4px' }}>
                          窗格 {id} · {panes[id].width}×{panes[id].height}
                        </p>
                      )}
                      {live.map((v, i) => (
                        <div className="viol" key={`${id}-${v.rule}-${i}`}>
                          <span className="rule" style={{ color: RULE_COLOR[v.rule] }}>
                            {v.rule}
                          </span>
                          <span className="label" title={v.label}>
                            {v.label}
                          </span>
                          <span className="detail">{v.detail}</span>
                          {v.underLayer && <span className="tag">模态下层</span>}
                          <button className="locate" onClick={() => locate(id, v, (results[id]?.violations ?? []).indexOf(v))}>
                            定位
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}

              <div className="known">
                <h2>
                  已知缺陷
                  <span className="count">{knownTotal} 条命中 · 不计入违规</span>
                </h2>
                {KNOWN_DEFECTS.map((k) => {
                  const hits = visiblePanes.flatMap((id) =>
                    paneViolations(id).known.filter(k.test).map((v) => ({ id, v })),
                  )
                  return (
                    <div className="item" key={k.id}>
                      <div className="t" style={{ color: 'var(--c-i4)' }}>
                        {k.rule} · {k.title}
                        <span className="count"> {hits.length > 0 ? `（本次命中 ${hits.length}）` : '（本次未命中）'}</span>
                      </div>
                      <div className="meta">
                        <b>根因</b>：{k.cause}
                      </div>
                      <div className="meta">
                        <b>修法</b>：{k.fix}
                      </div>
                      {hits.map(({ id, v }) => (
                        <button
                          className="locate"
                          key={id}
                          onClick={() => locate(id, v, (results[id]?.violations ?? []).indexOf(v))}
                        >
                          定位（窗格 {id}）
                        </button>
                      ))}
                    </div>
                  )
                })}
                <p className="hint">
                  这块**故意不占警报通道** —— 它不会自己报警，所以修掉它（或定期看一眼）是你的活。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
