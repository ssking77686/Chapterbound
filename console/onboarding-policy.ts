/**
 * Chapterbound UI 检查台 —— 对被测应用「引导层」的策略
 *
 * 为什么需要这个模块：App.tsx 每次载入只要「没被永久关闭」就 startOnboarding()，而引导层是个
 * **会自己走流程**的东西 —— 它会在步骤里打开侧栏、演示书签列表。于是任何一次重载（镜像、
 * 重载按钮、触屏切换）都会让那个窗格开始自顾自走引导，跟另一侧分道扬镳。
 * 这是镜像失配的真实根源，实测出来的。
 *
 * ⚠️ 但**首次必须先让它出现**：App.tsx 的 ensureTestData() 也 gate 在同一个条件上 ——
 * 一上来就压掉，测试书永远不会被播种，书库永远是空的。所以只在「已确认播过种」之后才压。
 *
 * 放在独立模块里是因为它必须在**两个时刻**生效：iframe 开始加载之前（挂载前），
 * 以及每次重载之前。同一份判断写在两处必然有一天不同步。
 */

const ONBOARDING_KEY = 'ereader-onboarding-dismissed-v1'
const SEEDED_KEY = 'console.seeded'
const SUPPRESS_KEY = 'console.suppress-onboarding'

/** 用户的偏好：要不要在载入时压掉引导层（默认要） */
export function suppressPreference(): boolean {
  return localStorage.getItem(SUPPRESS_KEY) !== '0'
}

export function setSuppressPreference(suppress: boolean): void {
  localStorage.setItem(SUPPRESS_KEY, suppress ? '1' : '0')
}

/** 落实策略。suppress=false 会**清掉**应用的「不再提示」标记，让引导层重新出现（为了审它） */
export function applyOnboardingPolicy(suppress: boolean): void {
  if (!suppress) {
    localStorage.removeItem(ONBOARDING_KEY)
    return
  }
  if (localStorage.getItem(SEEDED_KEY) === '1') localStorage.setItem(ONBOARDING_KEY, 'true')
}

/** 在窗格里看到书卡 = 测试书已播种，之后就可以安全地压掉引导层了 */
export function markSeededIfBookPresent(doc: Document): void {
  if (doc.querySelector('[data-onboarding-id="test-book"]')) {
    localStorage.setItem(SEEDED_KEY, '1')
  }
}
