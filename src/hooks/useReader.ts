import { useEffect, useRef, useCallback, useState } from 'react'
import { EpubEngine } from '../engines/EpubEngine'
import { registry } from '../core/registry'
import { useProgressStore } from '../stores/progressStore'

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

  return { nextPage, prevPage, getEngine, pageInfo }
}
