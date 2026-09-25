import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConsoleApp } from './ConsoleApp'
import { applyOnboardingPolicy, suppressPreference } from './onboarding-policy'

// iframe 会在 React 首次渲染时立刻开始加载，所以引导层策略必须在挂载前定好 ——
// 等到组件 effect 里再设就晚了（应用已经 boot 完、引导层已经起来了）。
// 判断逻辑与重载路径共用同一个模块，不在这里重写一遍。
applyOnboardingPolicy(suppressPreference())

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ConsoleApp />
  </StrictMode>,
)
