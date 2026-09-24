import { useCallback, useEffect, useRef, useState } from 'react'
import { audit, type AuditResult, type Insets, type RuleId, type Violation } from './audit'
import {
  INSET_PRESETS,
  INSET_KEYS,
  VIEWPORTS,
  insetsEqual,
  ratioLabel,
  type InsetKey,
} from './viewports'
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
      'header 的 backdrop-filter 给后代的 fixed 元素重建了包含块，于是遮罩的 inset-0 解析成 header 的尺寸（360×76）而不是视口。后果：点书页正文关不掉气泡，只能靠右上角 X 或点工具栏。',
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
async function waitForApp(doc: Document, timeoutMs = 10000): Promise<boolean> {
  const t0 = performance.now()
  while (performance.now() - t0 < timeoutMs) {
    if (doc.querySelector('#root')?.firstElementChild) return true
    await new Promise((r) => setTimeout(r, 120))
  }
  return false
}

/* ── 主组件 ───────────────────────────────────────────────── */

export function ConsoleApp() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const frameOuterRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [width, setWidth] = useState(412)
  const [height, setHeight] = useState(915)
  const [presetId, setPresetId] = useState<string | null>('phone-l')
  const [lockRatio, setLockRatio] = useState(true)
  const [scale, setScale] = useState(1)

  const [insets, setInsets] = useState<Insets>(INSET_PRESETS[1].insets)
  const [injectNative, setInjectNative] = useState(true)

  // 预设选中态是**派生值**，不单独存 state：手动拖过滑块后它自己就掉了，
  // 不会出现「显示选中 A 预设、实际值是别的」这种骗人的状态
  const insetPresetId = INSET_PRESETS.find((p) => insetsEqual(p.insets, insets))?.id ?? null

  const [touchMode, setTouchMode] = useState<TouchMode>('auto')
  const [includeUnderLayers, setIncludeUnderLayers] = useState(false)

  const [result, setResult] = useState<AuditResult | null>(null)
  const [auditing, setAuditing] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const [frameTouch, setFrameTouch] = useState(false)
  const [status, setStatus] = useState('等待应用载入…')
  const [flashIdx, setFlashIdx] = useState<number | null>(null)

  // 安全区变了立刻反映到 iframe（和原生一样：改值不需要重载页面）
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument
    if (doc?.documentElement) applyInsets(doc, insets, injectNative)
  }, [insets, injectNative])

  const handleFrameLoad = useCallback(async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    setFrameReady(false)
    setResult(null)
    setStatus('应用载入中…')
    if (!(await waitForApp(doc))) {
      setStatus('⚠ 应用没渲染出来（看 iframe 里的报错）')
      setFrameReady(true)
      return
    }
    // 触屏模式由 localStorage['force-touch'] 在启动时决定，所以重载后才能读准
    const mode = localStorage.getItem('force-touch')
    setFrameTouch(readFrameTouch(doc))
    if (mode === null) setTouchMode('auto')
    applyInsets(doc, insets, injectNative)
    setFrameReady(true)
    setStatus(
      readFrameTouch(doc)
        ? '已载入 · 触屏模式（.icon-btn 44px 生效）'
        : '已载入 · 桌面模式（无 44px 约束）',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insets, injectNative])

  const reloadFrame = useCallback(() => {
    iframeRef.current?.contentWindow?.location.reload()
  }, [])

  const applyTouchMode = useCallback(
    (mode: TouchMode) => {
      setTouchMode(mode)
      // 同一源，所以直接写的就是应用那份 localStorage
      if (mode === 'auto') localStorage.removeItem('force-touch')
      else localStorage.setItem('force-touch', mode === 'on' ? '1' : '0')
      reloadFrame()
    },
    [reloadFrame],
  )

  const skipOnboarding = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const btn = [...doc.querySelectorAll('button')].find(
      (b) => b.textContent?.replace(/\s+/g, '').trim() === '跳过',
    )
    if (btn instanceof HTMLElement) {
      btn.click() // pointer-events:none 挡不住 .click()
      setStatus('已跳过引导层')
    } else {
      setStatus('没找到「跳过」按钮（引导层可能已经关了）')
    }
  }, [])

  const pickPreset = (id: string) => {
    const vp = VIEWPORTS.find((v) => v.id === id)
    if (!vp) return
    setPresetId(id)
    setWidth(vp.width)
    setHeight(vp.height)
  }

  const changeWidth = (w: number) => {
    setPresetId(null)
    if (lockRatio && width > 0) setHeight(Math.max(1, Math.round((w * height) / width)))
    setWidth(w)
  }

  const changeHeight = (h: number) => {
    setPresetId(null)
    setHeight(h)
  }

  const fitWidth = () => {
    const stage = stageRef.current
    if (!stage) return
    const avail = stage.clientWidth - 32
    setScale(Math.min(1, Math.max(0.1, Math.round((avail / width) * 100) / 100)))
  }

  const runAudit = async () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    setAuditing(true)
    setStatus('等待几何稳定…')
    try {
      const ready = await waitForApp(doc)
      if (!ready) {
        setStatus('⚠ 应用没渲染出来，检查被跳过')
        return
      }
      const r = await audit(doc, {
        insets,
        touch: readFrameTouch(doc),
        includeUnderLayers,
      })
      setResult(r)
      setStatus(
        r.stats.settleTimedOut
          ? `⚠ 几何一直在动（等满 ${r.stats.settleMs}ms），结果可能不稳 —— 等动画停了再查一次`
          : `检查完成 · 等几何稳定 ${r.stats.settleMs}ms · 审计 ${r.stats.scanned} 个元素`,
      )
    } catch (e) {
      setStatus(`⚠ 检查失败：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setAuditing(false)
    }
  }

  /** 把某条违规滚到舞台中间并闪一下 —— 「点条目→定位」 */
  const locate = (v: Violation, idx: number) => {
    const stage = stageRef.current
    const frame = frameOuterRef.current
    if (!stage || !frame) return
    const fr = frame.getBoundingClientRect()
    const sr = stage.getBoundingClientRect()
    const offX = fr.left - sr.left
    const offY = fr.top - sr.top
    stage.scrollTo({
      left: Math.max(0, stage.scrollLeft + offX + v.box.x * scale - (stage.clientWidth - v.box.width * scale) / 2),
      top: Math.max(0, stage.scrollTop + offY + v.box.y * scale - (stage.clientHeight - v.box.height * scale) / 2),
      behavior: 'smooth',
    })
    setFlashIdx(idx)
    window.setTimeout(() => setFlashIdx((cur) => (cur === idx ? null : cur)), 1500)
  }

  const all = result?.violations ?? []
  const knownDefectViolations = all.filter((v) => KNOWN_DEFECTS.some((k) => k.test(v)))
  const liveViolations = all.filter((v) => !KNOWN_DEFECTS.some((k) => k.test(v)))
  const ruleCounts = (['I1', 'I2', 'I3', 'I4'] as RuleId[])
    .map((r) => [r, all.filter((v) => v.rule === r).length] as const)
    .filter(([, n]) => n > 0)

  /** 违规框在 overlay 上的索引要跟 all 对齐 —— 用元素本身在 all 里的下标 */
  const boxIdx = (v: Violation) => all.indexOf(v)

  return (
    <div className="console">
      <div className="topbar">
        <h1>Chapterbound UI 检查台</h1>
        <div className="state">
          <span className="chip">
            {width}×{height} · {ratioLabel(width, height)}
          </span>
          <span className={`chip${frameTouch ? ' on' : ''}`}>
            {frameTouch ? '触屏' : '桌面'}
          </span>
          <span className="chip">
            {injectNative
              ? `注入 ${insets.top}/${insets.bottom}/${insets.left}/${insets.right}`
              : '未注入（走 CSS 保底）'}
          </span>
          <span className="chip">缩放 {Math.round(scale * 100)}%</span>
        </div>
      </div>

      <div className="body">
        <div className="side">
          {/* 视口 */}
          <div className="group">
            <h2>① 视口</h2>
            <div className="grid-btns">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.id}
                  className={`btn${presetId === v.id ? ' sel' : ''}`}
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
                  value={width}
                  min={120}
                  max={4096}
                  onChange={(e) => changeWidth(Number(e.target.value) || 0)}
                />
              </label>
              <label className="field">
                高
                <input
                  type="number"
                  value={height}
                  min={120}
                  max={4096}
                  onChange={(e) => changeHeight(Number(e.target.value) || 0)}
                />
              </label>
            </div>
            <div className="row">
              <label className="check" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={lockRatio}
                  onChange={(e) => setLockRatio(e.target.checked)}
                />
                比例锁定 {ratioLabel(width, height)}
              </label>
            </div>
            <p className="hint">
              改宽度时高度按当前比例跟 —— 防止你手抽出一个人造比例，去追一个真机上不存在的 bug。
            </p>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => setScale(1)}>
                100%
              </button>
              <button className="btn" onClick={() => setScale(0.75)}>
                75%
              </button>
              <button className="btn" onClick={() => setScale(0.5)}>
                50%
              </button>
              <button className="btn" onClick={fitWidth}>
                适应宽度
              </button>
            </div>
            <p className="hint">缩放只影响显示；审计是在 iframe 自己的坐标里量的，不受影响。</p>
          </div>

          {/* 触屏 */}
          <div className="group">
            <h2>② 触屏模式</h2>
            <div className="row">
              {(
                [
                  ['auto', '自动'],
                  ['on', '强制触屏'],
                  ['off', '强制桌面'],
                ] as [TouchMode, string][]
              ).map(([m, label]) => (
                <button
                  key={m}
                  className={`btn${touchMode === m ? ' sel' : ''}`}
                  onClick={() => applyTouchMode(m)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="hint">
              切换会重载应用（触屏判定只在启动时算一次）。写的是 localStorage['force-touch']
              —— 应用自己那条调试开关，不是外挂的旁路。桌面浏览器上「自动」= 桌面模式，
              想看触屏布局就选「强制触屏」。
            </p>
          </div>

          {/* 安全区 */}
          <div className="group">
            <h2>③ 安全区</h2>
            <div className="grid-btns">
              {INSET_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`btn${insetPresetId === p.id ? ' sel' : ''}`}
                  onClick={() => setInsets(p.insets)}
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
                    value={insets[key as InsetKey]}
                    onChange={(e) => {
                      setInsets((cur) => ({ ...cur, [key]: Number(e.target.value) }))
                    }}
                  />
                  <span className="val">{insets[key as InsetKey]}px</span>
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
                <span className="note">
                  关掉 = 让 CSS 保底接管（触屏下 16px），用来查注入失败那条路
                </span>
              </span>
            </label>
            <p className="hint">
              预设里的数字是**类别不是机型断言**，标了「估」。要精确值：用手机浏览器打开本页
              （普通浏览器里 env(safe-area-inset-*) 能解析出真值，Android WebView 里恒为 0），
              读出来拖滑块。
            </p>
          </div>

          {/* 检查 */}
          <div className="group">
            <h2>④ 检查</h2>
            <button className="btn primary" onClick={runAudit} disabled={!frameReady || auditing}>
              {auditing ? '检查中…' : '▶ 检查当前画面'}
            </button>
            <p className="hint" style={{ marginTop: 8 }}>
              检查的是**当前这一屏**。要先看哪个界面，就在右边 iframe 里自己点过去 —— 导航归你，
              它只负责审你现在看的这一屏。
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
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={reloadFrame}>
                ↻ 重载应用
              </button>
              <button className="btn" onClick={skipOnboarding}>
                跳过引导层
              </button>
            </div>
            <p className="hint">
              首次载入会出现 9 步引导层盖住界面 —— 它从来没被测过，正好可以审它；不想看就点「跳过引导层」。
            </p>
          </div>

          <div className="group">
            <h2>状态</h2>
            <p className="hint" style={{ margin: 0 }}>{status}</p>
            {result && (
              <div className="stats">
                <span>审计 {result.stats.scanned} 个可交互元素</span>
                <span>背板 {result.stats.backdrops}</span>
                <span>模态遮挡跳过 {result.stats.occludedSkipped}</span>
                <span>等稳定 {result.stats.settleMs}ms</span>
              </div>
            )}
          </div>
        </div>

        <div className="stage-wrap">
          <div className="stage" ref={stageRef}>
            <div
              className="frame-outer"
              ref={frameOuterRef}
              style={{ width: width * scale, height: height * scale }}
            >
              <div
                className="frame-scale"
                style={{ width, height, transform: `scale(${scale})` }}
              >
                <iframe
                  ref={iframeRef}
                  src="/"
                  title="被测应用"
                  onLoad={handleFrameLoad}
                />
                {/* 覆盖层：坐标 = iframe 的 CSS 像素空间 */}
                <div className="overlay">
                  {/* 系统区斜纹带：系统会挡住这里 */}
                  {insets.top > 0 && (
                    <div className="sysband" style={{ top: 0, left: 0, right: 0, height: insets.top }} />
                  )}
                  {insets.bottom > 0 && (
                    <div
                      className="sysband"
                      style={{ bottom: 0, left: 0, right: 0, height: insets.bottom }}
                    />
                  )}
                  {insets.left > 0 && (
                    <div
                      className="sysband"
                      style={{ top: insets.top, left: 0, bottom: insets.bottom, width: insets.left }}
                    />
                  )}
                  {insets.right > 0 && (
                    <div
                      className="sysband"
                      style={{ top: insets.top, right: 0, bottom: insets.bottom, width: insets.right }}
                    />
                  )}
                  {insets.top > 0 && (
                    <div className="sysband-label" style={{ top: 2, left: 4 }}>
                      状态栏 {insets.top}px
                    </div>
                  )}
                  {insets.bottom > 0 && (
                    <div className="sysband-label" style={{ bottom: 2, left: 4 }}>
                      手势/导航条 {insets.bottom}px
                    </div>
                  )}

                  {/* 净空边界线：可交互内容不许越过这里 */}
                  <div style={{ position: 'absolute', left: 0, right: 0, top: insets.top, borderTop: `1px solid ${'var(--c-i1)'}` }} />
                  <div style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom, borderBottom: `1px solid ${'var(--c-i1)'}` }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: insets.left, borderLeft: `1px solid ${'var(--c-i1)'}` }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: insets.right, borderRight: `1px solid ${'var(--c-i1)'}` }} />

                  {/* 违规框 */}
                  {all.map((v, i) => (
                    <div
                      key={`${v.rule}-${i}`}
                      className={`violbox${flashIdx === i ? ' flash' : ''}`}
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

          <div className="results">
            <h2>
              违规
              <span className="count">
                {liveViolations.length} 条
                {ruleCounts.length > 0 && ` · ${ruleCounts.map(([r, n]) => `${r} 类 ${n}`).join(' · ')}`}
              </span>
            </h2>
            <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
              判据：
              {(['I1', 'I2', 'I3', 'I4'] as RuleId[]).map((r) => `${r} ${RULE_NAME[r]}`).join(' · ')}
            </p>
            {!result ? (
              <p className="empty">还没查。调好参数后点左上「▶ 检查当前画面」。</p>
            ) : liveViolations.length === 0 ? (
              <p className="empty">这一屏没有违规。✓</p>
            ) : (
              liveViolations.map((v) => {
                const i = boxIdx(v)
                return (
                  <div className="viol" key={`${v.rule}-${i}`}>
                    <span className="rule" style={{ color: RULE_COLOR[v.rule] }}>
                      {v.rule}
                    </span>
                    <span className="label" title={v.label}>
                      {v.label}
                    </span>
                    <span className="detail">{v.detail}</span>
                    {v.underLayer && <span className="tag">模态下层</span>}
                    <button className="locate" onClick={() => locate(v, i)}>
                      定位
                    </button>
                  </div>
                )
              })
            )}

            <div className="known">
              <h2>
                已知缺陷
                <span className="count">{knownDefectViolations.length} 条命中 · 不计入违规</span>
              </h2>
              {KNOWN_DEFECTS.map((k) => {
                const hits = knownDefectViolations.filter(k.test)
                return (
                  <div className="item" key={k.id}>
                    <div className="t" style={{ color: 'var(--c-i4)' }}>
                      {k.rule} · {k.title}
                      <span className="count">
                        {' '}
                        {hits.length > 0 ? `（本次命中 ${hits.length}）` : '（本次未命中）'}
                      </span>
                    </div>
                    <div className="meta">
                      <b>根因</b>：{k.cause}
                    </div>
                    <div className="meta">
                      <b>修法</b>：{k.fix}
                    </div>
                    {hits.length > 0 && (
                      <button className="locate" onClick={() => locate(hits[0], boxIdx(hits[0]))}>
                        定位
                      </button>
                    )}
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
  )
}
