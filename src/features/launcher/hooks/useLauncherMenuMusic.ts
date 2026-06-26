import type { MutableRefObject } from 'react'
import { useEffect } from 'react'

import { menuMusicSound } from '../../../assets/sounds/music'
import type { AppTab } from '../types'
import { useExternalMediaPlaying } from './useExternalMediaPlaying'
import { useLoopedMenuTrack } from './useLoopedMenuTrack'

const AMBIENT_MENU_TABS: ReadonlySet<AppTab> = new Set(['launcher', 'settings', 'profile'])

function isAmbientMenuTab(tab: AppTab): boolean {
  return AMBIENT_MENU_TABS.has(tab)
}

type UseLauncherMenuMusicOptions = {
  menuMusicEnabled: boolean
  menuMusicVolume: number
  preferExternalMedia: boolean
  activeTab: AppTab
  isDeferredStartupReady: boolean
  appLowPowerActive: boolean
  plipAudioContextRef: MutableRefObject<AudioContext | null>
  menuMusicStopRef?: MutableRefObject<(() => void) | null>
}

export function useLauncherMenuMusic({
  menuMusicEnabled,
  menuMusicVolume,
  preferExternalMedia,
  activeTab,
  isDeferredStartupReady,
  appLowPowerActive,
  plipAudioContextRef,
  menuMusicStopRef,
}: UseLauncherMenuMusicOptions) {
  const isExternalMediaPlaying = useExternalMediaPlaying(menuMusicEnabled)
  const shouldPlay = menuMusicEnabled && isAmbientMenuTab(activeTab) && isDeferredStartupReady && !appLowPowerActive

  const { armFromUserGesture, forceStopPlayback } = useLoopedMenuTrack({
    src: menuMusicSound,
    enabled: menuMusicEnabled,
    targetVolume: menuMusicVolume,
    preferExternalMedia,
    isExternalMediaPlaying,
    plipAudioContextRef,
    shouldPlay,
  })

  useEffect(() => {
    if (!menuMusicStopRef) {
      return
    }

    menuMusicStopRef.current = forceStopPlayback
    return () => {
      menuMusicStopRef.current = null
    }
  }, [forceStopPlayback, menuMusicStopRef])

  useEffect(() => {
    if (!shouldPlay) {
      return
    }

    const handlePointerDown = () => {
      armFromUserGesture()
    }

    window.addEventListener('pointerdown', handlePointerDown, { once: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [armFromUserGesture, shouldPlay])

  useEffect(() => {
    if (!shouldPlay) {
      return
    }

    armFromUserGesture()
  }, [armFromUserGesture, shouldPlay])
}
