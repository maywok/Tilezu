import type { LauncherControllerAction, LauncherControllerInput } from '../types'
import { resolveRightStickAxes } from './gamepadStickReading'

export type GamepadStickTuning = {
  axisArmDeadzone: number
  axisCommitThreshold: number
  axisReleaseDeadzone: number
  navigationCommitThreshold: number
  navigationReleaseDeadzone: number
  navigationHoldDelayMs: number
  invertLeftStickY: boolean
  repeatMinIntervalMs: number
  repeatMaxIntervalMs: number
}

export type GamepadStickNavState = {
  holdStartedAt: number
  holdConfirmed: boolean
  nextRepeatAt: number
}

const STICK_INPUTS = new Set<LauncherControllerInput>([
  'left_stick_up',
  'left_stick_down',
  'left_stick_left',
  'left_stick_right',
  'right_stick_up',
  'right_stick_down',
  'right_stick_left',
  'right_stick_right',
])

const NAVIGATION_DIRECTION_INPUTS: Partial<Record<
  LauncherControllerAction,
  { dpad: LauncherControllerInput; stick: LauncherControllerInput }
>> = {
  navigate_up: { dpad: 'dpad_up', stick: 'left_stick_up' },
  navigate_down: { dpad: 'dpad_down', stick: 'left_stick_down' },
  navigate_left: { dpad: 'dpad_left', stick: 'left_stick_left' },
  navigate_right: { dpad: 'dpad_right', stick: 'left_stick_right' },
}

export function isStickInput(input: LauncherControllerInput): boolean {
  return STICK_INPUTS.has(input)
}

export function resolveNavigationStickInput(boundInput: LauncherControllerInput): LauncherControllerInput {
  switch (boundInput) {
    case 'dpad_up':
      return 'left_stick_up'
    case 'dpad_down':
      return 'left_stick_down'
    case 'dpad_left':
      return 'left_stick_left'
    case 'dpad_right':
      return 'left_stick_right'
    default:
      return boundInput
  }
}

export function resolveEffectiveStickInput(boundInput: LauncherControllerInput): LauncherControllerInput {
  if (isStickInput(boundInput)) {
    return boundInput
  }

  return resolveNavigationStickInput(boundInput)
}

export function isNavigationStickActive(
  action: LauncherControllerAction,
  snapshot: Record<LauncherControllerInput, boolean>,
): boolean {
  const direction = NAVIGATION_DIRECTION_INPUTS[action]
  if (!direction) {
    return false
  }

  return Boolean(snapshot[direction.stick])
}

export function isDirectionalActionPressed(
  action: LauncherControllerAction,
  boundInput: LauncherControllerInput,
  snapshot: Record<LauncherControllerInput, boolean>,
): boolean {
  const direction = NAVIGATION_DIRECTION_INPUTS[action]
  if (direction) {
    if (snapshot[direction.dpad] || snapshot[direction.stick]) {
      return true
    }
  }

  if (boundInput !== 'unbound') {
    if (snapshot[boundInput]) {
      return true
    }

    const stickAlias = resolveNavigationStickInput(boundInput)
    if (stickAlias !== boundInput && isStickInput(stickAlias) && snapshot[stickAlias]) {
      return true
    }
  }

  return false
}

export function resolveDirectionalInputSource(
  action: LauncherControllerAction,
  boundInput: LauncherControllerInput,
  snapshot: Record<LauncherControllerInput, boolean>,
): 'none' | 'dpad' | 'stick' {
  if (!action.startsWith('navigate_')) {
    return 'none'
  }

  const direction = NAVIGATION_DIRECTION_INPUTS[action]
  if (direction) {
    if (snapshot[direction.dpad]) {
      return 'dpad'
    }

    if (snapshot[direction.stick]) {
      return 'stick'
    }
  }

  if (boundInput !== 'unbound') {
    if (snapshot[boundInput]) {
      return isStickInput(boundInput) ? 'stick' : 'dpad'
    }
  }

  return 'none'
}

export function applyLeftStickYOrientation(axis1: number, tuning: GamepadStickTuning): number {
  return tuning.invertLeftStickY ? -axis1 : axis1
}

function stickAxisStrengthAtThreshold(rawValue: number, commitThreshold: number): number {
  const magnitude = Math.abs(rawValue)
  if (!Number.isFinite(magnitude) || magnitude < commitThreshold) {
    return 0
  }

  const normalized = (magnitude - commitThreshold) / Math.max(0.001, 1 - commitThreshold)
  return Math.max(0, Math.min(1, normalized))
}

