import type { IFeaturePlugin } from '../../core/interfaces/IFeaturePlugin'
import type { ServiceRegistry } from '../../core/registry'

export class HighlightsPlugin implements IFeaturePlugin {
  readonly id = 'highlights'
  readonly name = '高亮标注'
  readonly version = '1.0.0'

  onRegister(_registry: ServiceRegistry): void {}
  async onActivate(): Promise<void> {}
  async onDeactivate(): Promise<void> {}
}
