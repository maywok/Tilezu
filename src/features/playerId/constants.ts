import type { PlayerIdAccentId, PlayerIdFoilType } from './types'

export type PlayerIdAccentPreset = {
  id: PlayerIdAccentId
  label: string
  accent: string
  accentSoft: string
  border: string
  glow: string
}

export const PLAYER_ID_ACCENT_PRESETS: PlayerIdAccentPreset[] = [
  { id: 'ocean', label: 'Ocean', accent: '#5eb8e8', accentSoft: 'rgba(94, 184, 232, 0.22)', border: 'rgba(94, 184, 232, 0.72)', glow: 'rgba(94, 184, 232, 0.35)' },
  { id: 'rose', label: 'Rose', accent: '#f06b96', accentSoft: 'rgba(240, 107, 150, 0.22)', border: 'rgba(240, 107, 150, 0.72)', glow: 'rgba(240, 107, 150, 0.35)' },
  { id: 'mint', label: 'Mint', accent: '#5fd4a4', accentSoft: 'rgba(95, 212, 164, 0.22)', border: 'rgba(95, 212, 164, 0.72)', glow: 'rgba(95, 212, 164, 0.35)' },
  { id: 'sunset', label: 'Sunset', accent: '#ff9a5c', accentSoft: 'rgba(255, 154, 92, 0.22)', border: 'rgba(255, 154, 92, 0.72)', glow: 'rgba(255, 154, 92, 0.35)' },
  { id: 'violet', label: 'Violet', accent: '#a98cff', accentSoft: 'rgba(169, 140, 255, 0.22)', border: 'rgba(169, 140, 255, 0.72)', glow: 'rgba(169, 140, 255, 0.35)' },
  { id: 'slate', label: 'Slate', accent: '#8ea3c7', accentSoft: 'rgba(142, 163, 199, 0.22)', border: 'rgba(142, 163, 199, 0.72)', glow: 'rgba(142, 163, 199, 0.35)' },
  { id: 'gold', label: 'Gold', accent: '#e8c06a', accentSoft: 'rgba(232, 192, 106, 0.22)', border: 'rgba(232, 192, 106, 0.72)', glow: 'rgba(232, 192, 106, 0.35)' },
  { id: 'ember', label: 'Ember', accent: '#ff6b4a', accentSoft: 'rgba(255, 107, 74, 0.22)', border: 'rgba(255, 107, 74, 0.72)', glow: 'rgba(255, 107, 74, 0.35)' },
]

export const PLAYER_ID_FOIL_OPTIONS: Array<{ id: PlayerIdFoilType; label: string }> = [
  { id: 'none', label: 'Matte' },
  { id: 'holographic', label: 'Holo' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'ripple', label: 'Ripple' },
]

export const DEFAULT_PLAYER_ID_ACCENT_ID: PlayerIdAccentId = 'ocean'
export const DEFAULT_PLAYER_ID_FOIL_TYPE: PlayerIdFoilType = 'holographic'

export function getPlayerIdAccentPreset(id: PlayerIdAccentId) {
  return PLAYER_ID_ACCENT_PRESETS.find((preset) => preset.id === id) ?? PLAYER_ID_ACCENT_PRESETS[0]
}
