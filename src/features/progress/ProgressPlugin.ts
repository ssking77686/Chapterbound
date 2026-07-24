import type { IFeaturePlugin } from '../../core/interfaces/IFeaturePlugin'
import type { ServiceRegistry } from '../../core/registry'

export class ProgressPlugin implements IFeaturePlugin {
  readonly id = 'progress'
  readonly name = '阅读进度'
  readonly version = '1.0.0'

  onRegister(_registry: ServiceRegistry): void {}
  async onActivate(): Promise<void> {}
  async onDeactivate(): Promise<void> {}
}
