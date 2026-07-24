import { registry } from '../core/registry'
import { IndexedDBAdapter } from '../adapters/IndexedDBAdapter'
import { EpubParser } from '../parsers/EpubParser'
import { EpubEngine } from '../engines/EpubEngine'
import { BookshelfPlugin } from '../features/bookshelf/BookshelfPlugin'
import { BookmarksPlugin } from '../features/bookmarks/BookmarksPlugin'
import { HighlightsPlugin } from '../features/highlights/HighlightsPlugin'
import { ProgressPlugin } from '../features/progress/ProgressPlugin'

export async function initializeApp(): Promise<void> {
  // 存储
  registry.registerStorage(new IndexedDBAdapter())

  // 解析器
  registry.registerParser(new EpubParser())

  // 引擎
  registry.registerEngine(new EpubEngine())

  // 功能插件
  const features = [
    new BookshelfPlugin(),
    new BookmarksPlugin(),
    new HighlightsPlugin(),
    new ProgressPlugin(),
  ]

  for (const f of features) {
    registry.registerFeature(f)
  }

  await registry.activateAllFeatures()
}
