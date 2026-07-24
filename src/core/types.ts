// 支持的书籍格式
export const BookFormat = {
  EPUB: 'epub',
  PDF: 'pdf',
  TXT: 'txt',
  MOBI: 'mobi',
  AZW3: 'azw3',
  CBZ: 'cbz',
  MARKDOWN: 'markdown',
  UNKNOWN: 'unknown',
} as const

export type BookFormat = (typeof BookFormat)[keyof typeof BookFormat]

// 书架上的书籍记录
export interface BookRecord {
  id: string
  title: string
  author: string
  coverUrl?: string
  format: BookFormat
  fileSize: number
  fileName: string
  // 原始文件存储在 IndexedDB 中，用此 key 读取
  fileDataKey: string
  addedAt: number
  lastReadAt?: number
}

// 目录项
export interface TOCItem {
  label: string
  href: string
  level: number
  children?: TOCItem[]
}

// 书签
export interface Bookmark {
  id: string
  bookId: string
  location: string
  label: string
  createdAt: number
}

// 高亮标注
export interface Highlight {
  id: string
  bookId: string
  location: string
  text: string
  color: string
  note?: string
  createdAt: number
}

// 阅读进度
export interface ReadingProgress {
  bookId: string
  location: string
  progress: number // 0-100
  updatedAt: number
}

// 路由配置（给功能插件用）
export interface RouteConfig {
  path: string
  element: () => Promise<{ default: React.ComponentType }>
}

// 书籍元数据（解析器返回）
export interface BookMetadata {
  title: string
  author: string
  cover?: Blob
  format: BookFormat
  language?: string
  publisher?: string
  description?: string
}

// 解析结果
export interface ParsedBook {
  metadata: BookMetadata
  // 引擎特定的解析后数据结构
  content: unknown
}

// 引擎统一的事件回调类型
export type EngineEvent =
  | { type: 'locationChange'; location: string; progress: number }
  | { type: 'selection'; text: string; cfiRange: string }
  | { type: 'ready' }
