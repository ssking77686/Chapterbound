import type { IFeaturePlugin } from '../../core/interfaces/IFeaturePlugin'
import type { ServiceRegistry } from '../../core/registry'

export class BookmarksPlugin implements IFeaturePlugin {
  readonly id = 'bookmarks'
  readonly name = '书签'
  readonly version = '1.0.0'

  onRegister(_registry: ServiceRegistry): void {}
  async onActivate(): Promise<void> {}
  async onDeactivate(): Promise<void> {}
}
