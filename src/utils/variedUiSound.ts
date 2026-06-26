export type SoundVariationOptions = {
  rateMin?: number
  rateMax?: number
  volumeJitter?: number
  preservePitch?: boolean
}

export type SoundVariationSample = {
  playbackRate: number
  volumeMultiplier: number
}

const DEFAULT_RATE_MIN = 0.94
const DEFAULT_RATE_MAX = 1.06
const DEFAULT_VOLUME_JITTER = 0.05

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function sampleSoundVariation(options: SoundVariationOptions = {}): SoundVariationSample {
  const rateMin = options.rateMin ?? DEFAULT_RATE_MIN
  const rateMax = options.rateMax ?? DEFAULT_RATE_MAX
  const volumeJitter = options.volumeJitter ?? DEFAULT_VOLUME_JITTER
  const playbackRate = rateMin + Math.random() * (rateMax - rateMin)
  const volumeMultiplier = 1 + (Math.random() * 2 - 1) * volumeJitter

  return { playbackRate, volumeMultiplier }
}

function applyPitchBehavior(audio: HTMLAudioElement, preservePitch: boolean): void {
  audio.preservesPitch = preservePitch
  ;(audio as HTMLAudioElement & { mozPreservesPitch?: boolean }).mozPreservesPitch = preservePitch
  ;(audio as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = preservePitch
}

export function applyVariationToAudio(
  audio: HTMLAudioElement,
  baseVolume: number,
  options: SoundVariationOptions = {},
): SoundVariationSample {
  const sample = sampleSoundVariation(options)
  audio.playbackRate = sample.playbackRate
  applyPitchBehavior(audio, options.preservePitch ?? false)
  audio.volume = clampUnit(baseVolume * sample.volumeMultiplier)
  return sample
}

export function playVariedClone(
  original: HTMLAudioElement,
  options: SoundVariationOptions = {},
  onEnded?: (audio: HTMLAudioElement) => void,
): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const clone = original.cloneNode(true) as HTMLAudioElement
    applyVariationToAudio(clone, original.volume, options)
    void clone.play().catch(() => {
      // Ignore autoplay/decode issues for optional UI cues.
    })

    if (onEnded) {
      clone.addEventListener('ended', () => onEnded(clone), { once: true })
    }

    return clone
  } catch {
    return null
  }
}

export function playVariedOneShot(
  source: string | HTMLAudioElement,
  volume = 0.52,
  options: SoundVariationOptions = {},
  onEnded?: (audio: HTMLAudioElement) => void,
): HTMLAudioElement | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const audio = typeof source === 'string' ? new Audio(source) : (source.cloneNode(true) as HTMLAudioElement)
    audio.preload = 'auto'
    applyVariationToAudio(audio, volume, options)
    void audio.play().catch(() => {
      // Ignore autoplay/decode issues for optional UI cues.
    })

    if (onEnded) {
      audio.addEventListener('ended', () => onEnded(audio), { once: true })
    }

    return audio
  } catch {
    return null
  }
}

export function playVariedSoundCue(
  soundUrl: string,
  volume = 0.52,
  options?: SoundVariationOptions,
): void {
  playVariedOneShot(soundUrl, volume, options)
}
