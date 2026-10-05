import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence, useAnimate } from 'motion/react'
import { useReader } from '../hooks/useReader'
import { useKeyboard } from '../hooks/useKeyboard'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { useBookmarkStore } from '../stores/bookmarkStore'
import { useHighlightStore } from '../stores/highlightStore'
import { ArrowLeft, Bookmark, List, ChevronLeft, ChevronRight, Sun, Moon, Settings, X, ScrollText, Upload, User, MapPin, Skull, Download, Search, Copy } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import { useSettingsStore } from '../stores/settingsStore'
import { useCompendiumStore, type SearchResult } from '../stores/compendiumStore'
import { useToastStore } from '../stores/toastStore'
import type { TOCItem } from '../core/types'
import { PAGE_THEME_PRESETS } from '../data/themes'
import { useIsTouch } from '../hooks/useIsTouch'
import { makeFingerprint, encodeRelayCode, parseRelayInput } from '../utils/positionCode'

interface Props {
  bookId: string
  onBack: () => void
}

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }
const springSlide = { type: 'spring' as const, bounce: 0.15, duration: 0.3 }
const springBounce = { type: 'spring' as const, bounce: 0.4, duration: 0.35 }

const bookmarkColors = [
  { name: '琥珀', value: '#D4996A' },
  { name: '珊瑚', value: '#DA7A5A' },
  { name: '青蓝', value: '#6BA3A0' },
  { name: '藤绿', value: '#8FA87A' },
  { name: '紫罗兰', value: '#B89AC4' },
]

const sidebarTabs = [
  { key: 'toc' as const, label: '目录' },
  { key: 'bookmarks' as const, label: '书签' },
  { key: 'compendium' as const, label: '图鉴' },
  { key: 'settings' as const, label: '设置' },
]

