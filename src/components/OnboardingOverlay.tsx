import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ScrollText, User, MapPin, BookOpen } from 'lucide-react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { useBookshelfStore } from '../stores/bookshelfStore'
import { steps } from '../data/onboardingSteps'

const CARD_W = 300
const WELCOME_CARD_W = 480
const PADDING = 10
const HIGHLIGHT_GLOW = '0 0 12px rgba(184,124,75,0.35), 0 0 28px rgba(184,124,75,0.18)'

const STAR_PARTICLES = [
  { x: 0.12, y: 0.18, size: 4, dr: 8, period: 4.2 },
  { x: 0.82, y: 0.22, size: 3, dr: 6, period: 3.8 },
  { x: 0.08, y: 0.72, size: 5, dr: 10, period: 5.1 },
  { x: 0.76, y: 0.68, size: 3, dr: 7, period: 4.5 },
  { x: 0.45, y: 0.10, size: 6, dr: 12, period: 5.8 },
  { x: 0.55, y: 0.85, size: 4, dr: 8, period: 3.5 },
  { x: 0.25, y: 0.55, size: 3, dr: 5, period: 4.0 },
  { x: 0.68, y: 0.42, size: 5, dr: 9, period: 4.8 },
]

const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }

interface Cutout {
  x: number
  y: number
  width: number
  height: number
}

