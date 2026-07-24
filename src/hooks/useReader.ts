import { useEffect, useRef, useCallback, useState } from 'react'
import { EpubEngine } from '../engines/EpubEngine'
import { registry } from '../core/registry'
import { useProgressStore } from '../stores/progressStore'
import { useSettingsStore } from '../stores/settingsStore'

export interface PageInfo {
  current: number
  total: number
}

export function useReader(bookId: string, containerRef: React.RefObject<HTMLDivElement | null>) {
  const engineRef = useRef<EpubEngine | null>(null)
  const saveProgress = useProgressStore((s) => s.saveProgress)
  const loadProgress = useProgressStore((s) => s.loadProgress)
  const [pageInfo, setPageInfo] = useState<PageInfo>({ current: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const storage = registry.getStorage()
      const data = await storage.getFileData(bookId)
      if (!data || !containerRef.current || cancelled) return

      const engine = new EpubEngine()
      await engine.load(data, containerRef.current)

      if (cancelled) {
        engine.destroy()
        return
      }

      engine.on('ready', () => {
        const settings = useSettingsStore.getState().settings
        engine.applySettings(settings)
        loadProgress(bookId).then(() => {
          const p = useProgressStore.getState().current
          if (p?.location) {
            engine.goToLocation(p.location)
          }
        })
      })

      engine.on('locationChange', (loc: unknown, prog: unknown, page?: unknown, total?: unknown) => {
        saveProgress(bookId, loc as string, prog as number)
        if (typeof page === 'number' && typeof total === 'number') {
          setPageInfo({ current: page, total })
        }
      })

      engineRef.current = engine
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
