import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

const MENU_AUDIO_FADE_SECONDS = 0.32

/** Slider at 100% maps to 5% of the original uncapped music gain. */
export const MENU_MUSIC_VOLUME_CAP = 0.05

function scaleMenuMusicVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume)) * MENU_MUSIC_VOLUME_CAP
}

type UseLoopedMenuTrackOptions = {
  src: string
  enabled: boolean
  targetVolume: number
  preferExternalMedia: boolean
  isExternalMediaPlaying: boolean
  plipAudioContextRef: MutableRefObject<AudioContext | null>
  shouldPlay?: boolean
}

export function useLoopedMenuTrack({
  src,
  enabled,
  targetVolume,
  preferExternalMedia,
  isExternalMediaPlaying,
  plipAudioContextRef,
  shouldPlay = true,
}: UseLoopedMenuTrackOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const graphReadyRef = useRef(false)

  const fadeGainTo = useCallback((target: number, durationSec = MENU_AUDIO_FADE_SECONDS) => {
    const context = plipAudioContextRef.current
    const gain = gainRef.current
    if (!context || !gain) {
      return
    }

    const clampedTarget = Math.max(0.0001, Math.min(1, target))
    const now = context.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now)
    gain.gain.exponentialRampToValueAtTime(clampedTarget, now + durationSec)
  }, [plipAudioContextRef])

  const ensureGraph = useCallback(async () => {
    if (graphReadyRef.current) {
      return
    }

    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) {
      return
    }

    if (!plipAudioContextRef.current) {
      plipAudioContextRef.current = new AudioContextCtor()
    }

    const context = plipAudioContextRef.current
    const isLowPower = document.body.dataset.tmLowPower === 'true'
    if (context.state === 'suspended' && !isLowPower) {
      await context.resume()
    }

    if (!audioRef.current) {
      const audio = new Audio(src)
      audio.loop = true
      audio.preload = 'auto'
      audioRef.current = audio
    }

    if (!gainRef.current) {
      const gainNode = context.createGain()
      gainNode.gain.setValueAtTime(0.0001, context.currentTime)
      gainNode.connect(context.destination)
      gainRef.current = gainNode
    }

    if (!sourceRef.current && audioRef.current) {
      sourceRef.current = context.createMediaElementSource(audioRef.current)
      sourceRef.current.connect(gainRef.current)
    }

    graphReadyRef.current = true
  }, [plipAudioContextRef, src])

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    fadeGainTo(0.0001, 0.08)
  }, [fadeGainTo])

  const forceStopPlayback = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }

    const context = plipAudioContextRef.current
    const gain = gainRef.current
    if (context && gain) {
      gain.gain.cancelScheduledValues(context.currentTime)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
    }
  }, [plipAudioContextRef])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
      }

      sourceRef.current?.disconnect()
      sourceRef.current = null
      gainRef.current?.disconnect()
      gainRef.current = null
      graphReadyRef.current = false
    }
  }, [])

  useEffect(() => {
    const isLowPower = document.body.dataset.tmLowPower === 'true'
    const wantsPlayback = enabled && shouldPlay && !document.hidden && !isLowPower
    if (!wantsPlayback) {
      stopPlayback()
      return
    }

    void ensureGraph().then(() => {
      const ducked = preferExternalMedia && isExternalMediaPlaying
      const effectiveVolume = ducked ? 0.0001 : scaleMenuMusicVolume(targetVolume)
      fadeGainTo(Math.max(0.0001, effectiveVolume))

      const audio = audioRef.current
      if (!audio) {
        return
      }

      if (audio.paused) {
        void audio.play().catch(() => {
          // Autoplay may be blocked until the next user gesture.
        })
      }
    })
  }, [
    enabled,
    ensureGraph,
    fadeGainTo,
    isExternalMediaPlaying,
    preferExternalMedia,
    shouldPlay,
    stopPlayback,
    targetVolume,
  ])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPlayback()
        return
      }

      if (enabled && shouldPlay) {
        void ensureGraph().then(() => {
          const ducked = preferExternalMedia && isExternalMediaPlaying
          const effectiveVolume = ducked ? 0.0001 : scaleMenuMusicVolume(targetVolume)
          fadeGainTo(Math.max(0.0001, effectiveVolume))
          void audioRef.current?.play().catch(() => {})
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    enabled,
    ensureGraph,
    fadeGainTo,
    isExternalMediaPlaying,
    preferExternalMedia,
    shouldPlay,
    stopPlayback,
    targetVolume,
  ])

  const armFromUserGesture = useCallback(() => {
    void ensureGraph().then(() => {
      if (!enabled || !shouldPlay || document.hidden) {
        return
      }

      const ducked = preferExternalMedia && isExternalMediaPlaying
      const effectiveVolume = ducked ? 0.0001 : scaleMenuMusicVolume(targetVolume)
      fadeGainTo(Math.max(0.0001, effectiveVolume))
      void audioRef.current?.play().catch(() => {})
    })
  }, [
    enabled,
    ensureGraph,
    fadeGainTo,
    isExternalMediaPlaying,
    preferExternalMedia,
    shouldPlay,
    targetVolume,
  ])

  return {
    armFromUserGesture,
    stopPlayback,
    forceStopPlayback,
  }
}