function getTargetRect(targetId: string): Cutout | null {
  const el = document.querySelector(`[data-onboarding-id="${targetId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    x: r.left,
    y: r.top,
    width: r.width,
    height: r.height,
  }
}

function getCardPos(target: Cutout | null, placement: string, cardH: number): { x: number; y: number } {
  if (!target || placement === 'center') {
    return {
      x: (window.innerWidth - CARD_W) / 2,
      y: window.innerHeight * 0.4,
    }
  }
  const gap = 12
  let x: number, y: number
  switch (placement) {
    case 'top':
      x = target.x + target.width / 2 - CARD_W / 2
      y = target.y - cardH - gap
      break
    case 'bottom':
      x = target.x + target.width / 2 - CARD_W / 2
      y = target.y + target.height + gap
      break
    case 'left':
      x = target.x - CARD_W - gap
      y = target.y + target.height / 2 - cardH / 2
      break
    case 'right':
      x = target.x + target.width + gap
      y = target.y + target.height / 2 - cardH / 2
      break
    default:
      x = target.x + target.width / 2 - CARD_W / 2
      y = target.y + target.height + gap
  }
  return {
    x: Math.max(16, Math.min(Math.round(x), window.innerWidth - CARD_W - 16)),
    y: Math.max(16, Math.min(Math.round(y), window.innerHeight - cardH)),
  }
}

export function OnboardingOverlay() {
  const currentStep = useOnboardingStore((s) => s.currentStep)
  const advance = useOnboardingStore((s) => s.advance)
  const skip = useOnboardingStore((s) => s.skip)
  const booksCount = useBookshelfStore((s) => s.books.length)

  const step = steps[currentStep]
  const hasSpotlight = step.target !== ''

  const [targetRect, setTargetRect] = useState<Cutout | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(160)
  const initialBookCount = useRef(booksCount)

  // Step 1: advance when a new book is imported
  useEffect(() => {
    if (currentStep !== 1) return
    if (booksCount > initialBookCount.current) advance()
  }, [currentStep, booksCount, advance])

  // Step 2: advance when AboutOverlay opens (repo-link appears in DOM)
  useEffect(() => {
    if (currentStep !== 2) return
    const id = setInterval(() => {
      if (document.querySelector('[data-onboarding-id="repo-link"]')) {
        advance()
      }
    }, 100)
    return () => clearInterval(id)
  }, [currentStep, advance])

  // Continuously track target element position (poll + scroll + resize)
  useEffect(() => {
    if (!hasSpotlight) {
      setTargetRect(null)
      return
    }
    let raf = 0
    const track = () => {
      const r = getTargetRect(step.target)
      if (r) setTargetRect(r)
      raf = requestAnimationFrame(track)
    }
    track()
    return () => cancelAnimationFrame(raf)
  }, [step.target, hasSpotlight])

  // Measure actual card height for accurate positioning
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setCardHeight(el.getBoundingClientRect().height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [step.id])

  // Click-to-advance: only for steps that need it (3:repo-link, 5:page-turn, 6:settings, 7:compendium).
  // Steps 1 (import) and 2 (about) use outcome detection instead.
  const attachClick = useCallback(() => {
    if (!step.target || currentStep <= 2) return
    const el = document.querySelector(`[data-onboarding-id="${step.target}"]`)
    if (!el) return false
    const handler = () => advance()
    el.addEventListener('click', handler, { once: true })
    return true
  }, [step.target, currentStep, advance])

  useEffect(() => {
    if (!step.target || currentStep <= 2) return
    if (attachClick()) return
    const id = setInterval(() => { if (attachClick()) clearInterval(id) }, 150)
    return () => clearInterval(id)
  }, [step.target, currentStep, attachClick])

  // For text-search step, position card at top so it doesn't block the demo
  const isLastStep = step.id === 'text-search'
  const isWelcome = step.id === 'welcome'
  const cardW = isWelcome ? WELCOME_CARD_W : CARD_W
  const cardPos = isLastStep
    ? { x: (window.innerWidth - CARD_W) / 2, y: 24 }
    : isWelcome
      ? { x: (window.innerWidth - WELCOME_CARD_W) / 2, y: window.innerHeight * 0.3 }
      : getCardPos(targetRect, step.placement, cardHeight)

  return (
    <div className="fixed inset-0" style={{ zIndex: 100, pointerEvents: 'none' }}>
      {/* Welcome scrim — dims the bookshelf behind */}
      <AnimatePresence>
        {isWelcome && (
          <motion.div
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.22)', zIndex: 100 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      {/* Star萤 particles — only during welcome */}
      <AnimatePresence>
        {isWelcome &&
          STAR_PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              className="fixed rounded-full"
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                width: p.size,
                height: p.size,
                background: '#e8c47c',
                boxShadow: `0 0 ${p.dr}px rgba(232,196,124,0.6), 0 0 ${p.dr * 2}px rgba(184,124,75,0.25)`,
                zIndex: 100,
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0, 0.9, 0.6, 0.9, 0.3, 0],
                x: [0, Math.cos(i * 1.2) * 40, Math.cos(i * 1.2 + 1.5) * 50, Math.cos(i * 1.2 + 3) * 30, Math.cos(i * 1.2 + 4.5) * 45, Math.cos(i * 1.2 + 6) * 20],
                y: [0, Math.sin(i * 0.9) * 30, Math.sin(i * 0.9 + 1.5) * 45, Math.sin(i * 0.9 + 3) * 25, Math.sin(i * 0.9 + 4.5) * 40, Math.sin(i * 0.9 + 6) * 15],
              }}
              transition={{
                duration: p.period,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.15,
              }}
            />
          ))}
      </AnimatePresence>

      {/* Pulsing highlight ring around target */}
      {targetRect && (
        <motion.div
          className="fixed rounded-lg"
          style={{
            left: targetRect.x - PADDING,
            top: targetRect.y - PADDING,
            width: targetRect.width + PADDING * 2,
            height: targetRect.height + PADDING * 2,
            border: '3px solid var(--color-accent)',
            background: 'rgba(184,124,75,0.08)',
            boxShadow: HIGHLIGHT_GLOW,
            zIndex: 101,
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.025, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Tooltip card */}
      <motion.div
        ref={cardRef}
        className={isWelcome ? 'flex flex-col items-center gap-4 p-8 text-center' : 'flex flex-col gap-3 p-5'}
        style={{
          position: 'fixed',
          width: cardW,
          background: 'rgba(255,245,235,0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
          borderTop: '1px solid rgba(255,255,255,0.5)',
          pointerEvents: 'auto',
          zIndex: 102,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, left: cardPos.x, top: cardPos.y }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {isWelcome ? (
          <>
            <motion.div
              className="flex h-20 w-20 items-center justify-center rounded-2xl mb-1"
              style={{
                background: 'rgba(184,124,75,0.1)',
              }}
              animate={{ boxShadow: ['0 0 16px rgba(184,124,75,0.1)', '0 0 40px rgba(184,124,75,0.28)', '0 0 16px rgba(184,124,75,0.1)'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BookOpen className="h-9 w-9" style={{ color: 'var(--color-accent)' }} />
            </motion.div>
            <p
              className="font-medium tracking-widest"
              style={{ color: 'var(--color-text-secondary)', fontSize: '0.6875rem', textTransform: 'uppercase' }}
            >
              电子阅读器
            </p>
            <h2
              className="font-bold leading-tight"
              style={{ color: 'var(--color-text)', fontSize: '2rem', letterSpacing: '-0.02em', maxWidth: 380, fontFamily: '"Noto Serif SC", "Source Han Serif SC", "SimSun", "STSong", serif' }}
            >
              书中的世界，自动为你整理
            </h2>
            <p
              className="leading-relaxed"
              style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', maxWidth: 380 }}
            >
              一份简单的入门指南，带你快速了解核心功能。只需几分钟，就能上手阅读和管理你的书籍。
            </p>
          </>
        ) : (
          <>
            <h2
              className="font-semibold leading-tight"
              style={{ color: 'var(--color-text)', fontSize: '1rem' }}
            >
              {step.title}
            </h2>
            <p
              className="leading-relaxed"
              style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}
            >
              {step.description}
            </p>
          </>
        )}

        <div className={isWelcome ? 'flex items-center justify-center pt-2' : 'flex items-center justify-between pt-1'}>
          {!isWelcome && (
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
          )}

          {currentStep === 0 ? (
            <motion.button
              className="rounded-full px-8 py-3 text-base font-semibold text-white"
              style={{ background: 'var(--color-accent)', boxShadow: '0 4px 16px rgba(184,124,75,0.35)' }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              transition={springPress}
              onClick={advance}
            >
              开始教程
            </motion.button>
          ) : currentStep < steps.length - 1 ? (
            currentStep === 4 ? (
              <motion.button
                className="rounded-full px-5 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--color-accent)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                transition={springPress}
                onClick={advance}
              >
                开始探索
              </motion.button>
            ) : (
              <motion.button
                className="rounded-full px-4 py-2 text-xs font-medium"
                style={{ color: 'var(--color-text-secondary)', background: 'transparent' }}
                whileHover={{ background: 'rgba(60,50,38,0.06)' }}
                whileTap={{ scale: 0.96 }}
                transition={springPress}
                onClick={skip}
              >
                跳过
              </motion.button>
            )
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
      </motion.div>

      {/* Step 8 (last): text search demo — sequential animation */}
      {currentStep === 8 && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 101, pointerEvents: 'none' }}>
          <motion.div
            className="overflow-hidden"
            style={{
              width: 400,
              background: 'var(--color-card)',
              borderRadius: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
              pointerEvents: 'none',
            }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...springDefault, delay: 0.1 }}
          >
            {/* Mock reading area */}
            <div className="relative px-6 pt-5 pb-3" style={{ background: 'var(--color-page-bg)' }}>
              {/* Animated cursor — moves to "苏婆婆" position (~230px from left padding) */}
              <motion.div
                className="absolute z-10"
                style={{ left: 28, top: 40 }}
                animate={{
                  x: [0, 90, 180, 244, 244],
                  opacity: [0, 0, 1, 1, 0],
                }}
                transition={{ duration: 5, repeat: Infinity, times: [0, 0.06, 0.16, 0.26, 0.36], ease: 'easeInOut' }}
              >
                <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                  <path d="M1 1L6 16L8 10L14 9L1 1Z" fill="var(--color-text)" stroke="#fff" strokeWidth="0.5"/>
                </svg>
              </motion.div>

              <p className="text-sm select-none" style={{ color: 'var(--color-text)', lineHeight: 2.2 }}>
                林默踏入山谷中的小镇。老人抬起头，她自称姓
                <motion.span
                  style={{ display: 'inline', borderRadius: 3, padding: '1px 1px' }}
                  animate={{
                    background: [
                      'rgba(184,124,75,0)',
                      'rgba(184,124,75,0)',
                      'rgba(184,124,75,0)',
                      'rgba(184,124,75,0.28)',
                      'rgba(184,124,75,0.32)',
                      'rgba(184,124,75,0.28)',
                      'rgba(184,124,75,0)',
                    ],
                  }}
                  transition={{ duration: 5, repeat: Infinity, times: [0, 0.24, 0.28, 0.32, 0.48, 0.6, 0.7], ease: 'easeInOut' }}
                >
                  苏婆婆
                </motion.span>
                。镇上只有观星台那边有空房——
              </p>

              {/* Search bubble — positioned above the highlighted text, matching real app style */}
              <motion.div
                className="absolute z-20"
                style={{ left: 230, top: 14 }}
                animate={{
                  opacity: [0, 0, 1, 1, 1, 0],
                  scale: [0.9, 0.9, 1, 1.04, 1, 0.95],
                }}
                transition={{ duration: 5, repeat: Infinity, times: [0, 0.3, 0.36, 0.44, 0.52, 0.64], ease: 'easeInOut' }}
              >
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-lg"
                  style={{
                    background: 'var(--color-card)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-separator)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <ScrollText className="h-3 w-3 shrink-0" style={{ color: 'var(--color-accent)' }} />
                  <span className="text-xs font-medium">苏婆婆</span>
                </div>
              </motion.div>
            </div>

            {/* Search results — match real app style */}
            <div className="px-4 pb-4 pt-1 space-y-1.5">
              {[
                { icon: User, label: '人物', name: '苏婆婆', desc: '星砂镇的守护者，五十年来收集星萤的赠礼。' },
                { icon: MapPin, label: '地点', name: '星砂镇', desc: '藏在山谷中的古老小镇，夜间有星萤出没。' },
              ].map((item, i) => (
                <motion.div
                  key={item.name}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: 'var(--color-page-bg)' }}
                  animate={{ opacity: [0, 0, 1, 1, 0], x: [8, 8, 0, 0, -4] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    times: [0, 0.44, 0.5, 0.68, 0.76],
                    ease: 'easeInOut',
                    delay: i * 0.06,
                  }}
                >
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'var(--color-accent)', opacity: 0.12 }}
                  >
                    <item.icon className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                      {item.name}
                      <span className="ml-1.5 font-normal" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
