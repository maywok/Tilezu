import { CONTROLLER_BIND_SYSTEM_KEYS } from '../constants'
import type { GameEntry } from '../types'

export type PlatformPeripheralChoice = {
  value: string
  label: string
}

export type PlatformPeripheralOptionDefinition = {
  id: string
  label: string
  description: string
  choices: PlatformPeripheralChoice[]
  defaultValue: string
}

export type PlatformPeripheralsBySystem = Record<string, Record<string, string>>

const PLATFORM_PERIPHERAL_OPTIONS: Record<string, PlatformPeripheralOptionDefinition[]> = {
  Wii: [
    {
      id: 'wii_extension',
      label: 'Wiimote extension',
      description: 'Simulate a nunchuk or classic controller so games that require one still work.',
      choices: [
        { value: 'none', label: 'None (Wiimote only)' },
        { value: 'nunchuk', label: 'Nunchuk attached' },
        { value: 'classic', label: 'Classic Controller' },
      ],
      defaultValue: 'none',
    },
  ],
  N64: [
    {
      id: 'n64_pak',
      label: 'Controller Pak',
      description: 'Expansion pak slot for saves or rumble in N64 games.',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'rumble', label: 'Rumble Pak' },
        { value: 'controller', label: 'Controller Pak (memory)' },
      ],
      defaultValue: 'rumble',
    },
  ],
}

export function getPlatformPeripheralOptionsForSystem(systemKey: string): PlatformPeripheralOptionDefinition[] {
  const trimmed = systemKey.trim()
  if (!trimmed) {
    return []
  }

  return PLATFORM_PERIPHERAL_OPTIONS[trimmed] ?? []
}

export function createDefaultPlatformPeripheralsForSystem(systemKey: string): Record<string, string> {
  const options = getPlatformPeripheralOptionsForSystem(systemKey)
  const next: Record<string, string> = {}

  for (const option of options) {
    next[option.id] = option.defaultValue
  }

  return next
}

export function createDefaultPlatformPeripheralsBySystem(
  systemKeys = CONTROLLER_BIND_SYSTEM_KEYS,
): PlatformPeripheralsBySystem {
  const next: PlatformPeripheralsBySystem = {}

  for (const systemKey of systemKeys) {
    const defaults = createDefaultPlatformPeripheralsForSystem(systemKey)
    if (Object.keys(defaults).length > 0) {
      next[systemKey] = defaults
    }
  }

  return next
}

export function normalizePlatformPeripheralsBySystem(
  value: unknown,
  systemKeys = CONTROLLER_BIND_SYSTEM_KEYS,
): PlatformPeripheralsBySystem {
  const normalized = createDefaultPlatformPeripheralsBySystem(systemKeys)

  if (!value || typeof value !== 'object') {
    return normalized
  }

  for (const [rawSystemKey, rawOptions] of Object.entries(value as Record<string, unknown>)) {
    const systemKey = rawSystemKey.trim()
    if (!systemKey || !rawOptions || typeof rawOptions !== 'object') {
      continue
    }

    const definitions = getPlatformPeripheralOptionsForSystem(systemKey)
    if (definitions.length === 0) {
      continue
    }

    const defaults = createDefaultPlatformPeripheralsForSystem(systemKey)
    const stored = rawOptions as Record<string, unknown>

    for (const definition of definitions) {
      const rawValue = stored[definition.id]
      if (typeof rawValue !== 'string') {
        continue
      }

      const trimmedValue = rawValue.trim()
      if (definition.choices.some((choice) => choice.value === trimmedValue)) {
        defaults[definition.id] = trimmedValue
      }
    }

    normalized[systemKey] = defaults
  }

  return normalized
}

export function resolvePlatformPeripheralsForSystem(
  peripheralsBySystem: PlatformPeripheralsBySystem,
  systemKey: string | null | undefined,
): Record<string, string> {
  const trimmed = typeof systemKey === 'string' ? systemKey.trim() : ''
  if (trimmed && peripheralsBySystem[trimmed]) {
    return { ...peripheralsBySystem[trimmed] }
  }

  return createDefaultPlatformPeripheralsForSystem(trimmed)
}

export function buildPlatformPeripheralLaunchArgs(
  systemKey: string | null | undefined,
  peripheralsBySystem: PlatformPeripheralsBySystem,
): string[] {
  const resolved = resolvePlatformPeripheralsForSystem(peripheralsBySystem, systemKey)
  return Object.entries(resolved).map(([id, value]) => `--tm-peripheral=${id}:${value}`)
}

function managedArgValue(args: string[], key: string): string | null {
  const prefix = `--tm-${key.toLowerCase()}=`
  for (const rawArg of args) {
    const value = rawArg.trim()
    if (!value.toLowerCase().startsWith(prefix)) {
      continue
    }

    const parsed = value.slice(prefix.length).trim()
    if (parsed.length > 0) {
      return parsed
    }
  }

  return null
}

function firstManagedLaunchArg(args: string[]): string {
  for (const rawArg of args) {
    const value = rawArg.trim()
    if (!value || value.startsWith('--tm-')) {
      continue
    }

    return value
  }

  return ''
}

export const RETROARCH_AUTO_CORE_PROFILES = new Set([
  'ds',
  '3ds',
  'gba',
  'gameboy',
  'nes',
  'snes',
  'n64',
  'genesis',
  'dreamcast',
  'ps1',
  'psp',
])

export function inferRetroArchCoreProfileFromRomPath(romPath: string | null | undefined): string | null {
  const lowered = (romPath ?? '').trim().toLowerCase()
  if (!lowered) {
    return null
  }

  if (
    lowered.includes('\\dreamcast\\')
    || lowered.includes('/dreamcast/')
    || lowered.includes('sega dreamcast')
    || lowered.includes('\\dc\\')
    || lowered.includes('/dc/')
  ) {
    return 'dreamcast'
  }

  const extension = lowered.includes('.') ? lowered.split('.').pop() ?? '' : ''

  switch (extension) {
    case 'nds':
    case 'dsi':
    case 'srl':
      return 'ds'
    case '3ds':
    case 'cia':
    case '3dsx':
    case 'cci':
    case 'cxi':
    case 'app':
      return '3ds'
    case 'nes':
    case 'fds':
      return 'nes'
    case 'sfc':
    case 'smc':
    case 'fig':
      return 'snes'
    case 'gb':
    case 'gbc':
    case 'dmg':
      return 'gameboy'
    case 'gba':
    case 'agb':
      return 'gba'
    case 'n64':
    case 'z64':
    case 'v64':
      return 'n64'
    case 'gen':
    case 'md':
    case 'smd':
      return 'genesis'
    case 'gdi':
    case 'cdi':
      return 'dreamcast'
    case 'pbp':
    case 'cue':
    case 'img':
      return 'ps1'
    case 'cso':
    case 'prx':
      return 'psp'
    default:
      return null
  }
}

export function canAutoEnsureRetroArchCoreForEntries(entries: Pick<GameEntry, 'args'>[]): boolean {
  for (const entry of entries) {
    const profile = managedArgValue(entry.args ?? [], 'profile')?.toLowerCase() ?? ''
    if (profile && profile !== 'retroarch' && RETROARCH_AUTO_CORE_PROFILES.has(profile)) {
      return true
    }

    const romPath = firstManagedLaunchArg(entry.args ?? [])
    const inferred = inferRetroArchCoreProfileFromRomPath(romPath)
    if (inferred && RETROARCH_AUTO_CORE_PROFILES.has(inferred)) {
      return true
    }
  }

  return false
}
