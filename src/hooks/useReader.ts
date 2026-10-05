import { useEffect, useRef, useCallback, useState } from 'react'
import { EpubEngine } from '../engines/EpubEngine'
import { registry } from '../core/registry'
import { useProgressStore } from '../stores/progressStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useCompendiumStore } from '../stores/compendiumStore'

export interface PageInfo {
  current: number
  total: number
}

export function useReader(bookId: string, containerRef: React.RefObject<HTMLDivElement | null>) {
  const engineRef = useRef<EpubEngine | null>(null)
  const chapterMapRef = useRef<Map<number, number>>(new Map())
  const lastChapterRef = useRef(0)
  const lastSaveRef = useRef(0)
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const saveProgress = useProgressStore((s) => s.saveProgress)
  const loadProgress = useProgressStore((s) => s.loadProgress)
  const [pageInfo, setPageInfo] = useState<PageInfo>({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  /** 重排用的锚点（阅读位置），以及它在此期间保持不动的截止时刻 —— 见 locationChange 里的注释 */
  const anchorRef = useRef('')
  const holdAnchorUntil = useRef(0)

  useEffect(() => {
    let cancelled = false
    let pendingSpine = -1
    const init = async () => {
      const storage = registry.getStorage()
      const data = await storage.getFileData(bookId)
      if (!data || !containerRef.current || cancelled) return

      const engine = new EpubEngine()
      engineRef.current = engine

      try {
        // 监听器必须在 load() 之前注册——load() 内部会触发 relocated 和 ready 事件
        engine.on('locationChange', (loc: unknown, prog: unknown, page?: unknown, total?: unknown, spineIndex?: unknown) => {
          // 维护重排用的锚点：平时跟着每一次 relocated 走（用户翻页也就跟着更新），
          // 但**重排期间不动** —— 重排 + 钉位置会先落到目标页的页首（比锚点靠前一点），
          // 紧接着还会有一次 RO；如果那一刻把页首值当成新锚点，下一轮就会从那儿再往前退，逐次累积。
          if (Date.now() > holdAnchorUntil.current) anchorRef.current = loc as string

          // 节流进度保存：最多每秒写一次，快速翻页时排队尾次
          const now = Date.now()
          if (now - lastSaveRef.current >= 1000) {
            lastSaveRef.current = now
            saveProgress(bookId, loc as string, prog as number).catch(() => {})
          } else {
            clearTimeout(pendingSaveRef.current)
            pendingSaveRef.current = setTimeout(() => {
              lastSaveRef.current = Date.now()
              saveProgress(bookId, loc as string, prog as number).catch(() => {})
            }, 500)
          }
          if (typeof page === 'number' && typeof total === 'number') {
            setPageInfo({ current: page, total })
          }

          if (typeof spineIndex === 'number') {
            pendingSpine = spineIndex
            const chapter = chapterMapRef.current.get(spineIndex)
            if (chapter !== undefined && chapter !== lastChapterRef.current) {
              lastChapterRef.current = chapter
              useCompendiumStore.getState().checkUnlock(chapter)
            }
          }
        })

        // 先加载阅读进度，直接传入 display() 避免首页闪烁
        await loadProgress(bookId)
        const savedLoc = useProgressStore.getState().current?.location
        await engine.load(data, containerRef.current, savedLoc)

        if (cancelled) {
          engine.destroy()
          return
        }

        // load() 完成后初始化 chapterMap 和 compendium
        const settings = useSettingsStore.getState().settings
        engine.applySettings(settings)
        engine.setPageColors(settings.pageTheme)
        engine.setColumnMode(settings.columnMode)

        chapterMapRef.current = await engine.getChapterMap()
        useCompendiumStore.getState().loadCompendium(bookId).catch(() => {})

        // 补检初始章节（load 期间的 relocated 可能在 chapterMap 为空时已触发）
        const savedIndex = pendingSpine
        if (savedIndex >= 0) {
          const chapter = chapterMapRef.current.get(savedIndex)
          if (chapter !== undefined && chapter !== lastChapterRef.current) {
            lastChapterRef.current = chapter
            useCompendiumStore.getState().checkUnlock(chapter)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      }
    }

    init()
    return () => {
      cancelled = true
      engineRef.current?.destroy()
    }
  }, [bookId, containerRef, saveProgress, loadProgress])

  const nextPage = useCallback(() => engineRef.current?.nextPage(), [])
  const prevPage = useCallback(() => engineRef.current?.prevPage(), [])
  const getEngine = useCallback(() => engineRef.current, [])
  const getCurrentChapter = useCallback(() => lastChapterRef.current, [])
  const applySettings = useCallback((settings: { fontSize: number; fontFamily: string; lineHeight: number }) => {
    engineRef.current?.applySettings(settings)
  }, [])

  // 窗口 resize 时重新分页
  useEffect(() => {
    const el = containerRef.current
    if (!el || pageInfo.total === 0) return

    // 一次重排会**连续触发多次** RO（卡片逐帧变高、转屏时视口分几步落定、重排本身还会再触发一次），
    // 所以尺寸去抖，一串变化只让 epub.js 重排一次。
    // 锚点则由 anchorRef 统一维护：它在重排期间被锁住（见 locationChange 的注释），
    // 只在这里读、不在这里重抓 —— 抓在重排进行中的值一定是已经漂过的。
    let timer: ReturnType<typeof setTimeout> | undefined
    let latest: { width: number; height: number } | null = null

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const engine = engineRef.current
      if (!engine) return

      latest = { width: rect.width, height: rect.height }
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!latest) return
        const cfi = anchorRef.current
        holdAnchorUntil.current = Date.now() + 1500
        // 重排后"第 N 页"对应的文字已经不一样了，得回到**同一处文字**而不是同一个页码：
        // 只改视口高 40px，实测阅读位置就退了 18 个段落。转屏 / 分屏 / 软键盘 / 沉浸模式同路。
        // resize 的第三个参数 epub.js 支持但 d.ts 没写；光带它还不够，必须配套 pinAfterResize。
        engine.resize(latest.width, latest.height, cfi || undefined)
        engine.pinAfterResize(cfi)
      }, 180)
    })
    ro.observe(el)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
  }, [pageInfo.total, containerRef])

  return { nextPage, prevPage, getEngine, getCurrentChapter, pageInfo, applySettings, error }
}
