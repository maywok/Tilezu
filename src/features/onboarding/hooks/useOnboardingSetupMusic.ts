import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

import { menuSetupSound } from '../../../assets/sounds/music'
import { useLoopedMenuTrack } from '../../launcher/hooks/useLoopedMenuTrack'

const SETUP_MUSIC_VOLUME = 1

type UseOnboardingSetupMusicOptions = {
  isActive: boolean
  plipAudioContextRef: MutableRefObject<AudioContext | null>
}

export function useOnboardingSetupMusic({
  isActive,
  plipAudioContextRef,
}: UseOnboardingSetupMusicOptions) {
  const armFromUserGestureRef = useRef<() => void>(() => {})

  const { armFromUserGesture, stopPlayback } = useLoopedMenuTrack({
    src: menuSetupSound,
    enabled: isActive,
    targetVolume: SETUP_MUSIC_VOLUME,
    preferExternalMedia: false,
    isExternalMediaPlaying: false,
    plipAudioContextRef,
    shouldPlay: isActive,
  })

  armFromUserGestureRef.current = armFromUserGesture

  useEffect(() => {
    if (!isActive) {
      stopPlayback()
      return
    }

    const handlePointerDown = () => {
      armFromUserGestureRef.current()
    }

    window.addEventListener('pointerdown', handlePointerDown, { once: true })
    armFromUserGestureRef.current()

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isActive, stopPlayback])
}
