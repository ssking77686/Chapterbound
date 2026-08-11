import { AnimatePresence, motion } from 'motion/react'
import { useToastStore } from '../stores/toastStore'

const colors: Record<string, { bg: string; border: string }> = {
  error: { bg: '#FFF5F5', border: '#FCA5A5' },
  success: { bg: '#F0FAF0', border: '#86D49F' },
  info: { bg: '#F5F1EA', border: '#C4B598' },
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div style={{ position: 'fixed', top: 48, left: '50%', translate: '-50%', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      <AnimatePresence>
        {toasts.map((t) => {
          const c = colors[t.type] ?? colors.info
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
              onClick={() => dismiss(t.id)}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.8125rem',
                color: '#3C3226',
                cursor: 'pointer',
                pointerEvents: 'auto',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              }}
            >
              {t.message}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