export function stickAxisStrength(rawValue: number, tuning: GamepadStickTuning): number {
  return stickAxisStrengthAtThreshold(rawValue, tuning.axisCommitThreshold)
}

export function resolveBoundStickMagnitude(
  boundInput: LauncherControllerInput,
  axes: readonly number[],
  tuning: GamepadStickTuning,
  snapshot: Record<LauncherControllerInput, boolean>,
  action?: LauncherControllerAction,
): number {
  const direction = action ? NAVIGATION_DIRECTION_INPUTS[action] : null
  const stickActive = direction
    ? Boolean(snapshot[direction.stick])
    : isStickInput(boundInput) && Boolean(snapshot[boundInput])

  if (!stickActive) {
    return 0
  }

  const effectiveInput = direction?.stick ?? resolveEffectiveStickInput(boundInput)
  if (!isStickInput(effectiveInput)) {
    return 0
  }

  const axis0 = Number.isFinite(axes[0]) ? axes[0] : 0
  const axis1 = applyLeftStickYOrientation(Number.isFinite(axes[1]) ? axes[1] : 0, tuning)
  const rightStick = resolveRightStickAxes(axes, tuning.axisArmDeadzone)
  const navigationCommitThreshold = direction ? tuning.navigationCommitThreshold : tuning.axisCommitThreshold

  switch (effectiveInput) {
    case 'left_stick_up':
      return stickAxisStrengthAtThreshold(-axis1, navigationCommitThreshold)
    case 'left_stick_down':
      return stickAxisStrengthAtThreshold(axis1, navigationCommitThreshold)
    case 'left_stick_left':
      return stickAxisStrengthAtThreshold(-axis0, navigationCommitThreshold)
    case 'left_stick_right':
      return stickAxisStrengthAtThreshold(axis0, navigationCommitThreshold)
    case 'right_stick_up':
      return stickAxisStrengthAtThreshold(-rightStick.y, tuning.axisCommitThreshold)
    case 'right_stick_down':
      return stickAxisStrengthAtThreshold(rightStick.y, tuning.axisCommitThreshold)
    case 'right_stick_left':
      return stickAxisStrengthAtThreshold(-rightStick.x, tuning.axisCommitThreshold)
    case 'right_stick_right':
      return stickAxisStrengthAtThreshold(rightStick.x, tuning.axisCommitThreshold)
    default:
      return 0
  }
}

export function computeStickRepeatIntervalMs(magnitude: number, tuning: GamepadStickTuning): number {
  const clamped = Math.max(0, Math.min(1, magnitude))
  return Math.round(
    tuning.repeatMaxIntervalMs - clamped * (tuning.repeatMaxIntervalMs - tuning.repeatMinIntervalMs),
  )
}

export function processStickNavigationHold(
  isActive: boolean,
  magnitude: number,
  now: number,
  tuning: GamepadStickTuning,
  state: GamepadStickNavState,
  onRepeat: () => void,
): GamepadStickNavState {
  if (!isActive) {
    return {
      holdStartedAt: 0,
      holdConfirmed: false,
      nextRepeatAt: 0,
    }
  }

  if (state.holdStartedAt === 0) {
    return {
      holdStartedAt: now,
      holdConfirmed: false,
      nextRepeatAt: 0,
    }
  }

  if (!state.holdConfirmed) {
    if (now - state.holdStartedAt < tuning.navigationHoldDelayMs) {
      return state
    }

    onRepeat()
    return {
      holdStartedAt: state.holdStartedAt,
      holdConfirmed: true,
      nextRepeatAt: now + computeStickRepeatIntervalMs(magnitude, tuning),
    }
  }

  if (now >= state.nextRepeatAt) {
    onRepeat()
    return {
      holdStartedAt: state.holdStartedAt,
      holdConfirmed: true,
      nextRepeatAt: now + computeStickRepeatIntervalMs(magnitude, tuning),
    }
  }

  return state
}

export function pickExclusiveStickNavigationAction(
  snapshot: Record<LauncherControllerInput, boolean>,
): LauncherControllerAction | null {
  const candidates: Array<{ action: LauncherControllerAction; input: LauncherControllerInput }> = [
    { action: 'navigate_up', input: 'left_stick_up' },
    { action: 'navigate_down', input: 'left_stick_down' },
    { action: 'navigate_left', input: 'left_stick_left' },
    { action: 'navigate_right', input: 'left_stick_right' },
  ]

  for (const candidate of candidates) {
    if (snapshot[candidate.input]) {
      return candidate.action
    }
  }

  return null
}