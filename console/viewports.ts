/**
 * Chapterbound UI 检查台 —— 视口档与安全区预设
 *
 * 视口必须是**完整的宽×高**，不能只给宽度：宽度决定命中哪个断点，高度决定有没有
 * 足够的垂直空间。两者是独立的轴，而且高度会决定 bug 是否可见 ——
 * 例如「关于面板最后一行被手势条压住」只在内容需要滚动时才存在，
 * 在 4:3 的平板上内容一屏放得下，这个 bug 就消失了。
 *
 * 安全区预设标了「估」，因为**这里的数字是类别，不是机型断言**。真实机型值不该由我编：
 * 要精确值就用手机浏览器打开检查台（普通浏览器里 env(safe-area-inset-*) 能解析出真值，
 * Android WebView 里恒为 0），把四个真值读出来填进滑块。
 */

import type { Insets } from './audit'

export interface Viewport {
  id: string
  label: string
  width: number
  height: number
  touch: boolean
  /** 面板上显示的补充说明 */
  note?: string
}

export const VIEWPORTS: Viewport[] = [
  {
    id: 'phone-xs',
    label: '手机竖（极窄）',
    width: 320,
    height: 640,
    touch: true,
    note: '最窄的常见安卓宽度；原来的气泡溢出 bug 在这一档最严重（360 时左侧溢出 110px）',
  },
  { id: 'phone-s', label: '手机竖（小）', width: 360, height: 800, touch: true },
  { id: 'phone-l', label: '手机竖（大）', width: 412, height: 915, touch: true },
  {
    id: 'phone-h',
    label: '手机横',
    width: 800,
    height: 360,
    touch: true,
    note: '刘海跑到左右，只有这档走 --safe-left/right',
  },
  { id: 'pad-p', label: '平板竖 4:3', width: 768, height: 1024, touch: true, note: '平板无刘海，安全区≈0' },
  { id: 'pad-l', label: '平板横 4:3', width: 1024, height: 768, touch: true, note: '横屏但对角无刘海' },
  { id: 'pad10-p', label: '大平板竖 16:10', width: 800, height: 1280, touch: true },
  { id: 'desktop', label: '桌面 1280', width: 1280, height: 800, touch: false },
  {
    id: 'wide',
    label: '大屏 1920',
    width: 1920,
    height: 1080,
    touch: false,
    note: '看 2xl 封顶：书架停在 7 列、阅读列在 ≥1800px 收窄到 1600',
  },
]

export interface InsetPreset {
  id: string
  label: string
  note: string
  insets: Insets
}

export const INSET_PRESETS: InsetPreset[] = [
  {
    id: 'none',
    label: '无',
    note: '桌面 / 无系统栏',
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  {
    id: 'gesture',
    label: '手势导航（估）',
    note: '状态栏 32 + 手势条 24',
    insets: { top: 32, bottom: 24, left: 0, right: 0 },
  },
  {
    id: 'keys3',
    label: '三键导航（估）',
    note: '状态栏 32 + 导航栏 48',
    insets: { top: 32, bottom: 48, left: 0, right: 0 },
  },
  {
    id: 'notch-p',
    label: '竖屏刘海（估）',
    note: '挖孔/刘海较高；竖屏刘海已含在状态栏高度内',
    insets: { top: 48, bottom: 24, left: 0, right: 0 },
  },
  {
    id: 'notch-l',
    label: '横屏刘海（估）',
    note: '刘海移到左右 —— 只有这档会走 --safe-left/right',
    insets: { top: 0, bottom: 24, left: 44, right: 44 },
  },
]

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** 常见屏幕比例。用来把 412×915 报成「≈9:20」而不是「0.45:1」——
    这个标签是你判断「我此刻在模拟哪台设备」的依据，可读性比精确性重要。 */
const COMMON_RATIOS: [number, number, string][] = [
  [9, 19.5, '9:19.5'],
  [9, 20, '9:20'],
  [9, 21, '9:21'],
  [20, 9, '20:9'],
  [3, 4, '3:4'],
  [4, 3, '4:3'],
  [10, 16, '10:16'],
  [16, 10, '16:10'],
  [16, 9, '16:9'],
  [8, 5, '8:5'],
  [1, 1, '1:1'],
]

/**
 * 比例标签，优先级：
 *   1) 能整除成小整数比 → 直接给（320×640 → 1:2）
 *   2) 接近某个常见屏幕比例（±2%）→ 给「≈」（412×915 → ≈9:20）
 *   3) 都不行 → 给数值比，不假装它对应某台设备
 */
export function ratioLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—'

  const g = gcd(width, height)
  const sw = width / g
  const sh = height / g
  if (sw <= 40 && sh <= 40) return `${sw}:${sh}`

  const r = width / height
  for (const [w, h, label] of COMMON_RATIOS) {
    const target = w / h
    if (Math.abs(r - target) / target <= 0.02) return `≈${label}`
  }
  return `${r.toFixed(2)}:1`
}

export function insetsEqual(a: Insets, b: Insets): boolean {
  return a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right
}

export type InsetKey = keyof Insets

export const INSET_KEYS: { key: InsetKey; label: string; max: number }[] = [
  { key: 'top', label: '上 top', max: 120 },
  { key: 'bottom', label: '下 bottom', max: 120 },
  { key: 'left', label: '左 left', max: 120 },
  { key: 'right', label: '右 right', max: 120 },
]
