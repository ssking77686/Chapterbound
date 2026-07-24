import type { BookFormat } from './types'
import type { IReaderEngine } from './interfaces/IReaderEngine'
import type { IStorageAdapter } from './interfaces/IStorageAdapter'
import type { IBookParser } from './interfaces/IBookParser'
import type { IFeaturePlugin } from './interfaces/IFeaturePlugin'

export class ServiceRegistry {
  private engines = new Map<BookFormat, IReaderEngine>()
  private parsers = new Map<BookFormat, IBookParser>()
  private features = new Map<string, IFeaturePlugin>()
  private storage: IStorageAdapter | null = null

  // 引擎
  registerEngine(engine: IReaderEngine): void {
    if (this.engines.has(engine.format)) {
      console.warn(`Engine for "${engine.format}" is being replaced.`)
    }
    this.engines.set(engine.format, engine)
  }

  getEngine(format: BookFormat): IReaderEngine | undefined {
    return this.engines.get(format)
  }

  // 存储
  registerStorage(adapter: IStorageAdapter): void {
    this.storage = adapter
  }

  getStorage(): IStorageAdapter {
    if (!this.storage) {
      throw new Error('No storage adapter registered.')
    }
    return this.storage
  }

  // 解析器
  registerParser(parser: IBookParser): void {
    if (this.parsers.has(parser.format)) {
      console.warn(`Parser for "${parser.format}" is being replaced.`)
    }
    this.parsers.set(parser.format, parser)
  }

  getParser(format: BookFormat): IBookParser | undefined {
    return this.parsers.get(format)
  }

  // 功能插件
  registerFeature(plugin: IFeaturePlugin): void {
    if (this.features.has(plugin.id)) {
      throw new Error(`Feature "${plugin.id}" is already registered.`)
    }
    this.features.set(plugin.id, plugin)
    plugin.onRegister(this)
  }

  getFeature(id: string): IFeaturePlugin | undefined {
    return this.features.get(id)
  }

  getAllFeatures(): IFeaturePlugin[] {
    return Array.from(this.features.values())
  }

  async activateAllFeatures(): Promise<void> {
    const sorted = this.topologicalSort()
    for (const plugin of sorted) {
      await plugin.onActivate()
    }
  }

  async deactivateAllFeatures(): Promise<void> {
    const sorted = this.topologicalSort().reverse()
    for (const plugin of sorted) {
      await plugin.onDeactivate()
    }
  }

  private topologicalSort(): IFeaturePlugin[] {
    const plugins = Array.from(this.features.values())
    const visited = new Set<string>()
    const sorted: IFeaturePlugin[] = []

    function visit(plugin: IFeaturePlugin) {
      if (visited.has(plugin.id)) return
      visited.add(plugin.id)
      if (plugin.dependencies) {
        for (const depId of plugin.dependencies) {
          const dep = plugins.find((p) => p.id === depId)
          if (dep) visit(dep)
        }
      }
      sorted.push(plugin)
    }

    for (const plugin of plugins) {
      visit(plugin)
    }

    return sorted
  }
}

// 全局单例
export const registry = new ServiceRegistry()
