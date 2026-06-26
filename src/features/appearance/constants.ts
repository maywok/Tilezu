import type {
  AppearanceState,
  AppearanceTheme,
  ThemeDensity,
  ThemeFontFamily,
  ThemeIconShape,
  ThemeLogoStyle,
  ThemePreset,
  ThemePresetId,
} from './types'

export const APPEARANCE_STATE_VERSION = 1
export const APPEARANCE_STORAGE_KEY = 'tile-manager-appearance-state-v1'
export const APPEARANCE_SYNC_EVENT = 'tile-manager-appearance-sync'

/** Default color preset for v1 when color vibe picker is hidden. */
export const V1_DEFAULT_COLOR_PRESET_ID: ThemePresetId = 'pastel-dream'

type ThemeSeed = {
  id: string
  name: string
  presetId: ThemePresetId | 'custom'
  accentColor: string
  highlightColor: string
  backgroundDirection: string
  backgroundStops: Array<[string, number]>
  borderDirection: string
  borderStops: Array<[string, number]>
  iconDirection: string
  iconStops: Array<[string, number]>
  animationType: 'waves' | 'shapes' | 'dots' | 'none'
  animationSpeed: number
  animationDensity: number
  animationOpacity: number
  iconShape: ThemeIconShape
  borderThickness: number
  shadowStrength: number
  glowStrength: number
  logoStyle: ThemeLogoStyle
  fontFamily: ThemeFontFamily
  density: ThemeDensity
}

function buildTheme(seed: ThemeSeed): AppearanceTheme {
  const updatedAt = Date.now()
  return {
    id: seed.id,
    name: seed.name,
    presetId: seed.presetId,
    accentColor: seed.accentColor,
    highlightColor: seed.highlightColor,
    backgroundImage: null,
    backgroundGradient: {
      kind: 'linear',
      direction: seed.backgroundDirection,
      stops: seed.backgroundStops.map(([color, position]) => ({ color, position })),
    },
    borderGradient: {
      kind: 'linear',
      direction: seed.borderDirection,
      stops: seed.borderStops.map(([color, position]) => ({ color, position })),
    },
    iconGradient: {
      kind: 'linear',
      direction: seed.iconDirection,
      stops: seed.iconStops.map(([color, position]) => ({ color, position })),
    },
    animation: {
      type: seed.animationType,
      speed: seed.animationSpeed,
      density: seed.animationDensity,
      opacity: seed.animationOpacity,
    },
    iconCard: {
      shape: seed.iconShape,
      borderThickness: seed.borderThickness,
      shadowStrength: seed.shadowStrength,
      glowStrength: seed.glowStrength,
      logoStyle: seed.logoStyle,
    },
    typography: {
      fontFamily: seed.fontFamily,
      density: seed.density,
    },
    updatedAt,
  }
}

const pastelDreamTheme = buildTheme({
  id: 'preset-pastel-dream',
  name: 'Color_01',
  presetId: 'pastel-dream',
  accentColor: '#6bb7ff',
  highlightColor: '#ff8eb7',
  backgroundDirection: '135deg',
  backgroundStops: [
    ['#fdf7ff', 0],
    ['#ecf7ff', 54],
    ['#fff3ea', 100],
  ],
  borderDirection: '120deg',
  borderStops: [
    ['#ff9fc6', 0],
    ['#82d2ff', 56],
    ['#ffd89b', 100],
  ],
  iconDirection: '145deg',
  iconStops: [
    ['#ffd2e8', 0],
    ['#b7e6ff', 50],
    ['#fff2be', 100],
  ],
  animationType: 'waves',
  animationSpeed: 0.52,
  animationDensity: 0.42,
  animationOpacity: 0.3,
  iconShape: 'rounded',
  borderThickness: 2,
  shadowStrength: 0.46,
  glowStrength: 0.36,
  logoStyle: 'gradient',
  fontFamily: 'nunito',
  density: 'cozy',
})

const neonNightTheme = buildTheme({
  id: 'preset-neon-night',
  name: 'Color_02',
  presetId: 'neon-night',
  accentColor: '#35c9ff',
  highlightColor: '#ff5ad1',
  backgroundDirection: '155deg',
  backgroundStops: [
    ['#0b1425', 0],
    ['#161d36', 45],
    ['#240f2e', 100],
  ],
  borderDirection: '105deg',
  borderStops: [
    ['#46edff', 0],
    ['#7f8cff', 56],
    ['#ff78db', 100],
  ],
  iconDirection: '130deg',
  iconStops: [
    ['#37d6ff', 0],
    ['#7d87ff', 50],
    ['#ff6dca', 100],
  ],
  animationType: 'shapes',
  animationSpeed: 0.68,
  animationDensity: 0.64,
  animationOpacity: 0.4,
  iconShape: 'square',
  borderThickness: 3,
  shadowStrength: 0.72,
  glowStrength: 0.66,
  logoStyle: 'outlined',
  fontFamily: 'segoe',
  density: 'compact',
})

