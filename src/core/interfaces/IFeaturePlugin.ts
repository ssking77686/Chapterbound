import type { ServiceRegistry } from '../registry'
import type { RouteConfig } from '../types'

export interface IFeaturePlugin {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly dependencies?: string[]

  onRegister(registry: ServiceRegistry): void
  onActivate(): Promise<void>
  onDeactivate(): Promise<void>

  getAPI?(): Record<string, unknown>
  routes?: RouteConfig[]
  uiExtensions?: {
    readerToolbar?: React.ComponentType
    libraryActions?: React.ComponentType
    settingsPanel?: React.ComponentType
  }
}
