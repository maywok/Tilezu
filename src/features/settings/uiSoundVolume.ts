export const LAUNCHER_UI_SOUND_BASE_VOLUMES = {
  selectedSystem: 0.62,
  selectedGame: 0.6,
  iconScroll: 0.56,
  functionsBarHover: 0.46,
  functionsBarSelect: 0.58,
  favoriteSelect: 0.86,
  favoriteDeselect: 0.82,
  settingsSelectTab: 0.58,
  settingsSwitchOption: 0.56,
  settingsHover: 0.42,
  settingsSlider: 0.52,
  settingsIconVine: 0.6,
  settingsSystemCollage: 0.54,
  settingsError: 0.62,
} as const

export function scaleUiSoundVolume(base: number, uiSoundVolume: number): number {
  const scale = Math.max(0, Math.min(1, uiSoundVolume))
  return Math.max(0, Math.min(1, base * scale))
}