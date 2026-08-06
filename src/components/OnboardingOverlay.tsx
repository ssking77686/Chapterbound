import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { steps } from '../data/onboardingSteps'

const CARD_W = 320
const PADDING = 10

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }

interface Cutout {
  x: number
  y: number
  width: number
  height: number
}

function getCutout(targetId: string): Cutout | null {
  const el = document.querySelector(`[data-onboarding-id="${targetId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    x: r.left - PADDING,
    y: r.top - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  }
}

function getCardPos(cutout: Cutout | null, placement: string): { x: number; y: number } {
  if (!cutout || placement === 'center') {
    return {
      x: (window.innerWidth - CARD_W) / 2,
      y: window.innerHeight * 0.38,
    }
  }
  const gap = 16
  let x: number, y: number
  switch (placement) {
    case 'top':
      x = cutout.x + cutout.width / 2 - CARD_W / 2
      y = cutout.y - 200 - gap
      break
    case 'bottom':
      x = cutout.x + cutout.width / 2 - CARD_W / 2
      y = cutout.y + cutout.height + gap
      break
    case 'left':
      x = cutout.x - CARD_W - gap
      y = cutout.y + cutout.height / 2 - 100
      break
    case 'right':
      x = cutout.x + cutout.width + gap
      y = cutout.y + cutout.height / 2 - 100
      break
    default:
      x = cutout.x + cutout.width / 2 - CARD_W / 2
      y = cutout.y + cutout.height + gap
  }
  return {
    x: Math.max(16, Math.min(Math.round(x), window.innerWidth - CARD_W - 16)),
    y: Math.max(16, Math.min(Math.round(y), window.innerHeight - 260)),
  }
}

export function OnboardingOverlay() {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const advance = useOnboardingStore((s) => s.advance)
  const skip = useOnboardingStore((s) => s.skip)

  const step = steps[currentStep]
  const hasSpotlight = step.target !== ''

  const [cutout, setCutout] = useState<Cutout | null>(null)

  // Track target element position — poll until found for mount-animated elements
  useEffect(() => {
    if (!hasSpotlight) {
      setCutout(null)
      return
    }
    const find = () => {
      const c = getCutout(step.target)
      if (c) setCutout(c)
      return c
    }
    if (find()) return
    const id = setInterval(() => { if (find()) clearInterval(id) }, 100)
    return () => clearInterval(id)
  }, [step.target, hasSpotlight])

  // Resize handling
  useEffect(() => {
    const onResize = () => {
      if (hasSpotlight) {
        const c = getCutout(step.target)
        if (c) setCutout(c)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [step.target, hasSpotlight])

  // Click-to-advance: attach listener to target element (retry until found)
  const attachClick = useCallback(() => {
    if (!step.target) return
    const el = document.querySelector(`[data-onboarding-id="${step.target}"]`)
    if (!el) return false
    const handler = () => advance()
    el.addEventListener('click', handler, { once: true })
    return true
  }, [step.target, advance])

  useEffect(() => {
    if (!step.target) return
    if (attachClick()) return
    const id = setInterval(() => { if (attachClick()) clearInterval(id) }, 100)
    return () => clearInterval(id)
  }, [step.target, attachClick])

  const cardPos = getCardPos(cutout, step.placement)
  const cutoutRx = cutout ? Math.min(cutout.height / 2, 20) : 20

  return (
    <div className="fixed inset-0" style={{ zIndex: 100 }}>
      {/* SVG spotlight mask */}
      <svg
        className="fixed inset-0"
        width="100%"
        height="100%"
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <mask id="onboarding-mask">
            <rect width="100%" height="100%" fill="white" />
            {cutout && (
              <motion.rect
                x={cutout.x}
                y={cutout.y}
                width={cutout.width}
                height={cutout.height}
                rx={cutoutRx}
                fill="black"
                animate={{ x: cutout.x, y: cutout.y, width: cutout.width, height: cutout.height }}
                transition={springDefault}
              />
            )}
          </mask>
        </defs>
        {/* Scrim */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#onboarding-mask)"
        />
        {/* Cutout edge glow */}
        {cutout && (
          <motion.rect
            x={cutout.x}
            y={cutout.y}
            width={cutout.width}
            height={cutout.height}
            rx={cutoutRx}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={1.5}
            animate={{ x: cutout.x, y: cutout.y, width: cutout.width, height: cutout.height }}
            transition={springDefault}
          />
        )}
      </svg>

      {/* Step 6 demo animation — subtle glow particles */}
      {currentStep === 5 && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 101 }}>
          <motion.div
            className="absolute"
            style={{
              left: '35%',
              top: '40%',
              width: 80,
              height: 32,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.08)',
            }}
            animate={{
              x: [0, 120, 0],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div
            className="absolute flex items-center justify-center"
            style={{
              left: '35%',
              top: '40%',
              width: 80,
              height: 32,
              borderRadius: 16,
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            选中文字
          </motion.div>
          <motion.div
            className="absolute flex items-center justify-center"
            style={{
              left: '55%',
              top: '40%',
              width: 80,
              height: 32,
              borderRadius: 16,
              background: 'var(--color-card)',
              color: 'var(--color-text)',
              fontSize: 13,
              border: '1px solid var(--color-separator)',
            }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              times: [0, 0.15, 0.7, 1],
              ease: 'easeInOut',
            }}
          >
            🔍 搜索图鉴
          </motion.div>
        </div>
      )}

      {/* Tooltip card */}
      <motion.div
        className="fixed flex flex-col gap-3 p-6"
        style={{
          width: CARD_W,
          left: cardPos.x,
          top: cardPos.y,
          background: 'var(--color-card)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08)',
          zIndex: 102,
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0, left: cardPos.x, top: cardPos.y }}
        transition={springDefault}
      >
        <h2 className="text-base font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
          {step.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {step.description}
        </p>

        <div className="flex items-center justify-between pt-1">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === currentStep ? 16 : 6,
                  height: 6,
                  background: i === currentStep
                    ? 'var(--color-accent)'
                    : i < currentStep
                      ? 'var(--color-text-secondary)'
                      : 'var(--color-separator)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < steps.length - 1 ? (
              <motion.button
                className="rounded-full px-4 py-2 text-xs font-medium"
                style={{
                  color: 'var(--color-text-secondary)',
                  background: 'transparent',
                }}
                whileHover={{ background: 'rgba(60,50,38,0.06)' }}
                whileTap={{ scale: 0.96 }}
                transition={springPress}
                onClick={skip}
              >
                跳过
              </motion.button>
            ) : (
              <motion.button
                className="rounded-full px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={springPress}
                onClick={advance}
              >
                开始阅读
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
