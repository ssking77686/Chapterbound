export interface PageTheme {
  id: string
  name: string
  nameZh: string
  background: string
  text: string
}

export const PAGE_THEME_PRESETS: PageTheme[] = [
  {
    id: 'default-light',
    name: 'Default Light',
    nameZh: '默认亮色',
    background: '#FDFBF7',
    text: '#3C3226',
  },
  {
    id: 'default-dark',
    name: 'Default Dark',
    nameZh: '默认暗色',
    background: '#2B2420',
    text: '#F5EFE6',
  },
  {
    id: 'parchment',
    name: 'Parchment',
    nameZh: '羊皮纸',
    background: '#F4EDDC',
    text: '#3D3028',
  },
  {
    id: 'sage',
    name: 'Sage',
    nameZh: '薄荷灰绿',
    background: '#ECF0EB',
    text: '#2D352D',
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    nameZh: '深夜黑',
    background: '#1A1A1C',
    text: '#D8D4D0',
  },
  {
    id: 'sepia',
    name: 'Sepia',
    nameZh: '琥珀棕',
    background: '#EBDFC5',
    text: '#4A3828',
  },
]

export const PAGE_THEME_DEFAULT_LIGHT = PAGE_THEME_PRESETS[0]
export const PAGE_THEME_DEFAULT_DARK = PAGE_THEME_PRESETS[1]

export function findPreset(bg: string, text: string): PageTheme | undefined {
  return PAGE_THEME_PRESETS.find((p) => p.background === bg && p.text === text)
}

export function isDarkBackground(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // WCAG 相对亮度公式
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance < 128
}