const oceanBreezeTheme = buildTheme({
  id: 'preset-ocean-breeze',
  name: 'Color_03',
  presetId: 'ocean-breeze',
  accentColor: '#39c8cc',
  highlightColor: '#78a7ff',
  backgroundDirection: '160deg',
  backgroundStops: [
    ['#e9fbff', 0],
    ['#d9f4ff', 50],
    ['#dce8ff', 100],
  ],
  borderDirection: '115deg',
  borderStops: [
    ['#56e1db', 0],
    ['#77c9ff', 48],
    ['#7d9bff', 100],
  ],
  iconDirection: '150deg',
  iconStops: [
    ['#b5fff6', 0],
    ['#bde9ff', 56],
    ['#cad7ff', 100],
  ],
  animationType: 'dots',
  animationSpeed: 0.47,
  animationDensity: 0.52,
  animationOpacity: 0.24,
  iconShape: 'rounded',
  borderThickness: 2,
  shadowStrength: 0.38,
  glowStrength: 0.3,
  logoStyle: 'flat',
  fontFamily: 'trebuchet',
  density: 'cozy',
})

const personaPopTheme = buildTheme({
  id: 'preset-persona-pop',
  name: 'Color_04',
  presetId: 'persona-pop',
  accentColor: '#ff4c72',
  highlightColor: '#ffd057',
  backgroundDirection: '135deg',
  backgroundStops: [
    ['#1f2239', 0],
    ['#2c1935', 46],
    ['#141b2f', 100],
  ],
  borderDirection: '95deg',
  borderStops: [
    ['#ff6f8b', 0],
    ['#ffca5a', 54],
    ['#6bc2ff', 100],
  ],
  iconDirection: '140deg',
  iconStops: [
    ['#ff6f8b', 0],
    ['#ffd15f', 45],
    ['#8bd8ff', 100],
  ],
  animationType: 'shapes',
  animationSpeed: 0.58,
  animationDensity: 0.58,
  animationOpacity: 0.34,
  iconShape: 'circle',
  borderThickness: 3,
  shadowStrength: 0.62,
  glowStrength: 0.52,
  logoStyle: 'gradient',
  fontFamily: 'georgia',
  density: 'spacious',
})

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'pastel-dream',
    label: 'Color_01',
    description: 'Default color palette.',
    theme: pastelDreamTheme,
  },
  {
    id: 'neon-night',
    label: 'Color_02',
    description: 'Color palette 02.',
    theme: neonNightTheme,
  },
  {
    id: 'ocean-breeze',
    label: 'Color_03',
    description: 'Color palette 03.',
    theme: oceanBreezeTheme,
  },
  {
    id: 'persona-pop',
    label: 'Color_04',
    description: 'Color palette 04.',
    theme: personaPopTheme,
  },
]

export const DEFAULT_APPEARANCE_THEME: AppearanceTheme = pastelDreamTheme

export const DEFAULT_APPEARANCE_STATE: AppearanceState = {
  version: APPEARANCE_STATE_VERSION,
  activeTheme: DEFAULT_APPEARANCE_THEME,
  savedThemes: [],
  savedGradients: [],
}

export const LINEAR_DIRECTION_OPTIONS = [
  { label: 'Diagonal', value: '135deg' },
  { label: 'Horizontal', value: '90deg' },
  { label: 'Vertical', value: '180deg' },
  { label: 'Reverse Diagonal', value: '45deg' },
]

export const RADIAL_DIRECTION_OPTIONS = [
  { label: 'Center', value: 'circle at center' },
  { label: 'Top', value: 'circle at top' },
  { label: 'Bottom Right', value: 'circle at bottom right' },
  { label: 'Left Edge', value: 'circle at left center' },
]

export const ANIMATION_TYPE_OPTIONS = [
  { label: 'Waves', value: 'waves' as const },
  { label: 'Floating Shapes', value: 'shapes' as const },
  { label: 'Dots', value: 'dots' as const },
  { label: 'None', value: 'none' as const },
]

export const ICON_SHAPE_OPTIONS = [
  { label: 'Rounded', value: 'rounded' as const },
  { label: 'Square', value: 'square' as const },
  { label: 'Circle', value: 'circle' as const },
]

export const LOGO_STYLE_OPTIONS = [
  { label: 'Flat', value: 'flat' as const },
  { label: 'Gradient', value: 'gradient' as const },
  { label: 'Outlined', value: 'outlined' as const },
]

export const FONT_FAMILY_OPTIONS = [
  { label: 'Nunito', value: 'nunito' as const },
  { label: 'Segoe UI', value: 'segoe' as const },
  { label: 'Trebuchet MS', value: 'trebuchet' as const },
  { label: 'Georgia', value: 'georgia' as const },
]

export const DENSITY_OPTIONS = [
  { label: 'Compact', value: 'compact' as const },
  { label: 'Cozy', value: 'cozy' as const },
  { label: 'Spacious', value: 'spacious' as const },
]
