import { useEffect, useState } from 'react'

// 唯一的触屏判定源——全 app 通过它判断，不在组件里散落 matchMedia。
// 桌面端（hover: hover + pointer: fine）返回 false，走原交互；
// 触屏设备返回 true，启用滑动翻页、常显按钮等移动端适配。
// 调试覆盖：localStorage['force-touch'] = '1' | '0' 可强制触屏/桌面模式（不暴露 UI 开关）。

const TOUCH_QUERY = '(hover: none), (pointer: coarse)'

export function detectTouch(): boolean {
  try {
    const force = localStorage.getItem('force-touch')
    if (force === '1') return true
    if (force === '0') return false
  } catch { /* localStorage 不可用时忽略覆盖 */ }
  try {
    return window.matchMedia(TOUCH_QUERY).matches
  } catch {
    return false
  }
}

export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(() => detectTouch())

  useEffect(() => {
    const mq = window.matchMedia(TOUCH_QUERY)
    const onChange = () => setIsTouch(detectTouch())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isTouch
}
