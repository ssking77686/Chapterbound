// 引导步骤集：单一声明 + platform 过滤（Windows / 安卓两套，见 getOnboardingSteps）。
//
// ⚠️ 不变量：两套的索引 0–5（welcome … page-turn）必须保持一致 ——
// onboardingStore 的「进入阅读器」屏障（advance 内 next === 5）和
// LibraryPage 的 onboardingStep >= 4（关 AboutOverlay）都按索引判断。
// 平台差异只允许出现在索引 6 之后，或成对替换同一索引的条目（见 page-turn 的两个变体）。

export interface OnboardingStep {
  id: string
  target: string
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
  title: string
  description: string
  /** 'both'（缺省）两套都有；'desktop' / 'touch' 只进对应的一套 */
  platform?: 'both' | 'desktop' | 'touch'
}

export const steps: OnboardingStep[] = [
  {
    id: 'welcome',
    target: '',
    placement: 'center',
    title: '书中的世界，自动为你整理',
    description: '一份简单的入门指南，带你快速了解核心功能。只需几分钟，就能上手阅读和管理你的书籍。',
  },
  {
    id: 'import-book',
    target: 'import-button',
    placement: 'bottom',
    title: '导入你的第一本书',
    description: '点击这里导入 EPUB 电子书。书架会帮你管理所有的阅读进度。',
  },
  {
    id: 'about-project',
    target: 'about-button',
    placement: 'bottom',
    title: '项目信息与更新',
    description: '点击这里查看项目版本号、开发者信息和 GitHub 仓库地址，便于获取最新的功能更新。',
  },
  {
    id: 'repo-link',
    target: 'repo-link',
    placement: 'top',
    title: 'GitHub 仓库',
    description: '点击这里访问项目的 GitHub 仓库，可以查看源代码、提交问题和获取最新版本。',
  },
  {
    id: 'start-exploring',
    target: 'test-book',
    placement: 'top',
    title: '准备好了吗？',
    description: '项目内置了一本 AI 创作的短篇故事《星砂镇》，包含配套的图鉴数据。让我们一起打开它，开始探索吧！',
  },
  {
    // 桌面版：翻页按钮常显，直接指到按钮上
    id: 'page-turn',
    platform: 'desktop',
    target: 'page-turn-right',
    placement: 'left',
    title: '翻页操作',
    description: '点击屏幕右侧翻到下一页，左侧翻到上一页。也可以使用键盘的 ← → 方向键来控制翻页。',
  },
  {
    // 触屏版：翻页按钮被手势接管而隐藏（page-turn-right 不再渲染）→ 改指阅读区并改文案
    id: 'page-turn',
    platform: 'touch',
    target: 'page-area',
    placement: 'bottom',
    title: '翻页操作',
    description: '轻点屏幕右侧翻下一页、左侧翻上一页，左右滑动也可翻页。',
  },
  {
    id: 'settings-panel',
    target: 'settings-button',
    placement: 'left',
    title: '功能面板',
    description: '点击设置打开功能面板。在这里你可以浏览目录、管理书签、探索图鉴，以及调整字体大小和页面主题。',
  },
  {
    // 紧跟 settings-panel：该步点击后设置面板已打开，这步顺势滚到面板底部的真实「位置接力」区
    id: 'relay',
    target: 'relay-section',
    placement: 'top',
    title: '位置接力',
    description: '换设备时：在这里生成短码，在另一台设备打开同一本书后粘贴，就能直达同一阅读位置——无需云同步。',
  },
  {
    id: 'compendium',
    target: 'compendium-tab',
    placement: 'left',
    title: '图鉴 — 核心功能',
    description: '图鉴自动记录故事中出现的人物、地点和设定。阅读过程中会自动解锁新条目，也可以手动搜索。',
  },
  {
    id: 'text-search',
    target: '',
    placement: 'center',
    title: '文字选中搜索',
    description: '阅读时选中任意文字，会自动在图鉴中搜索相关内容。试试在书中选中一个名字或地名看看效果。',
  },
  {
    // 触屏套最后一步：手势无法用真实锚点高亮，走居中演示卡（同 text-search 先例）
    id: 'immersive',
    platform: 'touch',
    target: '',
    placement: 'center',
    title: '沉浸模式',
    description: '点正文中间试试：顶栏和页码会隐去，换回一到两行正文；再点一下中间就能恢复。',
  },
]

/** 按平台过滤出当前生效的一套步骤（单一声明，不复制数组） */
export function getOnboardingSteps(isTouch: boolean): OnboardingStep[] {
  const want = isTouch ? 'touch' : 'desktop'
  return steps.filter((s) => (s.platform ?? 'both') === 'both' || s.platform === want)
}
