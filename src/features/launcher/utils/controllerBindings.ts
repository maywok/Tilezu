import { CONTROLLER_BIND_SYSTEM_KEYS } from '../constants'
import type {
  LauncherControllerAction,
  LauncherControllerBindingMap,
  LauncherControllerBindsBySystem,
  LauncherControllerInput,
  LauncherControllerLayout,
  LauncherControllerSystemBinds,
  LauncherGamepadFamily,
} from '../types'

export const CONTROLLER_LAYOUT_OPTIONS: Array<{ value: LauncherControllerLayout; label: string }> = [
  { value: 'xbox', label: 'Xbox' },
  { value: 'playstation', label: 'PlayStation' },
  { value: 'nintendo', label: 'Nintendo' },
]

export const CONTROLLER_ACTION_ORDER: LauncherControllerAction[] = [
  'navigate_up',
  'navigate_down',
  'navigate_left',
  'navigate_right',
  'confirm',
  'back',
  'open_settings',
  'toggle_view',
  'jump_top',
  'jump_bottom',
  'open_profile_rail',
  'open_functions_menu',
  'open_find_panel',
  'open_library_panel',
  'open_search',
  'tab_prev',
  'tab_next',
]

export const CONTROLLER_ESSENTIAL_ACTIONS: LauncherControllerAction[] = [
  'navigate_up',
  'navigate_down',
  'navigate_left',
  'navigate_right',
  'confirm',
  'back',
  'open_settings',
  'jump_top',
  'jump_bottom',
]

export const CONTROLLER_ADVANCED_ACTIONS: LauncherControllerAction[] = [
  'toggle_view',
  'open_profile_rail',
  'open_functions_menu',
  'open_find_panel',
  'open_library_panel',
  'open_search',
  'tab_prev',
  'tab_next',
]

/** Actions passed to RetroArch when launching a platform game. */
export const CONTROLLER_PLATFORM_ACTIONS: LauncherControllerAction[] = [
  'navigate_up',
  'navigate_down',
  'navigate_left',
  'navigate_right',
  'confirm',
  'back',
  'open_settings',
  'toggle_view',
  'jump_top',
  'jump_bottom',
]

export const CONTROLLER_PLATFORM_ACTION_LABELS: Partial<Record<LauncherControllerAction, string>> = {
  navigate_up: 'Up',
  navigate_down: 'Down',
  navigate_left: 'Left',
  navigate_right: 'Right',
  confirm: 'Confirm (A / Cross)',
  back: 'Back (B / Circle)',
  open_settings: 'RetroArch menu',
  toggle_view: 'Toggle fast-forward',
  jump_top: 'Left shoulder',
  jump_bottom: 'Right shoulder',
}

export const CONTROLLER_ACTION_LABELS: Record<LauncherControllerAction, string> = {
  navigate_up: 'Navigate Up',
  navigate_down: 'Navigate Down',
  navigate_left: 'Navigate Left',
  navigate_right: 'Navigate Right',
  confirm: 'Confirm / Select',
  back: 'Back',
  open_settings: 'Open Settings',
  toggle_view: 'Toggle View',
  jump_top: 'Jump To Top',
  jump_bottom: 'Jump To Bottom',
  open_profile_rail: 'Open Profile Rail',
  open_functions_menu: 'Open Functions Menu',
  open_find_panel: 'Open Find / Sort',
  open_library_panel: 'Open Library',
  open_search: 'Focus Search',
  tab_prev: 'Previous Section',
  tab_next: 'Next Section',
}

export const CONTROLLER_INPUT_ORDER: LauncherControllerInput[] = [
  'unbound',
  'dpad_up',
  'dpad_down',
  'dpad_left',
  'dpad_right',
  'left_stick_up',
  'left_stick_down',
  'left_stick_left',
  'left_stick_right',
  'right_stick_up',
  'right_stick_down',
  'right_stick_left',
  'right_stick_right',
  'face_south',
  'face_east',
  'face_west',
  'face_north',
  'left_shoulder',
  'right_shoulder',
  'left_trigger',
  'right_trigger',
  'left_stick_press',
  'right_stick_press',
  'start',
  'select',
]

