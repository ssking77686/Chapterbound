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
  const saveProgress = useProgressStore((s) => s.saveProgress)
  const loadProgress = useProgressStore((s) => s.loadProgress)
  const [pageInfo, setPageInfo] = useState<PageInfo>({ current: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    let pendingSpine = -1
    const init = async () => {
      const storage = registry.getStorage()
      const data = await storage.getFileData(bookId)
      if (!data || !containerRef.current || cancelled) return

      const engine = new EpubEngine()
      engineRef.current = engine

      // 监听器必须在 load() 之前注册——load() 内部会触发 relocated 和 ready 事件
      engine.on('locationChange', (loc: unknown, prog: unknown, page?: unknown, total?: unknown, spineIndex?: unknown) => {
        saveProgress(bookId, loc as string, prog as number)
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

      await engine.load(data, containerRef.current)

      if (cancelled) {
        engine.destroy()
        return
      }

      // load() 完成后初始化 chapterMap 和 compendium
      const settings = useSettingsStore.getState().settings
      engine.applySettings(settings)

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

      loadProgress(bookId).then(() => {
        const p = useProgressStore.getState().current
        if (p?.location) {
          engine.goToLocation(p.location)
        }
      })
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
  const applySettings = useCallback((settings: { fontSize: number; fontFamily: string; lineHeight: number }) => {
    engineRef.current?.applySettings(settings)
  }, [])

  // 窗口 resize 时重新分页
  useEffect(() => {
    const el = containerRef.current
    if (!el || pageInfo.total === 0) return

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) engineRef.current?.resize(rect.width, rect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageInfo.total, containerRef])

  return { nextPage, prevPage, getEngine, pageInfo, applySettings }
}
