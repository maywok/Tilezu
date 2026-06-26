const SLIDER_SOUND_THROTTLE_MS = 60

export function createSettingsSliderSoundPlayer(playSlider: () => void) {
  let lastPlayedAt = 0
  let lastValue: number | null = null

  return (nextValue: number) => {
    if (!Number.isFinite(nextValue)) {
      return
    }

    if (lastValue === nextValue) {
      return
    }

    lastValue = nextValue

    const now = performance.now()
    if (now - lastPlayedAt < SLIDER_SOUND_THROTTLE_MS) {
      return
    }

    lastPlayedAt = now
    playSlider()
  }
}
