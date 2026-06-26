import type { GraphicsFidelityMode } from '../types'

export type AutoFidelityDowngrade = null | 'lite' | 'ultra-lite'

export type LauncherFidelityFlags = {
  isPerformanceLite: boolean
  isGridLargeViewportLite: boolean
  isFidelityLite: boolean
  isFidelityUltraLite: boolean
  shouldRenderRuntimeBackdrop: boolean
  shouldMountDecorativeRainLayers: boolean
  shouldRenderFloatingAmbient: boolean
  floatingAmbientReduced: boolean
  isPerformanceFirstMode: boolean
  enableInteractionEffects: boolean
  rungoUsesUltraLite: boolean
}

export function isGraphicsFidelityMode(value: unknown): value is GraphicsFidelityMode {
  return value === 'ultra-lite'
    || value === 'lite'
    || value === 'normal'
    || value === 'ultra'
}

export function resolveEffectiveFidelity(
  userPreference: GraphicsFidelityMode,
  autoDowngrade: AutoFidelityDowngrade,
): GraphicsFidelityMode {
  if (userPreference !== 'normal') {
    return userPreference
  }

  if (autoDowngrade) {
    return autoDowngrade
  }

  return 'normal'
}

type DeriveLauncherFlagsOptions = {
  effectiveFidelity: GraphicsFidelityMode
  isLauncherActive: boolean
  launcherView: 'systems' | 'games' | string
  gamesViewMode: 'grid' | 'stack' | string
  isStartupVisualTierActive: boolean
}

export function deriveLauncherFlags({
  effectiveFidelity,
  isLauncherActive,
  launcherView,
  gamesViewMode,
  isStartupVisualTierActive,
}: DeriveLauncherFlagsOptions): LauncherFidelityFlags {
  const isUltra = effectiveFidelity === 'ultra'
  const isPerformanceLite = isLauncherActive && !isUltra
  const isGamesGrid = launcherView === 'games' && gamesViewMode === 'grid'

  return {
    isPerformanceLite,
    isGridLargeViewportLite: isPerformanceLite && isGamesGrid,
    isFidelityLite: effectiveFidelity === 'lite' || effectiveFidelity === 'ultra-lite',
    isFidelityUltraLite: effectiveFidelity === 'ultra-lite',
    shouldRenderRuntimeBackdrop: isUltra && !isStartupVisualTierActive,
    shouldMountDecorativeRainLayers: isUltra,
    shouldRenderFloatingAmbient: effectiveFidelity === 'normal' || effectiveFidelity === 'ultra',
    floatingAmbientReduced: effectiveFidelity !== 'ultra',
    isPerformanceFirstMode: effectiveFidelity === 'lite' || effectiveFidelity === 'ultra-lite',
    enableInteractionEffects: effectiveFidelity === 'normal' || effectiveFidelity === 'ultra',
    rungoUsesUltraLite: effectiveFidelity === 'ultra-lite',
  }
}

export function describeEffectiveFidelity(
  userPreference: GraphicsFidelityMode,
  effectiveFidelity: GraphicsFidelityMode,
  autoDowngrade: AutoFidelityDowngrade,
): string {
  if (userPreference === 'normal' && autoDowngrade) {
    return `${effectiveFidelity} (auto from normal)`
  }

  return effectiveFidelity
}