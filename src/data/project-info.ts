export interface Contributor {
  login: string
  name: string
  avatar: string
  url: string
  role: string
}

export interface ProjectInfo {
  name: string
  version: string
  description: string
  repo: string
  license: string
  owner: Contributor
  contributors: Contributor[]
}

export const projectInfo: ProjectInfo = {
  name: '电子阅读器',
  version: 'v1.2.0',
  description: '沉浸式 EPUB 电子书阅读器，支持图鉴系统、彩色书签、阅读进度追踪与明暗主题切换。',
  repo: 'https://github.com/ssking77686/Chapterbound',
  license: 'MIT',
  owner: {
    login: 'ssking77686',
    name: 'ahine Yang',
    avatar: 'https://avatars.githubusercontent.com/u/216399098?v=4',
    url: 'https://github.com/ssking77686',
    role: '创建者 & 主要开发者',
  },
  contributors: [
    {
      login: 'ssking77686',
      name: 'ahine Yang',
      avatar: 'https://avatars.githubusercontent.com/u/216399098?v=4',
      url: 'https://github.com/ssking77686',
      role: '全栈开发',
    },
  ],
}
