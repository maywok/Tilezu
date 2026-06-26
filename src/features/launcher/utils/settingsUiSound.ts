import type { MutableRefObject } from 'react'

import type { SettingsUiSoundKind } from '../../../assets/sounds/settings'
import { playVariedClone } from '../../../utils/variedUiSound'

export type SettingsUiSoundRefs = {
  settingsSelectTabAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsSwitchOptionAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsHoverAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsIconVineAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsSystemCollageAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsErrorAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsSliderAudioRef: MutableRefObject<HTMLAudioElement | null>
}

const SETTINGS_UI_SOUND_VOLUMES: Record<SettingsUiSoundKind, number> = {
  selectTab: 0.58,
  switchOption: 0.56,
  hover: 0.42,
  iconVine: 0.6,
  systemCollage: 0.54,
  slider: 0.52,
  error: 0.62,
}

function resolveSettingsAudioRef(
  refs: SettingsUiSoundRefs,
  kind: SettingsUiSoundKind,
): MutableRefObject<HTMLAudioElement | null> {
  switch (kind) {
    case 'selectTab':
      return refs.settingsSelectTabAudioRef
    case 'switchOption':
      return refs.settingsSwitchOptionAudioRef
    case 'hover':
      return refs.settingsHoverAudioRef
    case 'iconVine':
      return refs.settingsIconVineAudioRef
    case 'systemCollage':
      return refs.settingsSystemCollageAudioRef
    case 'slider':
      return refs.settingsSliderAudioRef
    case 'error':
      return refs.settingsErrorAudioRef
  }
}

export function playSettingsUiSound(
  refs: SettingsUiSoundRefs,
  kind: SettingsUiSoundKind,
  activeUiOneShotAudioRef: MutableRefObject<Set<HTMLAudioElement>>,
  options?: { volume?: number },
): void {
  const audioRef = resolveSettingsAudioRef(refs, kind)
  const original = audioRef.current
  if (!original) {
    return
  }

  if (typeof options?.volume === 'number') {
    original.volume = Math.max(0, Math.min(1, options.volume))
  } else {
    original.volume = SETTINGS_UI_SOUND_VOLUMES[kind]
  }

  const clone = playVariedClone(original, {}, (audio) => {
    activeUiOneShotAudioRef.current.delete(audio)
  })

  if (clone) {
    activeUiOneShotAudioRef.current.add(clone)
  }
}
