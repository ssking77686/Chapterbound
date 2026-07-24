import type { IFeaturePlugin } from '../../core/interfaces/IFeaturePlugin'
import type { ServiceRegistry } from '../../core/registry'

export class BookshelfPlugin implements IFeaturePlugin {
  readonly id = 'bookshelf'
  readonly name = '书架管理'
  readonly version = '1.0.0'

  onRegister(_registry: ServiceRegistry): void {}
  async onActivate(): Promise<void> {}
  async onDeactivate(): Promise<void> {}
}