export const CONTROLLER_INPUT_LABELS: Record<LauncherControllerInput, string> = {
  unbound: 'Unbound',
  dpad_up: 'D-Pad Up',
  dpad_down: 'D-Pad Down',
  dpad_left: 'D-Pad Left',
  dpad_right: 'D-Pad Right',
  left_stick_up: 'Left Stick Up',
  left_stick_down: 'Left Stick Down',
  left_stick_left: 'Left Stick Left',
  left_stick_right: 'Left Stick Right',
  right_stick_up: 'Right Stick Up',
  right_stick_down: 'Right Stick Down',
  right_stick_left: 'Right Stick Left',
  right_stick_right: 'Right Stick Right',
  face_south: 'Face South',
  face_east: 'Face East',
  face_west: 'Face West',
  face_north: 'Face North',
  left_shoulder: 'Left Shoulder',
  right_shoulder: 'Right Shoulder',
  left_trigger: 'Left Trigger',
  right_trigger: 'Right Trigger',
  left_stick_press: 'Left Stick Press',
  right_stick_press: 'Right Stick Press',
  start: 'Start',
  select: 'Select',
}

export const DEFAULT_CONTROLLER_BINDINGS: LauncherControllerBindingMap = {
  navigate_up: 'left_stick_up',
  navigate_down: 'left_stick_down',
  navigate_left: 'left_stick_left',
  navigate_right: 'left_stick_right',
  confirm: 'face_south',
  back: 'face_east',
  open_settings: 'unbound',
  toggle_view: 'face_north',
  jump_top: 'left_shoulder',
  jump_bottom: 'right_shoulder',
  open_profile_rail: 'left_stick_press',
  open_functions_menu: 'unbound',
  open_find_panel: 'select',
  open_library_panel: 'start',
  open_search: 'left_trigger',
  tab_prev: 'right_trigger',
  tab_next: 'unbound',
}

function createNintendoDefaultBindingsMap(): LauncherControllerBindingMap {
  return {
    ...DEFAULT_CONTROLLER_BINDINGS,
    confirm: 'face_east',
    back: 'face_south',
  }
}

export function layoutForGamepadFamily(
  family: LauncherGamepadFamily | null | undefined,
): LauncherControllerLayout {
  if (family === 'playstation') {
    return 'playstation'
  }

  if (family === 'nintendo') {
    return 'nintendo'
  }

  return 'xbox'
}

type FaceSemantic = 'a' | 'b' | 'x' | 'y'

function semanticFromFaceInput(
  layout: LauncherControllerLayout,
  input: LauncherControllerInput,
): FaceSemantic | null {
  switch (layout) {
    case 'nintendo':
      switch (input) {
        case 'face_south':
          return 'b'
        case 'face_east':
          return 'a'
        case 'face_west':
          return 'y'
        case 'face_north':
          return 'x'
        default:
          return null
      }
    case 'xbox':
    case 'playstation':
      switch (input) {
        case 'face_south':
          return 'a'
        case 'face_east':
          return 'b'
        case 'face_west':
          return 'x'
        case 'face_north':
          return 'y'
        default:
          return null
      }
    default:
      return null
  }
}

function faceInputFromSemantic(
  layout: LauncherControllerLayout,
  semantic: FaceSemantic,
): LauncherControllerInput {
  if (layout === 'nintendo') {
    switch (semantic) {
      case 'a':
        return 'face_east'
      case 'b':
        return 'face_south'
      case 'x':
        return 'face_north'
      case 'y':
        return 'face_west'
      default:
        return 'face_south'
    }
  }

  switch (semantic) {
    case 'a':
      return 'face_south'
    case 'b':
      return 'face_east'
    case 'x':
      return 'face_west'
    case 'y':
      return 'face_north'
    default:
      return 'face_south'
  }
}

export function remapBindingInputForLayout(
  input: LauncherControllerInput,
  sourceLayout: LauncherControllerLayout,
  targetLayout: LauncherControllerLayout,
): LauncherControllerInput {
  if (sourceLayout === targetLayout) {
    return input
  }

  const semantic = semanticFromFaceInput(sourceLayout, input)
  if (!semantic) {
    return input
  }

  return faceInputFromSemantic(targetLayout, semantic)
}

export function remapBindingInputForGamepadFamily(
  input: LauncherControllerInput,
  family: LauncherGamepadFamily | null | undefined,
): LauncherControllerInput {
  const targetLayout = layoutForGamepadFamily(family)
  return remapBindingInputForLayout(input, 'xbox', targetLayout)
}

