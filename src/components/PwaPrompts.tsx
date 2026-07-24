import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Download, RefreshCw } from 'lucide-react'

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }

export function PwaPrompts() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_, registration) {
      // 每小时检查一次更新
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000)
      }
    },
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setShowInstall(false)
      setInstallEvent(null)
    })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    installEvent.prompt()
    const result = await installEvent.userChoice
    if (result.outcome === 'accepted') {
      setShowInstall(false)
      setInstallEvent(null)
    }
  }

  const handleUpdate = () => {
    updateServiceWorker(true)
  }

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col gap-3">
      <AnimatePresence>
        {showInstall && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={springDefault}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleInstall}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
            style={{ background: 'var(--color-accent)' }}
          >
            <Download className="h-4 w-4" />
            安装应用
          </motion.button>
        )}

        {needRefresh && (
          <motion.button
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={springDefault}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleUpdate}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
            style={{ background: 'var(--color-accent)' }}
          >
            <RefreshCw className="h-4 w-4" />
            有新版本，点击刷新
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