export function ReaderPage({ bookId, onBack }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { nextPage, prevPage, getEngine, getCurrentChapter, pageInfo, applySettings, error } = useReader(bookId, containerRef)
  const readProgress = pageInfo.total > 0 ? Math.round((pageInfo.current / pageInfo.total) * 100) : 0
  const book = useBookshelfStore((s) => s.books.find((b) => b.id === bookId))
  const { bookmarks, loadBookmarks, addBookmark, getBookmarkAt, removeBookmark } = useBookmarkStore()
  const { loadHighlights } = useHighlightStore()
  const { settings, updateSettings } = useSettingsStore()
  const compendiumEntries = useCompendiumStore((s) => s.entries)
  const compendiumLastViewedAt = useCompendiumStore((s) => s.lastViewedAt)
  const compendiumMarkViewed = useCompendiumStore((s) => s.markViewed)
  const compendiumLoad = useCompendiumStore((s) => s.loadCompendium)
  const compendiumImport = useCompendiumStore((s) => s.importFromJSON)
  const getEntriesByCategory = useCompendiumStore((s) => s.getEntriesByCategory)
  const getEntryById = useCompendiumStore((s) => s.getEntryById)
  const [compendiumCategory, setCompendiumCategory] = useState<'character' | 'location' | 'monster'>('character')
  const [compendiumSearch, setCompendiumSearch] = useState('')
  const [detailEntryId, setDetailEntryId] = useState<string | null>(null)
  const searchEntries = useCompendiumStore((s) => s.searchEntries)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(50)
  const [selData, setSelData] = useState<{ text: string; x: number; y: number } | null>(null)
  const [selResults, setSelResults] = useState<SearchResult[] | null>(null)
  // 位置接力（设置面板内）：定位点就绪状态 / 生成的短码 / 待解析的输入
  const [relayReady, setRelayReady] = useState(false)
  const [relayCode, setRelayCode] = useState<string | null>(null)
  const [relayInput, setRelayInput] = useState('')

  const [toc, setToc] = useState<TOCItem[]>([])
  const [sidebarTab, setSidebarTab] = useState<'toc' | 'bookmarks' | 'compendium' | 'settings' | null>(null)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [pageKey, setPageKey] = useState(0)
  const [hoveredEdge, setHoveredEdge] = useState<'left' | 'right' | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [relationsExpanded, setRelationsExpanded] = useState(false)
  const isTouch = useIsTouch()
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnDirection = useRef(0)
  const pageInfoRef = useRef(pageInfo)
  pageInfoRef.current = pageInfo
  const [cardScope, cardAnimate] = useAnimate()
  const [bookmarkScope, bookmarkAnimate] = useAnimate()
  const { toggle: toggleTheme, isDark } = useTheme()

  // 分类/搜索变更时重置可见数量
  useEffect(() => {
    setVisibleCount(50)
  }, [debouncedSearch, compendiumCategory])

  // 搜索防抖：条目 ≤50 即时响应，>50 延迟 150ms
  useEffect(() => {
    if (compendiumEntries.length <= 50) {
      setDebouncedSearch(compendiumSearch)
      return
    }
    const timer = setTimeout(() => setDebouncedSearch(compendiumSearch), 150)
    return () => clearTimeout(timer)
  }, [compendiumSearch, compendiumEntries.length])

  // 关联计数缓存，详情弹窗中避免每次渲染都 O(N×R) 扫描
  const globalRefCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of compendiumEntries) {
      for (const r of e.relations) {
        map.set(r.targetId, (map.get(r.targetId) ?? 0) + 1)
      }
    }
    return map
  }, [compendiumEntries])

  const handleNext = useCallback(() => {
    turnDirection.current = 1
    nextPage()
  }, [nextPage])

  const handlePrev = useCallback(() => {
    turnDirection.current = -1
    prevPage()
  }, [prevPage])

  useKeyboard({ onPrev: handlePrev, onNext: handleNext })

  useEffect(() => {
    loadBookmarks(bookId)
    loadHighlights(bookId)
  }, [bookId, loadBookmarks, loadHighlights])

  // 页码变化触发动画
  useEffect(() => {
    setPageKey((k) => k + 1)
  }, [pageInfo.current])

  useEffect(() => {
    if (pageKey === 0) return
    const dir = turnDirection.current
    if (dir === 0) return
    cardAnimate(cardScope.current,
      { x: [dir * 24, 0], opacity: [0.6, 1] },
      { type: 'spring', bounce: 0, duration: 0.3 },
    )
  }, [pageKey])

  // 页面主题变化时更新 iframe 内文字颜色
  const pageTheme = settings.pageTheme
  useEffect(() => {
    getEngine()?.setPageColors(pageTheme)
  }, [pageTheme, pageInfo.total, getEngine])

  // 页面数量（单页/自动）变化时更新引擎
  useEffect(() => {
    getEngine()?.setColumnMode(settings.columnMode)
  }, [settings.columnMode, getEngine])

  // 监听选中文字事件，弹出检索按钮
  useEffect(() => {
    const engine = getEngine()
    if (!engine || pageInfo.total === 0) return
    const handler = (...args: unknown[]) => {
      const text = (args[0] as string ?? '').trim()
      if (text.length > 0) {
        setSelData({ text, x: args[2] as number, y: args[3] as number })
        setSelResults(null)
      } else {
        setSelData(null)
        setSelResults(null)
      }
    }
    engine.on('selection', handler)
    return () => { engine.off('selection', handler) }
  }, [getEngine, pageInfo.total])

  // 翻页时关闭检索浮窗
  useEffect(() => {
    setSelData(null)
    setSelResults(null)
  }, [pageKey])

  // 位置接力：设置面板打开期间轮询定位点就绪（locations 在 load 后异步生成，一般几秒内完成）
  useEffect(() => {
    if (sidebarTab !== 'settings') return
    const engine = getEngine()
    if (!engine) return
    if (engine.isLocationsReady()) {
      setRelayReady(true)
      return
    }
    setRelayReady(false)
    const timer = setInterval(() => {
      if (getEngine()?.isLocationsReady()) {
        setRelayReady(true)
        clearInterval(timer)
      }
    }, 600)
    return () => clearInterval(timer)
  }, [sidebarTab, getEngine])

  const toolbarVisibleRef = useRef(true)
  useEffect(() => {
    toolbarVisibleRef.current = toolbarVisible
  }, [toolbarVisible])

  const resetHideTimer = useCallback(() => {
    setToolbarVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    // 触屏设备常显工具栏：自动渐隐会让按钮视觉消失、且呼出依赖 tap 区域判断，手机上容易找不到
    if (isTouch) return
    hideTimer.current = setTimeout(() => setToolbarVisible(false), 3000)
  }, [isTouch])

  // tap 中央：触屏切换沉浸模式（隐/显顶栏与页码）；桌面切换工具栏显隐
  const toggleToolbar = useCallback(() => {
    if (isTouch) {
      // 沉浸模式是**手动、可逆**的切换，和那条被否掉的「3 秒自动渐隐」不是一回事：
      // 那条的问题是按钮自己消失后用户不知道去哪找回；这里隐藏和恢复是同一个动作
      //（再点一下中间），而且顶栏原本占的位置也仍然是「点一下唤回」的热区。
      setToolbarVisible((v) => !v)
      return
    }
    if (toolbarVisibleRef.current) {
      if (hideTimer.current) clearTimeout(hideTimer.current)
      setToolbarVisible(false)
    } else {
      resetHideTimer()
    }
  }, [isTouch, resetHideTimer])

  // 沉浸模式（仅触屏）：顶栏与页码一起隐藏。桌面恒为 false —— 桌面顶栏是渐隐到 0.3，不隐藏。
  const chromeHidden = isTouch && !toolbarVisible

  // ── Android 返回键逐层退出（popstate 阶段；Phase 3 由 Capacitor backButton 叠加） ──
  // 覆盖层栈：图鉴详情 > 侧栏 > 阅读器。popstate 处理器只读 ref，不依赖闭包捕获的 state。
  const sidebarTabRef = useRef(sidebarTab)
  const detailEntryIdRef = useRef(detailEntryId)
  const pickerOpenRef = useRef(pickerOpen)
  useEffect(() => { sidebarTabRef.current = sidebarTab }, [sidebarTab])
  useEffect(() => { detailEntryIdRef.current = detailEntryId }, [detailEntryId])
  useEffect(() => { pickerOpenRef.current = pickerOpen }, [pickerOpen])

  const closeTopOverlay = useCallback(() => {
    if (detailEntryIdRef.current !== null) {
      setDetailEntryId(null)
      setSidebarTab('compendium')
    } else if (sidebarTabRef.current !== null) {
      setSidebarTab(null)
    } else if (pickerOpenRef.current) {
      setPickerOpen(false)
    } else {
      onBack()
    }
  }, [onBack])

  useEffect(() => {
    history.pushState({ reader: true }, '')
    const onPopState = () => {
      const hadOverlay = detailEntryIdRef.current !== null
        || sidebarTabRef.current !== null
        || pickerOpenRef.current
      closeTopOverlay()
      // 覆盖层只更新 reader 条目的 state（不新增条目），返回键弹出的就是 reader 条目本身。
      // 关掉覆盖层后条目已被弹出 → 重新压入，维持「关覆盖层 → 再按返回 → 退出阅读器」的逐层语义；
      // 无覆盖层时是退出阅读器（onBack），不重压，卸载时历史栈恢复干净。
      if (hadOverlay) history.pushState({ reader: true }, '')
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      // 卸载后清除 reader 标记，避免残留条目上的 popstate 误触发
      if (history.state?.reader) history.replaceState(null, '')
    }
  }, [closeTopOverlay])

  // 触屏手势订阅（B 类：事件仅由触屏环境下的引擎注册后才会发出）
  useEffect(() => {
    const engine = getEngine()
    if (!engine || pageInfo.total === 0) return
    const onSwipe = (...args: unknown[]) => {
      const dir = args[0] as string
      if (dir === 'left') handleNext()
      else if (dir === 'right') handlePrev()
    }
    const onTap = (...args: unknown[]) => {
      const { xRatio } = args[0] as { xRatio: number }
      if (xRatio < 0.3) handlePrev()
      else if (xRatio > 0.7) handleNext()
      else toggleToolbar()
    }
    engine.on('gesture:swipe', onSwipe)
    engine.on('gesture:tap', onTap)
    return () => {
      engine.off('gesture:swipe', onSwipe)
      engine.off('gesture:tap', onTap)
    }
  }, [getEngine, pageInfo.total, handleNext, handlePrev, toggleToolbar])

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [])

  const currentLocation = useCallback(() => getEngine()?.getCurrentLocation() ?? '', [getEngine])
  const currentBookmark = useCallback(() => {
    const loc = currentLocation()
    return loc ? getBookmarkAt(loc) : undefined
  }, [currentLocation, getBookmarkAt])

  // 打开侧栏：更新 reader 条目的 state 而非新增历史条目（历史栈恒为两条，返回键逐层退出）
  const openSidebar = useCallback((tab: 'toc' | 'bookmarks' | 'compendium' | 'settings') => {
    setSidebarTab(tab)
    history.replaceState({ reader: true, sidebar: tab }, '')
  }, [])

  const handleBookmarkClick = useCallback(() => {
    const loc = currentLocation()
    if (!loc) return
    const existing = getBookmarkAt(loc)
    if (existing) {
      // 已有书签 → 打开书签列表
      openSidebar('bookmarks')
      return
    }
    // picker 纳入返回键栈：状态与历史 state 同步（replaceState 不新增条目）
    const next = !pickerOpen
    setPickerOpen(next)
    history.replaceState({ reader: true, picker: next }, '')
  }, [currentLocation, getBookmarkAt, openSidebar, pickerOpen])

  const handlePickColor = useCallback(async (color: string) => {
    const loc = currentLocation()
    if (!loc) return
    setPickerOpen(false)
    history.replaceState({ reader: true }, '')
    const { current, total } = pageInfoRef.current
    const progress = total > 0 ? Math.round((current / total) * 100) : 50
    await addBookmark(bookId, loc, `书签 ${bookmarks.length + 1}`, color, progress)
    bookmarkAnimate(bookmarkScope.current,
      { scale: [1, 1.35, 1] },
      { type: 'spring', bounce: 0.4, duration: 0.4 },
    )
  }, [currentLocation, addBookmark, bookId, bookmarks.length, bookmarkAnimate, bookmarkScope])

  const handleShowToc = async () => {
    const engine = getEngine()
    if (!engine) return
    const items = await engine.getTOC()
    setToc(items)
    openSidebar('toc')
  }

  const handleSettingsChange = (patch: Partial<typeof settings>) => {
    updateSettings(patch)
    applySettings({ ...settings, ...patch })
  }

  const handleImportJSON = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { input.remove(); return }
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        await compendiumImport(bookId, json, getCurrentChapter())
        useToastStore.getState().toast('导入成功', 'success')
      } catch (e) {
        console.error('[import] failed:', e)
        useToastStore.getState().toast('导入失败，请检查 JSON 格式', 'error', 4000)
      }
      input.remove()
    }
    input.click()
  }, [bookId, compendiumImport, getCurrentChapter])

  const detailEntry = detailEntryId ? getEntryById(detailEntryId) : undefined

  const handleShowEntryDetail = useCallback((id: string) => {
    setDetailEntryId(id)
    setSidebarTab(null)
    setRelationsExpanded(false)
    history.replaceState({ reader: true, detail: id }, '')
  }, [])

  // ── 位置接力：生成端与接收端 ──

  const copyRelayText = useCallback(async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      useToastStore.getState().toast(okMsg, 'success')
    } catch {
      // 降级：临时 textarea + execCommand（WebView 里 clipboard API 偶尔不可用）
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        const ok = document.execCommand('copy')
        ta.remove()
        useToastStore.getState().toast(ok ? okMsg : '复制失败，请长按选择文本手动复制', ok ? 'success' : 'error')
      } catch {
        useToastStore.getState().toast('复制失败，请长按选择文本手动复制', 'error')
      }
    }
  }, [])

  const handleGenerateRelayCode = useCallback(() => {
    const engine = getEngine()
    if (!engine) return
    if (!engine.isLocationsReady()) {
      useToastStore.getState().toast('定位点还在生成，稍等几秒再试', 'info')
      return
    }
    const index = engine.getCurrentLocationIndex()
    if (index < 0) {
      useToastStore.getState().toast('拿不到当前位置', 'error')
      return
    }
    const fingerprint = makeFingerprint(engine.getFileSize(), engine.getFileHead())
    setRelayCode(encodeRelayCode(fingerprint, index))
  }, [getEngine])

  const handleRelayJump = useCallback(() => {
    const engine = getEngine()
    if (!engine) return
    const toast = useToastStore.getState().toast
    const parsed = parseRelayInput(relayInput)
    // 书名校验（输入里带《书名》时）：不匹配硬拒绝——位置语义跨书本来就不成立
    if (parsed.title && book?.title && parsed.title !== book.title) {
      toast(`这码来自《${parsed.title}》，请先打开那本书`, 'error', 4000)
      return
    }
    // 跳转后统一收尾：清输入、关设置面板（与目录/书签点击一致）、报落点
    const finish = (percentText: string) => {
      setRelayInput('')
      setSidebarTab(null)
      history.replaceState({ reader: true }, '')
      toast(`已跳到 · ${percentText}`, 'success')
    }
    // 短码在 → 先过"书身份"闸（指纹）。它只做校验：跳转坐标另有优先级。
    if (parsed.shortcode) {
      const fingerprint = makeFingerprint(engine.getFileSize(), engine.getFileHead())
      if (parsed.shortcode.fingerprint !== fingerprint) {
        toast('这码属于另一本书（指纹不匹配）', 'error', 4000)
        return
      }
    }
    // 坐标三选一：CFI（若输入里带了，逐字精确）＞ 短码序号（±约一段）＞ 百分比。
    // 三条路径都以"真的发起跳转"为准：失败就报错不关面板，不许报假成功。
    if (parsed.cfi) {
      if (!engine.goToRelayCfi(parsed.cfi)) {
        toast('这条 CFI 解析不了，检查一下卡片第 3 行', 'error', 4000)
        return
      }
      finish(`${engine.getProgressForLocation(parsed.cfi)}%`)
      return
    }
    if (parsed.shortcode) {
      if (!engine.goToLocationIndex(parsed.shortcode.locationIndex)) {
        toast('定位点还没就绪，稍等几秒再试', 'error')
        return
      }
      finish(`${(engine.getPercentForIndex(parsed.shortcode.locationIndex) * 100).toFixed(1)}%`)
      return
    }
    if (parsed.percent != null) {
      if (!(parsed.percent >= 0 && parsed.percent <= 100)) {
        toast('百分比超出范围', 'error')
        return
      }
      if (!engine.goToPercentage(parsed.percent / 100)) {
        toast('定位点还没就绪，稍等几秒再试', 'error')
        return
      }
      finish(`${parsed.percent.toFixed(1)}%`)
      return
    }
    if (parsed.shortcodeError) {
      toast(parsed.shortcodeError === 'version' ? '这码来自另一个版本的 App（或抄错了）' : '码可能抄错了，检查一下', 'error', 4000)
      return
    }
    if (parsed.title) {
      toast(`只认出了书名《${parsed.title}》，没有位置信息`, 'error')
      return
    }
    toast('没认出这条位置码', 'error')
  }, [relayInput, getEngine, book])

  const toolbarBg = 'var(--color-toolbar)'
  const toolbarBlur = 'blur(24px) saturate(180%)'

  const navButtonClass = useMemo(
    () => ({
      background: toolbarBg,
      backdropFilter: toolbarBlur,
      WebkitBackdropFilter: toolbarBlur,
      boxShadow: 'var(--shadow-float)',
      color: 'var(--color-text)',
    }),
    [],
  )

  return (
    <div
      className="reader-touch relative flex h-screen flex-col"
      style={{ background: 'var(--color-page-bg)' }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {/* 材质化工具栏 — 桌面自动渐隐；触屏由「点中间」切换沉浸模式 */}
      <motion.header
        className="relative z-10 flex items-center gap-1 px-2 py-2"
        style={{
          background: toolbarBg,
          backdropFilter: toolbarBlur,
          WebkitBackdropFilter: toolbarBlur,
          // 沉浸模式下用 display:none 而不是「透明 + pointer-events:none」：一次同时做到
          // ①从布局里移除（把这条高度还给正文，卡片随之变高）②不可点击。
          // 分成两个属性写迟早会漏一个 —— 项目里已经有「看不见却可点」的旧账。
          // 刻意**不做高度动画**：高度每变一帧，useReader 的 ResizeObserver 就会触发一次
          // engine.resize() → epub.js 重排一次，那会变成十几连排。
          display: chromeHidden ? 'none' : undefined,
          // 净空 = 状态栏高度 + 8px。那 8px 是给安卓顶部防误触/下拉通知区的：
          // 它通常比状态栏本身更高，贴边那一横带点不动（历史 bug 清单里的「顶栏无法点击」）。
          paddingTop: 'calc(1rem + var(--safe-top))',
          paddingLeft: 'calc(0.5rem + var(--safe-left))',
          paddingRight: 'calc(0.5rem + var(--safe-right))',
        }}
        animate={{
          opacity: toolbarVisible ? 1 : 0.3,
          transition: { duration: 0.5, ease: 'easeInOut' },
        }}
      >
        <motion.button
          onClick={onBack}
          className="icon-btn rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </motion.button>
        <span
          className="flex-1 truncate px-1 text-sm font-medium"
          style={{ color: 'var(--color-text)' }}
        >
          {book?.title ?? '阅读中'}
        </span>
        <motion.button
          ref={bookmarkScope}
          onClick={handleBookmarkClick}
          className="icon-btn rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: currentBookmark()?.color ?? 'var(--color-text)' }}
          aria-label="添加书签"
        >
          <Bookmark
            className="h-5 w-5"
            fill={currentBookmark() ? (currentBookmark()!.color) : 'none'}
          />
        </motion.button>
        {/* 取色气泡直接挂在 header 下（header 自身 relative）——锚点是屏幕右缘，不是按钮右缘。
            按钮右侧还排着主题/目录/图鉴/设置 4 个图标，锚按钮右缘会让 270px 宽的气泡
            向左溢出屏幕；触屏下按钮被 .icon-btn 撑到 44px，溢出更严重（<470px 视口即开始，
            360px 机上 5 个色块有 3 个既看不见也点不到）。 */}
        <AnimatePresence>
          {pickerOpen && (
            <>
              <motion.div
                className="fixed inset-0 z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  setPickerOpen(false)
                  history.replaceState({ reader: true }, '')
                }}
              />
              <motion.div
                className="absolute top-full z-20 mt-2 flex gap-2 rounded-2xl px-3 py-2.5"
                style={{
                  // 贴屏幕右缘（含横屏刘海安全区），不再贴按钮右缘
                  right: 'calc(0.5rem + var(--safe-right))',
                  background: toolbarBg,
                  backdropFilter: toolbarBlur,
                  WebkitBackdropFilter: toolbarBlur,
                  boxShadow: 'var(--shadow-float)',
                  border: '1px solid var(--color-separator)',
                }}
                initial={{ scale: 0.7, opacity: 0, y: -8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.7, opacity: 0, y: -8 }}
                transition={springBounce}
              >
                {bookmarkColors.map((c) => (
                  <motion.button
                    key={c.value}
                    className="rounded-full"
                    style={{
                      width: isTouch ? 32 : 22,
                      height: isTouch ? 32 : 22,
                      background: c.value,
                      boxShadow: `0 0 0 2px var(--color-card), 0 2px 8px ${c.value}40`,
                    }}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.9 }}
                    transition={springPress}
                    onClick={() => handlePickColor(c.value)}
                    aria-label={c.name}
                  />
                ))}
                <div
                  className="mx-0.5 self-stretch"
                  style={{
                    width: 1,
                    background: 'var(--color-separator)',
                  }}
                />
                <motion.button
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: isTouch ? 32 : 22,
                    height: isTouch ? 32 : 22,
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-separator)',
                  }}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  transition={springPress}
                  onClick={() => {
                    setPickerOpen(false)
                    history.replaceState({ reader: true }, '')
                  }}
                  aria-label="关闭"
                >
                  <X className="h-2.5 w-2.5" style={{ color: 'var(--color-text-secondary)' }} />
                </motion.button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <motion.button
          onClick={toggleTheme}
          className="icon-btn rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label={isDark ? '切换日间模式' : '切换暗夜模式'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </motion.button>
        <motion.button
          onClick={handleShowToc}
          className="icon-btn rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="目录"
        >
          <List className="h-5 w-5" />
        </motion.button>
        <motion.button
          onClick={async () => {
            await compendiumLoad(bookId)
            compendiumMarkViewed()
            openSidebar('compendium')
          }}
          className="icon-btn relative rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="图鉴"
        >
          <ScrollText className="h-5 w-5" />
          {(() => {
            const hasNew = compendiumEntries.some((e) =>
              e.updatedAt > compendiumLastViewedAt && (
                (e.entries ?? []).some((r) => r.unlocked) ||
                (e.quotations ?? []).some((q) => q.unlocked !== false)
              ),
            )
            return hasNew ? (
              <span
                className="absolute right-2 top-2 block h-2 w-2 rounded-full"
                style={{
                  background: 'var(--comp-accent, #C9A96E)',
                  boxShadow: '0 0 6px var(--comp-accent, #C9A96E)',
                }}
              />
            ) : null
          })()}
        </motion.button>
        <motion.button
          onClick={() => openSidebar('settings')}
          className="icon-btn rounded-full p-2.5"
          whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
          whileTap={{ scale: 0.94 }}
          transition={springPress}
          style={{ color: 'var(--color-text)' }}
          aria-label="设置"
          data-onboarding-id="settings-button"
        >
          <Settings className="h-5 w-5" />
        </motion.button>
      </motion.header>

      {/* 阅读区域 */}
      <div
        className="relative flex-1 overflow-hidden px-4 pb-4 pt-2"
        style={{
          paddingLeft: 'calc(1rem + var(--safe-left))',
          paddingRight: 'calc(1rem + var(--safe-right))',
        }}
      >
        {error && pageInfo.total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              加载失败：{error}
            </p>
            <motion.button
              onClick={onBack}
              className="rounded-full px-5 py-2.5 text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={springPress}
              style={{
                background: 'var(--color-accent)',
                color: '#fff',
              }}
            >
              返回书架
            </motion.button>
          </div>
        ) : (
        <>
        {/* 阅读卡片 — 翻页滑入动效 */}
        <motion.div
          ref={cardScope}
          className="relative mx-auto h-full max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl min-[1800px]:max-w-[1600px]"
          style={{
            background: 'var(--color-card)',
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--shadow-card)',
            ...(settings.pageWidth > 0 ? { maxWidth: settings.pageWidth } : {}),
          }}
          onMouseMove={(e) => {
            resetHideTimer()
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            if (x < 60) setHoveredEdge('left')
            else if (x > rect.width - 60) setHoveredEdge('right')
            else setHoveredEdge(null)
          }}
          onMouseLeave={() => setHoveredEdge(null)}
          onClick={(e) => {
            // 触屏翻页由引擎手势（gesture:tap/swipe）接管，避免与 click 双重翻页
            if (isTouch) return
            const relX = e.clientX - e.currentTarget.getBoundingClientRect().left
            const mid = e.currentTarget.clientWidth / 2
            if (relX < mid) handlePrev()
            else handleNext()
          }}
          data-onboarding-id="page-area"
        >
          {/* 阅读进度条 */}
          {settings.showProgressBar && pageInfo.total > 0 && (
            <div
              className="absolute top-0 left-0 right-0 z-10"
              style={{ height: 3, background: 'var(--color-separator)', borderRadius: 'var(--radius-card) var(--radius-card) 0 0' }}
              role="progressbar"
              aria-valuenow={readProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="阅读进度"
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--color-accent)' }}
                animate={{ width: `${readProgress}%` }}
                transition={{ type: 'spring' as const, bounce: 0, duration: 0.3 }}
              />
            </div>
          )}

          <div ref={containerRef} className="reader-touch h-full w-full" style={{ borderRadius: 'var(--radius-card)' }} />

          {/* 选中文字检索浮窗 */}
          {selData && !selResults && (
            <div
              className="pointer-events-auto fixed z-30"
              style={{ left: Math.max(16, selData.x), top: Math.max(8, selData.y - 44), transform: 'translateX(-50%)' }}
            >
              <motion.button
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium shadow-lg"
                style={{
                  background: 'var(--color-card)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-separator)',
                  whiteSpace: 'nowrap',
                }}
                initial={{ opacity: 0, y: 4, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={springPress}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation()
                  const results = searchEntries(selData.text)
                  if (results.length === 1) {
                    handleShowEntryDetail(results[0].entry.id)
                    setSelData(null)
                  } else {
                    setSelResults(results)
                  }
                }}
              >
                <ScrollText className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                <span className="max-w-[120px] truncate">{selData.text}</span>
              </motion.button>
            </div>
          )}

          {/* 检索结果浮窗 */}
          {selResults && selData && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={(e) => { e.stopPropagation(); setSelData(null); setSelResults(null) }}
              />
              <div
                className="fixed z-40 flex max-h-48 w-56 flex-col overflow-y-auto rounded-2xl p-1.5 shadow-xl"
                style={{
                  left: Math.min(selData.x, window.innerWidth - 240),
                  top: Math.max(8, selData.y - 48 - Math.min(selResults.length * 56, 168)),
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-separator)',
                }}
              >
                {selResults.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    未找到匹配条目
                  </p>
                ) : (
                  selResults.map((r) => (
                    <motion.button
                      key={r.entry.id}
                      className="flex flex-col items-start rounded-xl px-3 py-2.5 text-left"
                      whileHover={{ background: 'var(--color-separator)' }}
                      whileTap={{ scale: 0.98 }}
                      transition={springPress}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleShowEntryDetail(r.entry.id)
                        setSelData(null)
                        setSelResults(null)
                      }}
                    >
                      <span className="truncate text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {r.entry.name}
                      </span>
                      <span
                        className="truncate text-xs"
                        style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
                      >
                        {r.entry.description}
                      </span>
                    </motion.button>
                  ))
                )}
              </div>
            </>
          )}

          {/* 书签标记 — 右侧常驻 */}
          {bookmarks.length > 0 && (
            <div className="pointer-events-none absolute right-1.5 top-2 bottom-2 z-10 flex flex-col">
              {bookmarks.map((bm) => {
                const pct = bm.progress ?? 50
                return (
                  <div
                    key={bm.id}
                    className="pointer-events-auto relative flex items-center"
                    style={{
                      position: 'absolute',
                      top: `${Math.min(95, Math.max(5, pct))}%`,
                      right: 0,
                    }}
                  >
                    <motion.button
                      className="group/dot flex items-center gap-1.5"
                      initial={false}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      transition={springPress}
                      onClick={(e) => {
                        e.stopPropagation()
                        getEngine()?.goToLocation(bm.location)
                      }}
                      aria-label={`跳转到书签：${bm.label}`}
                      style={isTouch ? { padding: 12 } : undefined}
                    >
                      <span
                        className="block rounded-full opacity-30 transition-opacity duration-200 group-hover/dot:opacity-100"
                        style={{
                          width: isTouch ? 12 : 8,
                          height: isTouch ? 12 : 8,
                          background: bm.color,
                          boxShadow: `0 0 6px ${bm.color}60`,
                          opacity: isTouch ? 0.85 : undefined,
                        }}
                      />
                      {/* 触屏下不显示 label（无 hover，且右侧空间宝贵） */}
                      {!isTouch && (
                      <span
                        className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium group-hover/dot:inline-block"
                        style={{
                          background: toolbarBg,
                          backdropFilter: toolbarBlur,
                          WebkitBackdropFilter: toolbarBlur,
                          boxShadow: 'var(--shadow-float)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-separator)',
                        }}
                      >
                        {bm.label}
                      </span>
                      )}
                    </motion.button>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* 左边缘高亮区域 */}
        <motion.div
          className="pointer-events-none absolute left-0 z-10 rounded-l-2xl"
          style={{
            top: 8,
            bottom: 8,
            width: 80,
            background: isDark
              ? 'radial-gradient(ellipse 120% 50% at 8px 50%, rgba(212,153,106,0.22) 0%, rgba(212,153,106,0.08) 45%, transparent 80%)'
              : 'linear-gradient(to right, rgba(184,124,75,0.08), transparent)',
          }}
          animate={{
            opacity: isTouch ? 0 : toolbarVisible ? 0 : hoveredEdge === 'left' ? 1 : 0.4,
          }}
          transition={{ duration: 0.35 }}
        />

        {/* 左翻页按钮 — 全高长条（触屏下隐藏，由手势接管） */}
        <motion.button
          onClick={handlePrev}
          className="absolute left-2 z-10 flex items-center justify-center rounded-2xl px-1"
          style={{
            top: 8,
            bottom: 8,
            pointerEvents: isTouch ? 'none' : 'auto',
            ...navButtonClass,
          }}
          whileHover={{ scale: 1.04, boxShadow: isDark ? '0 0 36px rgba(212,153,106,0.30)' : '0 0 20px rgba(184,124,75,0.18)' }}
          whileTap={{ scale: 0.96 }}
          transition={springDefault}
          animate={{
            opacity: isTouch ? 0 : toolbarVisible ? 0 : hoveredEdge === 'left' ? 0.85 : 0.2,
          }}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </motion.button>

        {/* 右边缘高亮区域 */}
        <motion.div
          className="pointer-events-none absolute right-0 z-10 rounded-r-2xl"
          style={{
            top: 8,
            bottom: 8,
            width: 80,
            background: isDark
              ? 'radial-gradient(ellipse 120% 50% at calc(100% - 8px) 50%, rgba(212,153,106,0.22) 0%, rgba(212,153,106,0.08) 45%, transparent 80%)'
              : 'linear-gradient(to left, rgba(184,124,75,0.08), transparent)',
          }}
          animate={{
            opacity: isTouch ? 0 : toolbarVisible ? 0 : hoveredEdge === 'right' ? 1 : 0.4,
          }}
          transition={{ duration: 0.35 }}
        />

        {/* 右翻页按钮 — 全高长条（触屏下隐藏，由手势接管） */}
        <motion.button
          onClick={handleNext}
          className="absolute right-2 z-10 flex items-center justify-center rounded-2xl px-1"
          style={{
            top: 8,
            bottom: 8,
            pointerEvents: isTouch ? 'none' : 'auto',
            ...navButtonClass,
          }}
          whileHover={{ scale: 1.04, boxShadow: isDark ? '0 0 36px rgba(212,153,106,0.30)' : '0 0 20px rgba(184,124,75,0.18)' }}
          whileTap={{ scale: 0.96 }}
          transition={springDefault}
          animate={{
            opacity: isTouch ? 0 : toolbarVisible ? 0 : hoveredEdge === 'right' ? 0.85 : 0.2,
          }}
          aria-label="下一页"
          data-onboarding-id="page-turn-right"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.button>
        </>
      )}
      </div>

      {/* 页码 — 浮动胶囊（沉浸模式下一并隐去） */}
      <AnimatePresence>
        {pageInfo.total > 0 && !chromeHidden && (
          <motion.div
            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2"
            key={pageKey}
            style={{ bottom: 'calc(1.5rem + var(--safe-bottom))' }}
            initial={{ y: 6, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={springDefault}
          >
            <span
              className="inline-block rounded-full px-3.5 py-1 text-xs font-medium tracking-tight"
              style={{
                background: toolbarBg,
                backdropFilter: toolbarBlur,
                WebkitBackdropFilter: toolbarBlur,
                boxShadow: 'var(--shadow-card)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {pageInfo.current} / {pageInfo.total}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 侧栏 — spring 滑入（目录 / 设置） */}
      <AnimatePresence>
        {sidebarTab !== null && (
          <div className="fixed inset-0 z-20 flex">
            <motion.div
              className="flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ background: 'rgba(60,50,38,0.15)' }}
              onClick={() => {
                setSidebarTab(null)
                history.replaceState({ reader: true }, '')
              }}
            />
            <motion.nav
              className={`${isTouch ? 'w-full max-w-[420px]' : 'w-72'} overflow-y-auto`}
              style={{
                background: toolbarBg,
                backdropFilter: toolbarBlur,
                WebkitBackdropFilter: toolbarBlur,
                borderLeft: '1px solid var(--color-separator)',
                paddingTop: 'var(--safe-top)',
                paddingBottom: 'var(--safe-bottom)',
                paddingRight: 'var(--safe-right)',
              }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={springSlide}
            >
              {/* Tab 栏 + 关闭按钮 */}
              <div
                className="flex items-center border-b px-5 pt-5 pb-0"
                style={{ borderColor: 'var(--color-separator)' }}
              >
                {sidebarTabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={`relative flex-1 pb-3 text-sm font-medium transition-colors ${isTouch ? 'min-h-11' : ''}`}
                    style={{
                      color: sidebarTab === tab.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                    }}
                    onClick={() => setSidebarTab(tab.key)}
                    {...(tab.key === 'compendium' ? { 'data-onboarding-id': 'compendium-tab' } : {})}
                  >
                    {tab.label}
                    {sidebarTab === tab.key && (
                      <motion.div
                        layoutId="sidebar-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                        style={{ background: 'var(--color-accent)' }}
                        transition={springDefault}
                      />
                    )}
                  </button>
                ))}
                {/* 显式关闭按钮：手机上没有 hover 遮罩提示，需要可见的退出入口 */}
                <motion.button
                  onClick={() => {
                    setSidebarTab(null)
                    history.replaceState({ reader: true }, '')
                  }}
                  className="icon-btn mb-2 ml-1 flex-shrink-0 rounded-full"
                  whileHover={{ scale: 1.08, background: 'rgba(60,50,38,0.06)' }}
                  whileTap={{ scale: 0.94 }}
                  transition={springPress}
                  style={{ color: 'var(--color-text)' }}
                  aria-label="关闭侧栏"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* 目录面板 */}
              {sidebarTab === 'toc' && (
                <div className="p-5">
                  {toc.map((item, i) => (
                    <motion.button
                      key={i}
                      className={`block w-full rounded-lg py-2.5 text-left text-sm font-medium ${isTouch ? 'min-h-11' : ''}`}
                      style={{
                        paddingLeft: item.level * 14 + 8,
                        color: 'var(--color-text)',
                      }}
                      whileHover={{ background: 'rgba(60,50,38,0.05)' }}
                      whileTap={{ scale: 0.98 }}
                      transition={springPress}
                      onClick={() => {
                        getEngine()?.goToLocation(item.href)
                        setSidebarTab(null)
                        history.replaceState({ reader: true }, '')
                      }}
                    >
                      {item.label}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* 书签面板 */}
              {sidebarTab === 'bookmarks' && (
                <div className="flex flex-col gap-2.5 p-5">
                  <AnimatePresence>
                    {bookmarks.length === 0 ? (
                      <motion.div
                        className="mt-8 flex flex-col items-center gap-3 text-center"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Bookmark
                          className="h-8 w-8"
                          style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }}
                        />
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          还没有书签哦，读到精彩处打个标记吧
                        </p>
                      </motion.div>
                    ) : (
                      bookmarks.map((bm) => (
                        <motion.div
                          key={bm.id}
                          className="flex items-center overflow-hidden rounded-xl"
                          style={{
                            background: 'var(--color-card)',
                            boxShadow: 'var(--shadow-card)',
                          }}
                          initial={{ opacity: 0, x: 24 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                          transition={springDefault}
                          layout
                        >
                          <div
                            className="h-12 w-1.5 flex-shrink-0 rounded-full"
                            style={{ background: bm.color, marginLeft: 0 }}
                          />
                          <button
                            className={`min-w-0 flex-1 px-3 py-2.5 text-left ${isTouch ? 'min-h-11' : ''}`}
                            onClick={() => {
                              getEngine()?.goToLocation(bm.location)
                              setSidebarTab(null)
                              history.replaceState({ reader: true }, '')
                            }}
                          >
                            <p
                              className="truncate text-sm font-medium"
                              style={{ color: 'var(--color-text)' }}
                            >
                              {bm.label}
                            </p>
                            <p
                              className="text-xs"
                              style={{
                                color: 'var(--color-text-secondary)',
                                fontSize: '0.75rem',
                              }}
                            >
                              {new Date(bm.createdAt).toLocaleString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </button>
                          <motion.button
                            className="icon-btn flex-shrink-0 rounded-full p-2.5"
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            transition={springPress}
                            style={{ color: 'var(--color-text-secondary)' }}
                            onClick={() => removeBookmark(bm.id)}
                            aria-label="删除书签"
                          >
                            <X className="h-3.5 w-3.5" />
                          </motion.button>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* 图鉴面板 */}
              {sidebarTab === 'compendium' && (
                <div className="flex flex-col" style={{ height: 'calc(100% - 56px)' }}>
                  {/* 分类切换 */}
                  <div className="flex gap-1 p-4 pb-2">
                    {([
                      { key: 'character' as const, label: '人物', icon: User },
                      { key: 'location' as const, label: '地点', icon: MapPin },
                      { key: 'monster' as const, label: '怪物', icon: Skull },
                    ]).map((cat) => (
                      <motion.button
                        key={cat.key}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium"
                        style={{
                          background: compendiumCategory === cat.key ? 'var(--color-accent)' : 'var(--color-card)',
                          color: compendiumCategory === cat.key ? '#fff' : 'var(--color-text)',
                          border: compendiumCategory === cat.key ? 'none' : '1px solid var(--color-separator)',
                        }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={springPress}
                        onClick={() => { setCompendiumCategory(cat.key); setCompendiumSearch('') }}
                      >
                        <cat.icon className="h-3.5 w-3.5" />
                        {cat.label}
                      </motion.button>
                    ))}
                  </div>
                  {/* 搜索栏 */}
                  <div className="px-4 pb-2">
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2"
                      style={{
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-separator)',
                      }}
                    >
                      <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
                      <input
                        type="text"
                        placeholder={`搜索${compendiumCategory === 'character' ? '人物' : compendiumCategory === 'location' ? '地点' : '怪物'}...`}
                        value={compendiumSearch}
                        onChange={(e) => setCompendiumSearch(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        style={{ color: 'var(--color-text)' }}
                      />
                      {compendiumSearch && (
                        <motion.button
                          className="flex-shrink-0 rounded-full p-0.5"
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setCompendiumSearch('')}
                          aria-label="清除搜索"
                        >
                          <X className="h-3.5 w-3.5" style={{ color: 'var(--color-text-secondary)' }} />
                        </motion.button>
                      )}
                    </div>
                  </div>
                  {/* 条目列表 */}
                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {(() => {
                      const searchQuery = debouncedSearch.trim()
                      const filtered = searchQuery
                        ? searchEntries(searchQuery, compendiumCategory)
                        : getEntriesByCategory(compendiumCategory).map((e) => ({ entry: e, score: 0 }))
                      if (filtered.length === 0) {
                        const totalImported = compendiumEntries.filter((e) => e.category === compendiumCategory).length
                        if (totalImported === 0) {
                          return (
                            <div className="mt-8 flex flex-col items-center gap-3 px-2 text-center">
                              <ScrollText
                                className="h-7 w-7"
                                style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }}
                              />
                              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                暂无图鉴数据
                              </p>
                              <p className="text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.7, lineHeight: 1.8 }}>
                                ① 下载写作指南 → ② 发给 AI 生成 JSON → ③ 导入
                              </p>
                              <div className="flex items-center gap-2">
                                <a
                                  href="/guides/compendium-guide.md"
                                  download
                                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
                                  style={{
                                    background: 'var(--color-card)',
                                    color: 'var(--color-text)',
                                    border: '1px solid var(--color-separator)',
                                  }}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  下载指南
                                </a>
                                <motion.button
                                  className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
                                  style={{
                                    background: 'var(--color-accent)',
                                    color: '#fff',
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  transition={springPress}
                                  onClick={handleImportJSON}
                                >
                                  <Upload className="h-3.5 w-3.5" />
                                  导入 JSON
                                </motion.button>
                              </div>
                              <a
                                href="/guides/compendium-readme.md"
                                download
                                className="text-xs underline underline-offset-2"
                                style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}
                              >
                                使用说明
                              </a>
                            </div>
                          )
                        }
                        if (searchQuery) {
                          return (
                            <div className="mt-8 flex flex-col items-center gap-3 px-2 text-center">
                              <Search
                                className="h-7 w-7"
                                style={{ color: 'var(--color-text-secondary)', opacity: 0.4 }}
                              />
                              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                未找到匹配条目
                              </p>
                            </div>
                          )
                        }
                        return (
                          <div className="mt-8 flex flex-col items-center gap-3 px-2 text-center">
                            <ScrollText
                              className="h-7 w-7"
                              style={{ color: 'var(--comp-accent, #C9A96E)', opacity: 0.5 }}
                            />
                            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                              继续阅读以发现{compendiumCategory === 'character' ? '人物' : compendiumCategory === 'location' ? '地点' : '怪物'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>
                              随着剧情推进，你遇到的角色、怪物和地点将逐一在此解锁
                            </p>
                          </div>
                        )
                      }
                      const visible = filtered.slice(0, visibleCount)
                      return (
                        <>
                          {visible.map(({ entry }, i) => {
                            const unlockedCount = (entry.entries ?? []).filter((r) => r.unlocked).length
                            const totalCount = (entry.entries ?? []).length
                            return (
                              <motion.button
                                key={entry.id}
                                className="mb-2 flex w-full items-center gap-3 rounded-xl p-2.5 text-left"
                                style={{
                                  background: 'var(--color-card)',
                                  boxShadow: 'var(--shadow-card)',
                                }}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ ...springDefault, delay: Math.min(i * 0.04, 0.5) }}
                                whileHover={{ y: -1, boxShadow: 'var(--shadow-float)' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleShowEntryDetail(entry.id)}
                              >
                                <div
                                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
                                  style={{ background: 'var(--color-separator)' }}
                                >
                                  {entry.image ? (
                                    <img src={entry.image} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
                                  ) : (
                                    entry.category === 'character' ? <User className="h-5 w-5" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} /> :
                                    entry.category === 'location' ? <MapPin className="h-5 w-5" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} /> :
                                    <Skull className="h-5 w-5" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="truncate text-[0.9375rem] font-medium"
                                    style={{ color: 'var(--color-text)' }}
                                  >
                                    {entry.name}
                                  </p>
                                  <p
                                    className="truncate text-[0.8125rem]"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                  >
                                    {entry.description}
                                  </p>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-1">
                                  <span
                                    className="text-xs font-medium"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                  >
                                    {unlockedCount}/{totalCount}
                                  </span>
                                  {totalCount > 0 && (
                                    <div
                                      className="h-1 w-8 overflow-hidden rounded-full"
                                      style={{ background: 'var(--color-separator)' }}
                                    >
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${(unlockedCount / totalCount) * 100}%`,
                                          background: 'var(--color-accent)',
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </motion.button>
                            )
                          })}
                          {filtered.length > visibleCount && (
                            <motion.button
                              className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium"
                              style={{
                                color: 'var(--comp-accent, #C9A96E)',
                                border: '1px dashed var(--comp-separator)',
                              }}
                              whileHover={{ background: 'var(--comp-card)' }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setVisibleCount((v) => v + 50)}
                            >
                              加载更多 ({filtered.length - visibleCount})
                            </motion.button>
                          )}
                        </>
                      )
                    })()}
                    {/* 底部常驻入口 — 有数据后仍然可见 */}
                    {compendiumEntries.length > 0 && (
                      <div className="mt-4 flex items-center justify-center gap-3 border-t pt-4" style={{ borderColor: 'var(--color-separator)' }}>
                        <a
                          href="/guides/compendium-guide.md"
                          download
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
                          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-separator)' }}
                        >
                          <Download className="h-3 w-3" />
                          写作指南
                        </a>
                        <a
                          href="/guides/compendium-schema.md"
                          download
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
                          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-separator)' }}
                        >
                          <Download className="h-3 w-3" />
                          字段速查
                        </a>
                        <a
                          href="/guides/compendium-readme.md"
                          download
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
                          style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-separator)' }}
                        >
                          <Download className="h-3 w-3" />
                          使用说明
                        </a>
                        <motion.button
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs"
                          style={{
                            background: 'var(--color-accent)',
                            color: '#fff',
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={springPress}
                          onClick={handleImportJSON}
                        >
                          <Upload className="h-3 w-3" />
                          重新导入
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 设置面板 */}
              {sidebarTab === 'settings' && (
                <div className="flex flex-col gap-6 p-5">
                  {/* 字号 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      字号
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>12</span>
                      <input
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        value={settings.fontSize}
                        onChange={(e) => handleSettingsChange({ fontSize: Number(e.target.value) })}
                        className="flex-1"
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>24</span>
                    </div>
                    <p
                      className="mt-1 text-center text-xs"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {settings.fontSize}px
                    </p>
                  </div>

                  {/* 字体 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      字体
                    </p>
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => handleSettingsChange({ fontFamily: e.target.value })}
                      className="w-full rounded-lg px-3 py-2.5 text-sm font-medium"
                      style={{
                        background: 'var(--color-card)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-separator)',
                      }}
                    >
                      <option value="">系统默认</option>
                      <option value="serif">宋体</option>
                      <option value="'KaiTi', 'STKaiti', serif">楷体</option>
                      <option value="'SimHei', 'Heiti SC', sans-serif">黑体</option>
                    </select>
                  </div>

                  {/* 行间距 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      行间距
                    </p>
                    <div className="flex gap-2">
                      {[
                        { label: '紧凑', value: 1.4 },
                        { label: '标准', value: 1.8 },
                        { label: '宽松', value: 2.2 },
                      ].map((opt) => (
                        <motion.button
                          key={opt.value}
                          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium"
                          style={{
                            background: settings.lineHeight === opt.value ? 'var(--color-accent)' : 'var(--color-card)',
                            color: settings.lineHeight === opt.value ? '#fff' : 'var(--color-text)',
                            border: settings.lineHeight === opt.value ? 'none' : '1px solid var(--color-separator)',
                          }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          transition={springPress}
                          onClick={() => handleSettingsChange({ lineHeight: opt.value })}
                        >
                          {opt.label}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* 页面主题 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      页面主题
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAGE_THEME_PRESETS.map((preset) => {
                        const isActive = settings.pageTheme.background === preset.background
                          && settings.pageTheme.text === preset.text
                        return (
                          <motion.button
                            key={preset.id}
                            className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1"
                            style={{
                              background: isActive ? 'var(--color-accent)' : 'var(--color-card)',
                              color: isActive ? '#fff' : 'var(--color-text)',
                              border: isActive ? 'none' : '1px solid var(--color-separator)',
                            }}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            transition={springPress}
                            onClick={() => handleSettingsChange({
                              pageTheme: { background: preset.background, text: preset.text },
                            })}
                          >
                            <div
                              className="flex h-8 w-full items-center justify-center rounded-md text-[0.625rem] font-medium"
                              style={{
                                background: preset.background,
                                color: preset.text,
                                border: isActive ? '2px solid rgba(255,255,255,0.5)' : '1px solid var(--color-separator)',
                              }}
                            >
                              Aa
                            </div>
                            <span className="text-[0.6875rem] leading-tight">{preset.nameZh}</span>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 页面布局 */}
                  <div>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      页面布局
                    </p>

                    {/* 宽度档位 — 分段控制器 */}
                    <div
                      className="relative flex rounded-lg p-0.5"
                      style={{ background: 'var(--color-separator)' }}
                    >
                      {([
                        { label: '紧凑', value: 600 },
                        { label: '标准', value: 800 },
                        { label: '宽阔', value: 1100 },
                        { label: '自适应', value: 0 },
                      ] as const).map((opt) => {
                        const active = settings.pageWidth === opt.value
                        return (
                          <motion.button
                            key={opt.value}
                            className="relative flex-1 rounded-md py-2 text-sm font-medium"
                            style={{ color: active ? 'var(--color-text)' : 'var(--color-text-secondary)' }}
                            whileTap={{ scale: 0.96 }}
                            transition={springPress}
                            onClick={() => handleSettingsChange({ pageWidth: opt.value })}
                          >
                            {active && (
                              <motion.div
                                layoutId="page-width-indicator"
                                className="absolute inset-1 rounded-sm"
                                style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
                                transition={springDefault}
                              />
                            )}
                            <span className="relative z-10">{opt.label}</span>
                          </motion.button>
                        )
                      })}
                    </div>

                    {/* 单页模式 — toggle */}
                    <div className="mt-4 flex items-center justify-between">
                      <p
                        className="text-xs font-medium tracking-[0.005em]"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        单页模式
                      </p>
                      <motion.button
                        className="relative flex h-7 w-11 items-center rounded-full"
                        style={{
                          background: settings.columnMode === 'single' ? 'var(--color-accent)' : 'var(--color-separator)',
                        }}
                        whileTap={{ scale: 0.94 }}
                        transition={springPress}
                        onClick={() => handleSettingsChange({
                          columnMode: settings.columnMode === 'single' ? 'auto' : 'single',
                        })}
                        role="switch"
                        aria-checked={settings.columnMode === 'single'}
                        aria-label="单页模式"
                      >
                        <motion.div
                          className="h-5 w-5 rounded-full bg-white shadow-sm"
                          animate={{ x: settings.columnMode === 'single' ? 20 : 3 }}
                          transition={{ type: 'spring' as const, bounce: 0, duration: 0.25 }}
                        />
                      </motion.button>
                    </div>
                  </div>

                  {/* 进度条开关 */}
                  <div className="flex items-center justify-between">
                    <p
                      className="text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      阅读进度条
                    </p>
                    <motion.button
                      className="relative flex h-7 w-11 items-center rounded-full"
                      style={{
                        background: settings.showProgressBar ? 'var(--color-accent)' : 'var(--color-separator)',
                      }}
                      whileTap={{ scale: 0.94 }}
                      transition={springPress}
                      onClick={() => handleSettingsChange({ showProgressBar: !settings.showProgressBar })}
                      role="switch"
                      aria-checked={settings.showProgressBar}
                      aria-label="阅读进度条"
                    >
                      <motion.div
                        className="h-5 w-5 rounded-full bg-white shadow-sm"
                        animate={{ x: settings.showProgressBar ? 20 : 3 }}
                        transition={{ type: 'spring' as const, bounce: 0, duration: 0.25 }}
                      />
                    </motion.button>
                  </div>

                  {/* 位置接力 —— 跨设备手动搬运阅读位置（无需云同步） */}
                  <div className="border-t pt-6" style={{ borderColor: 'var(--color-separator)' }}>
                    <p
                      className="mb-2 text-xs font-medium tracking-[0.005em]"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      位置接力
                    </p>
                    <p
                      className="mb-3 text-xs leading-[1.7]"
                      style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}
                    >
                      换设备阅读时：先在这里生成并复制短码，在另一台设备打开同一本书后，粘贴到下框里即可直达。
                    </p>

                    {/* 生成短码 */}
                    <motion.button
                      className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium ${isTouch ? 'min-h-11' : ''}`}
                      style={{
                        background: relayReady ? 'var(--color-accent)' : 'var(--color-separator)',
                        color: relayReady ? '#fff' : 'var(--color-text-secondary)',
                      }}
                      whileHover={relayReady ? { scale: 1.02 } : undefined}
                      whileTap={relayReady ? { scale: 0.98 } : undefined}
                      transition={springPress}
                      onClick={handleGenerateRelayCode}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {relayReady ? '生成短码' : '定位点生成中…'}
                    </motion.button>

                    {relayCode && (
                      <div className="mt-3">
                        <div
                          className="select-text rounded-xl px-3 py-2.5 text-center text-sm tracking-[0.15em]"
                          style={{
                            background: 'var(--color-card)',
                            border: '1px solid var(--color-separator)',
                            color: 'var(--color-text)',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                          }}
                        >
                          {relayCode}
                        </div>
                        <motion.button
                          className={`mt-2 flex w-full items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs ${isTouch ? 'min-h-11' : ''}`}
                          style={{ color: 'var(--color-text)', border: '1px solid var(--color-separator)' }}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          transition={springPress}
                          onClick={() => copyRelayText(relayCode, '短码已复制')}
                        >
                          <Copy className="h-3 w-3" />
                          复制短码
                        </motion.button>
                      </div>
                    )}

                    {/* 输入短码（百分比等也认） */}
                    <textarea
                      className={`mt-4 w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none ${isTouch ? 'min-h-11' : ''}`}
                      style={{
                        background: 'var(--color-card)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-separator)',
                      }}
                      rows={3}
                      placeholder="粘贴短码 / 百分比…"
                      value={relayInput}
                      onChange={(e) => setRelayInput(e.target.value)}
                    />
                    <motion.button
                      className={`mt-2 flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium ${isTouch ? 'min-h-11' : ''}`}
                      style={{
                        background: 'var(--color-accent)',
                        color: '#fff',
                        opacity: relayInput.trim() ? 1 : 0.5,
                      }}
                      whileHover={relayInput.trim() ? { scale: 1.02 } : undefined}
                      whileTap={relayInput.trim() ? { scale: 0.98 } : undefined}
                      transition={springPress}
                      onClick={handleRelayJump}
                      disabled={!relayInput.trim()}
                    >
                      跳转
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.nav>
          </div>
        )}
      </AnimatePresence>

      {/* 图鉴详情浮层 */}
      <AnimatePresence>
        {detailEntry && (
          <motion.div
            className="compendium-overlay fixed inset-0 z-30 flex flex-col overflow-y-auto"
            style={{ background: 'var(--comp-bg)' }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={springSlide}
          >
            {/* 返回按钮 */}
            <div className="sticky top-0 z-10 py-2"
              style={{
                background: 'rgba(60, 46, 36, 0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                // 独立全屏浮层：顶部避开状态栏/刘海，否则返回键和字号键落入防误触区。
                // 左右仅横屏刘海时需要（竖屏 cutout 为 0），基数为 0 以免与内层 px-3 叠加。
                paddingTop: 'calc(0.5rem + var(--safe-top))',
                paddingLeft: 'var(--safe-left)',
                paddingRight: 'var(--safe-right)',
              }}
            >
              <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-3">
              <motion.button
                className="rounded-full p-2"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={springPress}
                style={{ color: 'var(--comp-text)' }}
                onClick={() => {
                  setDetailEntryId(null)
                  setSidebarTab('compendium')
                  history.replaceState({ reader: true, sidebar: 'compendium' }, '')
                }}
                aria-label="返回图鉴列表"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>
              <span className="text-sm font-medium" style={{ color: 'var(--comp-text-secondary)' }}>
                图鉴
              </span>
              <div className="ml-3 flex items-center gap-1">
                {(() => {
                  const scales = [0.85, 1.0, 1.15, 1.3]
                  const current = settings.compendiumFontScale
                  const idx = scales.indexOf(current)
                  const prev = idx > 0 ? scales[idx - 1] : null
                  const next = idx < scales.length - 1 ? scales[idx + 1] : null
                  return (
                    <div
                      className="flex items-center rounded-full px-0.5 py-0.5"
                      style={{ background: 'var(--comp-separator)' }}
                    >
                      <motion.button
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        whileTap={{ scale: 0.88 }}
                        transition={springPress}
                        style={{ color: prev != null ? 'var(--comp-text-secondary)' : 'var(--comp-blur-text)' }}
                        disabled={prev == null}
                        onClick={() => prev != null && updateSettings({ compendiumFontScale: prev })}
                        aria-label="缩小字号"
                      >
                        <span className="text-[0.625rem] font-semibold leading-none">A</span>
                      </motion.button>
                      <div className="flex items-center gap-[3px] px-2">
                        {scales.map((_, i) => (
                          <div
                            key={i}
                            className="h-[3px] w-[3px] rounded-full transition-colors duration-200"
                            style={{
                              background: i <= idx ? 'var(--comp-accent)' : 'var(--comp-blur-text)',
                            }}
                          />
                        ))}
                      </div>
                      <motion.button
                        className="flex h-6 w-6 items-center justify-center rounded-full"
                        whileTap={{ scale: 0.88 }}
                        transition={springPress}
                        style={{ color: next != null ? 'var(--comp-text-secondary)' : 'var(--comp-blur-text)' }}
                        disabled={next == null}
                        onClick={() => next != null && updateSettings({ compendiumFontScale: next })}
                        aria-label="放大字号"
                      >
                        <span className="text-[0.8125rem] font-semibold leading-none">A</span>
                      </motion.button>
                    </div>
                  )
                })()}
              </div>
              <div className="flex-1" />
              <motion.button
                className="rounded-full p-2"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={springPress}
                style={{ color: 'var(--comp-text)' }}
                onClick={() => {
                  setDetailEntryId(null)
                  setSidebarTab('compendium')
                  history.replaceState({ reader: true, sidebar: 'compendium' }, '')
                }}
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </motion.button>
              </div>
            </div>

            {/* 肖像图 */}
            {detailEntry.image ? (
              <div className="mx-auto w-full max-w-2xl">
                <div className="relative w-full" style={{ aspectRatio: '16/10', maxHeight: '40vh' }}>
                  <img
                    src={detailEntry.image}
                    alt={detailEntry.name}
                    className="h-full w-full object-cover"
                  />
                  <div
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      height: '40%',
                      background: 'linear-gradient(to top, var(--comp-bg), transparent)',
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="h-6" />
            )}

            <div
              className="mx-auto w-full max-w-2xl px-5 min-[1800px]:max-w-[1300px]"
              style={{
                zoom: settings.compendiumFontScale,
                paddingBottom: 'calc(2.5rem + var(--safe-bottom))',
                paddingLeft: 'calc(1.25rem + var(--safe-left))',
                paddingRight: 'calc(1.25rem + var(--safe-right))',
              }}
            >
              {/* 名字 */}
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{
                  color: 'var(--comp-accent)',
                  fontFamily: 'Georgia, "Noto Serif", serif',
                }}
              >
                {detailEntry.name}
              </h1>

              {/* 别名 */}
              {detailEntry.aliases.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {detailEntry.aliases.map((a) => (
                    <span
                      key={a}
                      className="rounded-full px-2.5 py-0.5 text-xs"
                      style={{
                        background: 'var(--comp-separator)',
                        color: 'var(--comp-text-secondary)',
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {/* 描述 */}
              <p
                className="mt-4 text-[0.9375rem] leading-[1.7]"
                style={{ color: 'var(--comp-text)' }}
              >
                {detailEntry.description}
              </p>

              {/* 双栏区域：历史+关联 | 引述+日志 */}
              <div className="min-[1800px]:grid min-[1800px]:grid-cols-2 min-[1800px]:gap-10 min-[1800px]:mt-5">
                <div>
              {/* 历史 */}
              {detailEntry.history && (
                <div className="mt-5 min-[1800px]:mt-0">
                  <h3
                    className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--comp-text-secondary)' }}
                  >
                    历史
                  </h3>
                  <p
                    className="text-[0.9375rem] leading-[1.7]"
                    style={{ color: 'var(--comp-text)' }}
                  >
                    {detailEntry.history}
                  </p>
                </div>
              )}

              {/* 关联条目 */}
              {detailEntry.relations.length > 0 && (
                <div className="mt-6">
                  <h3
                    className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--comp-text-secondary)' }}
                  >
                    相关{detailEntry.category === 'character' ? '人物' : detailEntry.category === 'location' ? '地点' : '怪物'}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const sorted = [...detailEntry.relations].sort((a, b) => {
                        const aTarget = getEntryById(a.targetId)
                        const bTarget = getEntryById(b.targetId)
                        const aScore = (aTarget?.entries.length ?? 0) + (globalRefCount.get(a.targetId) ?? 0)
                        const bScore = (bTarget?.entries.length ?? 0) + (globalRefCount.get(b.targetId) ?? 0)
                        return bScore - aScore
                      })
                      const MAX_VISIBLE = 8
                      const visible = relationsExpanded ? sorted : sorted.slice(0, MAX_VISIBLE)
                      const hiddenCount = sorted.length - MAX_VISIBLE
                      return (
                        <>
                          {visible.map((rel) => {
                            const target = getEntryById(rel.targetId)
                            return (
                              <motion.button
                                key={rel.targetId}
                                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-left"
                                style={{
                                  background: 'var(--comp-card)',
                                  border: target ? '1px solid var(--comp-separator)' : 'none',
                                }}
                                whileHover={{ y: -1, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                                whileTap={{ scale: 0.96 }}
                                transition={springPress}
                                onClick={() => {
                                  if (target) handleShowEntryDetail(target.id)
                                }}
                                disabled={!target}
                              >
                                <span className="text-[0.8125rem] font-medium max-w-[120px] truncate" style={{ color: target ? 'var(--comp-text)' : 'var(--comp-blur-text)' }}>
                                  {target?.name ?? rel.targetId}
                                </span>
                                <span className="text-[0.6875rem] opacity-60" style={{ color: 'var(--comp-accent)' }}>
                                  {rel.label}
                                </span>
                              </motion.button>
                            )
                          })}
                          {!relationsExpanded && hiddenCount > 0 && (
                            <motion.button
                              className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-[0.8125rem]"
                              style={{ color: 'var(--comp-accent)', border: '1px dashed var(--comp-separator)' }}
                              whileHover={{ background: 'var(--comp-separator)' }}
                              whileTap={{ scale: 0.96 }}
                              transition={springPress}
                              onClick={() => setRelationsExpanded(true)}
                            >
                              展开全部 ({hiddenCount})
                            </motion.button>
                          )}
                          {relationsExpanded && hiddenCount > 0 && (
                            <motion.button
                              className="inline-flex items-center rounded-lg px-2.5 py-1.5 text-[0.8125rem]"
                              style={{ color: 'var(--comp-text-secondary)', border: '1px dashed var(--comp-separator)' }}
                              whileHover={{ background: 'var(--comp-separator)' }}
                              whileTap={{ scale: 0.96 }}
                              transition={springPress}
                              onClick={() => setRelationsExpanded(false)}
                            >
                              收起
                            </motion.button>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
                </div>
                <div>

              {/* 文献引述 */}
              {(detailEntry.quotations ?? []).length > 0 && (
                <div className="mt-6 min-[1800px]:mt-0">
                  <h3
                    className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--comp-text-secondary)' }}
                  >
                    文献引述
                  </h3>
                  <div className="flex flex-col gap-5">
                    {(detailEntry.quotations ?? []).map((q, i) => (
                      <div
                        key={i}
                        className="relative"
                        style={{
                          paddingLeft: 16,
                          borderLeft: '2px solid var(--comp-separator)',
                          filter: q.unlocked !== false ? 'none' : 'blur(2px)',
                          userSelect: q.unlocked !== false ? 'text' : 'none',
                        }}
                      >
                        <p
                          className="text-[0.9375rem] leading-[1.7]"
                          style={{
                            color: q.unlocked !== false ? 'var(--comp-text)' : 'var(--comp-blur-text)',
                            fontStyle: 'italic',
                            fontFamily: 'Georgia, "Noto Serif", serif',
                          }}
                        >
                          {q.unlocked !== false ? q.text : '继续阅读以解锁此引述……'}
                        </p>
                        <p
                          className="mt-2 text-right text-[0.8125rem] font-medium"
                          style={{ color: 'var(--comp-text-secondary)' }}
                        >
                          {q.unlocked !== false ? q.attribution : '——？？？'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 发现日志 */}
              {(detailEntry.entries ?? []).length > 0 && (
                <div className="mt-6 min-[1800px]:mt-6">
                  <h3
                    className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--comp-text-secondary)' }}
                  >
                    发现日志
                  </h3>
                  <div className="relative pl-5" style={{ borderLeft: '1px solid var(--comp-separator)' }}>
                    {(detailEntry.entries ?? []).map((rev, i) => {
                      const isLatestUnlocked = rev.unlocked &&
                        rev.chapter === useCompendiumStore.getState().currentChapter
                      return (
                        <div key={i} className="relative mb-5 last:mb-0">
                          <div
                            className="absolute -left-[22px] top-[3px] h-2.5 w-2.5 rounded-full border-2"
                            style={{
                              background: rev.unlocked ? 'var(--comp-accent)' : 'transparent',
                              borderColor: rev.unlocked ? 'var(--comp-accent)' : 'var(--comp-blur-text)',
                              boxShadow: isLatestUnlocked ? '0 0 8px var(--comp-accent)' : 'none',
                            }}
                          />
                          <span
                            className="text-[0.8125rem] font-semibold"
                            style={{ color: rev.unlocked ? 'var(--comp-accent)' : 'var(--comp-blur-text)' }}
                          >
                            第 {rev.chapter} 章
                          </span>
                          <p
                            className="mt-1 text-[0.9375rem] leading-[1.7]"
                            style={{
                              color: rev.unlocked ? 'var(--comp-text)' : 'var(--comp-blur-text)',
                              filter: rev.unlocked ? 'none' : 'blur(2px)',
                              userSelect: rev.unlocked ? 'text' : 'none',
                            }}
                          >
                            {rev.unlocked ? rev.text : '继续阅读以解锁此条目……'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
