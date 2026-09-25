import { useEffect, useState } from 'react'

// 唯一的触屏判定源——全 app 通过它判断，不在组件里散落 matchMedia。
// 桌面端（hover: hover + pointer: fine）返回 false，走原交互；
// 触屏设备返回 true，启用滑动翻页、常显按钮等移动端适配。
// 调试覆盖：localStorage['force-touch'] = '1' | '0' 可强制触屏/桌面模式（不暴露 UI 开关）。
//
// 判定结果同时写到 <html data-touch="1">，CSS 侧一律读这个属性、不自己写媒体查询。
// 原因：@media (hover: none) 是**第二处判定源**，和这里的 JS 判定会在 force-touch 覆盖时
// 各说各话 —— 历史 bug：设了 force-touch='1' 之后 JS 认为是触屏、CSS 认为不是，
// .icon-btn 的 44px 命中区规则静默不生效，界面看着像触屏但点不准。
//
// ⚠️ data-touch 是**派生值**，不要直接改它。要切换模式就改 force-touch 然后重载页面，
//    否则 JS 与 CSS 会重新分叉。（开发检查台就是走 force-touch + 重载这条路。）

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

/**
 * 把判定结果同步到 <html>，供 CSS 读取。幂等，返回是否触屏。
 *
 * 写 '1' 而不是"存在即真"：布尔有两个状态，写 data-touch="0" 是很容易犯的错，
 * 而 CSS 侧的 [data-touch='1'] 能挡住它（存在即真的话 "0" 也会命中）。
 */
export function applyTouchMode(): boolean {
  const isTouch = detectTouch()
  const root = document.documentElement
  if (isTouch) root.setAttribute('data-touch', '1')
  else root.removeAttribute('data-touch')
  return isTouch
}

export function useIsTouch(): boolean {
  // 初始值用纯函数 detectTouch（无副作用）；属性由 main.tsx 在首次渲染前设好，
  // 所以这里不需要也不应该在 useState 初始化器里写 DOM。
  const [isTouch, setIsTouch] = useState<boolean>(() => detectTouch())

  useEffect(() => {
    const mq = window.matchMedia(TOUCH_QUERY)
    // 媒体查询真的变了（例如平板插上鼠标）时，同步更新属性，别让 CSS 停在旧模式
    const onChange = () => setIsTouch(applyTouchMode())
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isTouch
}
