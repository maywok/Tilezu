export type ThemePresetId = 'pastel-dream' | 'neon-night' | 'ocean-breeze' | 'persona-pop'

export type ThemeGradientKind = 'linear' | 'radial'
export type ThemeAnimationType = 'waves' | 'shapes' | 'dots' | 'none'
export type ThemeIconShape = 'rounded' | 'square' | 'circle'
export type ThemeLogoStyle = 'flat' | 'gradient' | 'outlined'
export type ThemeFontFamily = 'nunito' | 'segoe' | 'trebuchet' | 'georgia'
export type ThemeDensity = 'compact' | 'cozy' | 'spacious'
export type ThemeBackgroundImageFit = 'cover' | 'contain'
export type AppearanceGradientTarget = 'background' | 'border' | 'icon'

export interface ThemeGradientStop {
  color: string
  position: number
}

export interface ThemeGradient {
  kind: ThemeGradientKind
  direction: string
  stops: ThemeGradientStop[]
}

export interface ThemeAnimationConfig {
  type: ThemeAnimationType
  speed: number
  density: number
  opacity: number
}

export interface ThemeIconCardConfig {
  shape: ThemeIconShape
  borderThickness: number
  shadowStrength: number
  glowStrength: number
  logoStyle: ThemeLogoStyle
}

export interface ThemeTypographyConfig {
  fontFamily: ThemeFontFamily
  density: ThemeDensity
}

export interface ThemeBackgroundImageConfig {
  dataUrl: string
  fit: ThemeBackgroundImageFit
  opacity: number
}

export interface AppearanceTheme {
  id: string
  name: string
  presetId: ThemePresetId | 'custom'
  accentColor: string
  highlightColor: string
  backgroundImage: ThemeBackgroundImageConfig | null
  backgroundGradient: ThemeGradient
  borderGradient: ThemeGradient
  iconGradient: ThemeGradient
  animation: ThemeAnimationConfig
  iconCard: ThemeIconCardConfig
  typography: ThemeTypographyConfig
  updatedAt: number
}

export interface SavedAppearanceTheme {
  id: string
  name: string
  theme: AppearanceTheme
  createdAt: number
}

export interface SavedAppearanceGradient {
  id: string
  name: string
  target: AppearanceGradientTarget
  gradient: ThemeGradient
  createdAt: number
}

export interface AppearanceState {
  version: number
  activeTheme: AppearanceTheme
  savedThemes: SavedAppearanceTheme[]
  savedGradients: SavedAppearanceGradient[]
}

export interface ThemePreset {
  id: ThemePresetId
  label: string
  description: string
  theme: AppearanceTheme
}
