export function normalizeAnalogAxis(value: number, deadzone: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  const clamped = Math.max(-1, Math.min(1, value))
  const magnitude = Math.abs(clamped)
  const safeDeadzone = Math.max(0, Math.min(0.95, deadzone))
  if (magnitude <= safeDeadzone) {
    return 0
  }

  const normalizedMagnitude = (magnitude - safeDeadzone) / Math.max(0.001, 1 - safeDeadzone)
  return Math.sign(clamped) * Math.min(1, normalizedMagnitude)
}

export function resolveRightStickAxes(axes: readonly number[], deadzone: number): { x: number; y: number } {
  const candidatePairs: Array<readonly [number, number]> = [
    [2, 3],
    [2, 5],
    [3, 4],
    [4, 5],
  ]

  let bestX = 0
  let bestY = 0
  let bestMagnitude = 0

  for (const [xIndex, yIndex] of candidatePairs) {
    const x = normalizeAnalogAxis(Number.isFinite(axes[xIndex]) ? axes[xIndex] : 0, deadzone)
    const y = normalizeAnalogAxis(Number.isFinite(axes[yIndex]) ? axes[yIndex] : 0, deadzone)
    const magnitude = Math.max(Math.abs(x), Math.abs(y))

    if (magnitude > bestMagnitude) {
      bestMagnitude = magnitude
      bestX = x
      bestY = y
    }
  }

  return {
    x: bestX,
    y: bestY,
  }
}

export type GamepadAxisDirection = -1 | 0 | 1

export type GamepadAxisState = {
  horizontal: GamepadAxisDirection
  vertical: GamepadAxisDirection
  rightHorizontal: GamepadAxisDirection
  rightVertical: GamepadAxisDirection
}

export function resolveAxisDirection(
  value: number,
  previous: GamepadAxisDirection,
  commitThreshold: number,
  releaseDeadzone: number,
): GamepadAxisDirection {
  if (previous === 0) {
    if (value <= -commitThreshold) {
      return -1
    }

    if (value >= commitThreshold) {
      return 1
    }

    return 0
  }

  if (previous === -1) {
    if (value >= commitThreshold) {
      return 1
    }

    if (value > -releaseDeadzone) {
      return 0
    }

    return -1
  }

  if (value <= -commitThreshold) {
    return -1
  }

  if (value < releaseDeadzone) {
    return 0
  }

  return 1
}