function isLayout(value: unknown): value is LauncherControllerLayout {
  return value === 'xbox' || value === 'playstation' || value === 'nintendo'
}

function isAction(value: unknown): value is LauncherControllerAction {
  return typeof value === 'string' && CONTROLLER_ACTION_ORDER.includes(value as LauncherControllerAction)
}

function isInput(value: unknown): value is LauncherControllerInput {
  return typeof value === 'string' && CONTROLLER_INPUT_ORDER.includes(value as LauncherControllerInput)
}

function createDefaultBindingsMap(layout: LauncherControllerLayout = 'xbox'): LauncherControllerBindingMap {
  if (layout === 'nintendo') {
    return createNintendoDefaultBindingsMap()
  }

  return {
    ...DEFAULT_CONTROLLER_BINDINGS,
  }
}

function defaultControllerLayoutForSystem(systemKey: string): LauncherControllerLayout {
  const trimmed = systemKey.trim()
  if (
    trimmed.startsWith('Nintendo')
    || trimmed.startsWith('Game Boy')
    || trimmed === 'NES'
    || trimmed === 'SNES'
    || trimmed === 'N64'
    || trimmed === 'GameCube'
    || trimmed === 'Wii'
    || trimmed === 'Wii U'
    || trimmed === 'Switch'
  ) {
    return 'nintendo'
  }

  if (trimmed.startsWith('PS') || trimmed === 'PSP') {
    return 'playstation'
  }

  return 'xbox'
}

export function createDefaultControllerSystemBinds(layout: LauncherControllerLayout = 'nintendo'): LauncherControllerSystemBinds {
  return {
    layout,
    bindings: createDefaultBindingsMap(layout),
  }
}

export function createDefaultControllerBindsBySystem(systemKeys = CONTROLLER_BIND_SYSTEM_KEYS): LauncherControllerBindsBySystem {
  const next: LauncherControllerBindsBySystem = {}
  for (const key of systemKeys) {
    next[key] = createDefaultControllerSystemBinds(defaultControllerLayoutForSystem(key))
  }

  return next
}

function migrateLegacyFunctionBarBindings(bindings: LauncherControllerBindingMap): LauncherControllerBindingMap {
  const next = { ...bindings }

  if (next.open_library_panel === 'unbound' && next.open_settings === 'start') {
    next.open_library_panel = 'start'
    next.open_settings = 'unbound'
  }

  if (next.open_find_panel === 'unbound' && next.open_functions_menu === 'select') {
    next.open_find_panel = 'select'
    next.open_functions_menu = 'unbound'
  }

  return next
}

function normalizeSystemBindRecord(value: unknown): LauncherControllerSystemBinds {
  if (!value || typeof value !== 'object') {
    return createDefaultControllerSystemBinds()
  }

  const record = value as {
    layout?: unknown
    bindings?: Record<string, unknown>
  }

  const layout = isLayout(record.layout) ? record.layout : 'nintendo'
  const bindings = createDefaultBindingsMap(layout)

  if (record.bindings && typeof record.bindings === 'object') {
    for (const [action, input] of Object.entries(record.bindings)) {
      if (!isAction(action) || !isInput(input)) {
        continue
      }

      bindings[action] = input
    }
  }

  return {
    layout,
    bindings: migrateLegacyFunctionBarBindings(bindings),
  }
}

export function normalizeControllerBindsBySystem(
  value: unknown,
  systemKeys = CONTROLLER_BIND_SYSTEM_KEYS,
): LauncherControllerBindsBySystem {
  const normalized = createDefaultControllerBindsBySystem(systemKeys)
  if (!value || typeof value !== 'object') {
    return normalized
  }

  const entries = Object.entries(value as Record<string, unknown>)
  for (const [rawSystemKey, rawBinds] of entries) {
    const systemKey = rawSystemKey.trim()
    if (!systemKey) {
      continue
    }

    normalized[systemKey] = normalizeSystemBindRecord(rawBinds)
  }

  return normalized
}

export function normalizeLauncherControllerBinds(value: unknown): LauncherControllerSystemBinds {
  return normalizeSystemBindRecord(value)
}

