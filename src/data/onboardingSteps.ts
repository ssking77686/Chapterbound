export interface OnboardingStep {
  id: string
  target: string
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
  title: string
  description: string
}

export const steps: OnboardingStep[] = [
  {
    id: 'import-book',
    target: 'import-button',
    placement: 'bottom',
    title: '导入你的第一本书',
    description: '点击这里导入 EPUB 电子书，支持 .epub / .pdf / .txt 格式。书架会帮你管理所有的阅读进度。',
  },
  {
    id: 'about-project',
    target: 'about-button',
    placement: 'bottom',
    title: '项目信息与更新',
    description: '在这里查看项目版本号、GitHub 仓库地址和开发者指南，便于获取最新的功能更新。',
  },
  {
    id: 'page-turn',
    target: 'page-area',
    placement: 'bottom',
    title: '翻页操作',
    description: '点击页面左侧翻到上一页，右侧翻到下一页。也可以使用键盘的 ← → 方向键来控制翻页。',
  },
  {
    id: 'settings-panel',
    target: 'settings-button',
    placement: 'left',
    title: '功能面板',
    description: '点击设置打开功能面板。在这里你可以浏览目录、管理书签、探索图鉴，以及调整字体大小和页面主题。',
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
]
