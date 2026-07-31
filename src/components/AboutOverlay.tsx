import { motion, AnimatePresence } from 'motion/react'
import { X, ExternalLink, Heart, Package, Code2 } from 'lucide-react'
import { projectInfo, type Contributor } from '../data/project-info'

interface Props {
  open: boolean
  onClose: () => void
}

const springSlide = { type: 'spring' as const, bounce: 0.15, duration: 0.3 }
const springPress = { type: 'spring' as const, bounce: 0, duration: 0.2 }
const springDefault = { type: 'spring' as const, bounce: 0, duration: 0.3 }

function ContributorCard({ c }: { c: Contributor }) {
  return (
    <motion.a
      href={c.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-2xl p-3"
      style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-float)', transition: springDefault }}
      whileTap={{ scale: 0.97, transition: springPress }}
    >
      <img
        src={c.avatar}
        alt={c.name}
        className="h-11 w-11 rounded-full"
        loading="lazy"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {c.name}
        </p>
        <p className="truncate text-xs" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
          @{c.login} · {c.role}
        </p>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
    </motion.a>
  )
}

export function AboutOverlay({ open, onClose }: Props) {
  const toolbarBg = 'var(--color-toolbar)'
  const toolbarBlur = 'blur(24px) saturate(180%)'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩 */}
          <motion.div
            key="about-scrim"
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.2)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springDefault}
            onClick={onClose}
          />

          {/* 面板 — 从右侧滑入 */}
          <motion.div
            key="about-panel"
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-[420px] flex-col"
            style={{ background: 'var(--color-page-bg)' }}
            initial={{ x: 288, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 288, opacity: 0 }}
            transition={springSlide}
          >
            {/* 材质化标题栏 */}
            <div
              className="flex shrink-0 items-center justify-between px-5 py-4"
              style={{
                background: toolbarBg,
                backdropFilter: toolbarBlur,
                WebkitBackdropFilter: toolbarBlur,
                borderBottom: '1px solid var(--color-separator)',
              }}
            >
              <h2
                className="text-lg font-bold tracking-[-0.015em]"
                style={{ color: 'var(--color-text)', lineHeight: 1.15 }}
              >
                关于
              </h2>
              <motion.button
                onClick={onClose}
                className="rounded-full p-2"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                transition={springPress}
                style={{ color: 'var(--color-text)' }}
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </motion.button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              {/* 项目图标 + 名称 */}
              <motion.div
                className="mb-8 text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springDefault, delay: 0.05 }}
              >
                <div
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
                  style={{
                    background: 'var(--color-accent)',
                    boxShadow: '0 4px 16px rgba(184, 124, 75, 0.3)',
                  }}
                >
                  <Package className="h-9 w-9 text-white" />
                </div>
                <h1
                  className="mb-1 text-2xl font-bold tracking-[-0.015em]"
                  style={{ color: 'var(--color-text)', lineHeight: 1.15 }}
                >
                  {projectInfo.name}
                </h1>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}
                >
                  {projectInfo.version}
                </p>
              </motion.div>

              {/* 简介 */}
              <motion.p
                className="mb-8 text-center text-sm leading-relaxed"
                style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springDefault, delay: 0.1 }}
              >
                {projectInfo.description}
              </motion.p>

              {/* 项目所有者 */}
              <motion.div
                className="mb-8"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springDefault, delay: 0.15 }}
              >
                <p
                  className="mb-3 text-xs font-semibold uppercase tracking-[0.05em]"
                  style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
                >
                  项目所有者
                </p>
                <ContributorCard c={projectInfo.owner} />
              </motion.div>

              {/* 贡献者 */}
              {projectInfo.contributors.length > 0 && (
                <motion.div
                  className="mb-8"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springDefault, delay: 0.2 }}
                >
                  <p
                    className="mb-3 text-xs font-semibold uppercase tracking-[0.05em]"
                    style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
                  >
                    贡献者
                  </p>
                  <div className="flex flex-col gap-2">
                    {projectInfo.contributors.map((c) => (
                      <ContributorCard key={c.login} c={c} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 仓库链接 */}
              <motion.a
                href={projectInfo.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 flex items-center gap-3 rounded-2xl p-4"
                style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
                whileHover={{ y: -2, boxShadow: 'var(--shadow-float)', transition: springDefault }}
                whileTap={{ scale: 0.97, transition: springPress }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springDefault, delay: 0.25 }}
              >
                <Code2 className="h-5 w-5 shrink-0" style={{ color: 'var(--color-text)' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    GitHub 仓库
                  </p>
                  <p
                    className="truncate text-xs"
                    style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}
                  >
                    {projectInfo.repo.replace('https://', '')}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
              </motion.a>

              {/* 许可证 */}
              <motion.div
                className="mb-8 flex items-center gap-3 rounded-2xl p-4"
                style={{ background: 'var(--color-card)', boxShadow: 'var(--shadow-card)' }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springDefault, delay: 0.3 }}
              >
                <Heart className="h-5 w-5 shrink-0" style={{ color: 'var(--color-danger)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    {projectInfo.license} License
                  </p>
                </div>
              </motion.div>

              {/* 版权 */}
              <motion.p
                className="text-center text-xs"
                style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...springDefault, delay: 0.35 }}
              >
                &copy; {new Date().getFullYear()} ahine Yang
              </motion.p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