export function resolveControllerSystemBinds(
  bindsBySystem: LauncherControllerBindsBySystem,
  systemKey: string | null | undefined,
): LauncherControllerSystemBinds {
  const normalizedKey = typeof systemKey === 'string' ? systemKey.trim() : ''
  if (normalizedKey && bindsBySystem[normalizedKey]) {
    return bindsBySystem[normalizedKey]
  }

  const firstKey = CONTROLLER_BIND_SYSTEM_KEYS[0]
  if (firstKey && bindsBySystem[firstKey]) {
    return bindsBySystem[firstKey]
  }

  return createDefaultControllerSystemBinds()
}

export function assignControllerBinding(
  source: LauncherControllerSystemBinds,
  action: LauncherControllerAction,
  input: LauncherControllerInput,
): LauncherControllerSystemBinds {
  const nextBindings = {
    ...source.bindings,
  }

  const previousInput = nextBindings[action]
  if (input !== 'unbound') {
    for (const candidateAction of CONTROLLER_ACTION_ORDER) {
      if (candidateAction === action) {
        continue
      }

      if (nextBindings[candidateAction] !== input) {
        continue
      }

      nextBindings[candidateAction] = previousInput
      break
    }
  }

  nextBindings[action] = input

  return {
    ...source,
    bindings: nextBindings,
  }
}

export function formatControllerInputForLayout(layout: LauncherControllerLayout, input: LauncherControllerInput): string {
  switch (input) {
    case 'unbound':
      return '--'
    case 'face_south':
      return layout === 'playstation' ? 'Cross' : layout === 'nintendo' ? 'B' : 'A'
    case 'face_east':
      return layout === 'playstation' ? 'Circle' : layout === 'nintendo' ? 'A' : 'B'
    case 'face_west':
      return layout === 'playstation' ? 'Square' : layout === 'nintendo' ? 'Y' : 'X'
    case 'face_north':
      return layout === 'playstation' ? 'Triangle' : layout === 'nintendo' ? 'X' : 'Y'
    case 'dpad_up':
      return 'D-Pad Up'
    case 'dpad_down':
      return 'D-Pad Down'
    case 'dpad_left':
      return 'D-Pad Left'
    case 'dpad_right':
      return 'D-Pad Right'
    case 'left_stick_up':
      return 'LS Up'
    case 'left_stick_down':
      return 'LS Down'
    case 'left_stick_left':
      return 'LS Left'
    case 'left_stick_right':
      return 'LS Right'
    case 'right_stick_up':
      return 'RS Up'
    case 'right_stick_down':
      return 'RS Down'
    case 'right_stick_left':
      return 'RS Left'
    case 'right_stick_right':
      return 'RS Right'
    case 'left_shoulder':
      return layout === 'playstation' ? 'L1' : layout === 'nintendo' ? 'L' : 'LB'
    case 'right_shoulder':
      return layout === 'playstation' ? 'R1' : layout === 'nintendo' ? 'R' : 'RB'
    case 'left_trigger':
      return layout === 'playstation' ? 'L2' : layout === 'nintendo' ? 'ZL' : 'LT'
    case 'right_trigger':
      return layout === 'playstation' ? 'R2' : layout === 'nintendo' ? 'ZR' : 'RT'
    case 'left_stick_press':
      return 'L3'
    case 'right_stick_press':
      return 'R3'
    case 'start':
      return layout === 'playstation' ? 'Options' : layout === 'nintendo' ? '+' : 'Menu'
    case 'select':
      return layout === 'playstation' ? 'Share' : layout === 'nintendo' ? '-' : 'View'
    default:
      return CONTROLLER_INPUT_LABELS[input]
  }
}

export function serializeControllerBindingsForLaunch(bindings: LauncherControllerBindingMap): string {
  return CONTROLLER_ACTION_ORDER
    .map((action) => `${action}:${bindings[action]}`)
    .join(',')
}

export function buildControllerLaunchArgsForSystem(
  systemKey: string | null | undefined,
  bindsBySystem: LauncherControllerBindsBySystem,
): string[] {
  if (!systemKey) {
    return []
  }

  const key = systemKey.trim()
  if (!key) {
    return []
  }

  const resolved = resolveControllerSystemBinds(bindsBySystem, key)
  return [
    `--tm-controller-layout=${resolved.layout}`,
    `--tm-controller-map=${serializeControllerBindingsForLaunch(resolved.bindings)}`,
  ]
}
