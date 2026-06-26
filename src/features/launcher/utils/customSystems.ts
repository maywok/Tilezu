import type { CategoryMeta, ConnectorHealth, CustomSystemDefinition, GameEntry } from '../types'
import { CUSTOM_SYSTEMS_STORAGE_KEY } from '../constants'
import { getGameSource } from './category'

const DEFAULT_CUSTOM_SYSTEM_PRIMARY = '#3c9bf5'
const DEFAULT_CUSTOM_SYSTEM_SECONDARY = '#69dcff'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const normalized = value
    .map((entry) => asString(entry).trim())
    .filter((entry) => entry.length > 0)

  return Array.from(new Set(normalized))
}

export function isValidHexColor(value: string): boolean {
  const normalized = value.trim()
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)
}

export function normalizeHexColor(value: string, fallback: string): string {
  const normalized = value.trim()
  if (!isValidHexColor(normalized)) {
    return fallback
  }

  return normalized.toLowerCase()
}

export function deriveCustomSystemShortLabel(name: string): string {
  const match = name.trim().match(/[A-Za-z0-9]/)
  return match?.[0]?.toUpperCase() ?? 'C'
}

export function sanitizeCustomSystemName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function createSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'system'
}

export function buildCustomSystemKey(name: string, takenKeys: Set<string>): string {
  const base = `custom-${createSlug(name)}`
  let candidate = base
  let index = 2

  while (takenKeys.has(candidate.toLowerCase())) {
    candidate = `${base}-${index}`
    index += 1
  }

  return candidate
}

function normalizeCustomSystem(value: unknown): CustomSystemDefinition | null {
  if (!isRecord(value)) {
    return null
  }

  const name = sanitizeCustomSystemName(asString(value.name))
  if (!name) {
    return null
  }

  const key = asString(value.key).trim().toLowerCase()
  if (!key) {
    return null
  }

  const now = Date.now()
  const accentPrimary = normalizeHexColor(asString(value.accentPrimary), DEFAULT_CUSTOM_SYSTEM_PRIMARY)
  const accentSecondary = normalizeHexColor(asString(value.accentSecondary), DEFAULT_CUSTOM_SYSTEM_SECONDARY)

  const hiddenValue = value.hidden
  const hidden = typeof hiddenValue === 'boolean' ? hiddenValue : false

  const ingestionModeValue = asString(value.ingestionMode)
  const ingestionMode = ingestionModeValue === 'smart' ? 'smart' : 'manual'

  const createdAtRaw = Number(value.createdAt)
  const updatedAtRaw = Number(value.updatedAt)

  const rules = isRecord(value.rules) ? value.rules : {}

  return {
    id: asString(value.id).trim() || crypto.randomUUID(),
    key,
    name,
    shortLabel: deriveCustomSystemShortLabel(asString(value.shortLabel) || name),
    iconPath: asString(value.iconPath).trim(),
    collageDataUrl: asString(value.collageDataUrl).trim(),
    accentPrimary,
    accentSecondary,
    description: asString(value.description).trim(),
    hidden,
    ingestionMode,
    rules: {
      includeSources: normalizeList(rules.includeSources),
      includePathHints: normalizeList(rules.includePathHints),
      includeExtensions: normalizeList(rules.includeExtensions),
    },
    createdAt: Number.isFinite(createdAtRaw) && createdAtRaw > 0 ? createdAtRaw : now,
    updatedAt: Number.isFinite(updatedAtRaw) && updatedAtRaw > 0 ? updatedAtRaw : now,
  }
}

export function loadCustomSystems(): CustomSystemDefinition[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_SYSTEMS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    const normalized = parsed
      .map((entry) => normalizeCustomSystem(entry))
      .filter((entry): entry is CustomSystemDefinition => Boolean(entry))

    const seen = new Set<string>()
    const deduped: CustomSystemDefinition[] = []

    for (const entry of normalized) {
      const normalizedKey = entry.key.toLowerCase()
      if (seen.has(normalizedKey)) {
        continue
      }

      seen.add(normalizedKey)
      deduped.push(entry)
    }

    const userOnly = deduped.filter((entry) => !isFactorySystemKey(entry.key))

    if (userOnly.length !== deduped.length) {
      saveCustomSystems(userOnly)
    }

    userOnly.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
    return userOnly
  } catch {
    return []
  }
}

export function filterUserCustomSystems(customSystems: CustomSystemDefinition[]): CustomSystemDefinition[] {
  return customSystems.filter((system) => !isFactorySystemKey(system.key))
}

export function saveCustomSystems(customSystems: CustomSystemDefinition[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CUSTOM_SYSTEMS_STORAGE_KEY, JSON.stringify(customSystems))
  } catch {
  }
}

export function toCustomSystemCategory(system: CustomSystemDefinition): CategoryMeta {
  return {
    key: system.key,
    label: system.name,
    short: system.shortLabel,
    logoPath: system.iconPath,
  }
}

export type FactorySystemDefinition = {
  key: string
  connectorId: string
  name: string
  description: string
  logoPath: string
  accentPrimary: string
  accentSecondary: string
  rules: {
    includeSources: string[]
    includePathHints: string[]
    includeExtensions: string[]
  }
}

export const FACTORY_SYSTEM_DEFINITIONS: FactorySystemDefinition[] = [
  {
    key: 'steam',
    connectorId: 'steam',
    name: 'Steam',
    description: 'Desktop Steam library with auto-sorted managed imports.',
    logoPath: '/platforms/steam.svg',
    accentPrimary: '#1b4a8f',
    accentSecondary: '#58a6ff',
    rules: {
      includeSources: ['steam'],
      includePathHints: [],
      includeExtensions: [],
    },
  },
  {
    key: 'epic',
    connectorId: 'epic',
    name: 'Epic',
    description: 'Epic Games Store library with auto-sorted managed imports.',
    logoPath: '/platforms/epic.svg',
    accentPrimary: '#111317',
    accentSecondary: '#6f7685',
    rules: {
      includeSources: ['epic'],
      includePathHints: [],
      includeExtensions: [],
    },
  },
  {
    key: 'battle-net',
    connectorId: 'battle_net',
    name: 'Battle.net',
    description: 'Battle.net library with auto-sorted managed imports.',
    logoPath: '/platforms/battlenet.svg',
    accentPrimary: '#0a2f63',
    accentSecondary: '#2ea2ff',
    rules: {
      includeSources: ['battle_net'],
      includePathHints: [],
      includeExtensions: [],
    },
  },
  {
    key: 'xbox',
    connectorId: 'xbox_app',
    name: 'Xbox',
    description: 'Microsoft Store and PC Game Pass titles installed through Xbox.',
    logoPath: '/platforms/xbox.svg',
    accentPrimary: '#187B3C',
    accentSecondary: '#B8BCC6',
    rules: {
      includeSources: ['xbox_app'],
      includePathHints: ['xboxgames'],
      includeExtensions: [],
    },
  },
]

const FACTORY_SYSTEM_KEY_SET = new Set(
  FACTORY_SYSTEM_DEFINITIONS.map((entry) => entry.key.trim().toLowerCase()),
)

export function isFactorySystemKey(key: string): boolean {
  return FACTORY_SYSTEM_KEY_SET.has(key.trim().toLowerCase())
}

export function omitFactorySystemKeys<T>(map: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = {}

  for (const [key, value] of Object.entries(map)) {
    if (isFactorySystemKey(key)) {
      continue
    }

    next[key] = value
  }

  return next
}

function libraryHasFactorySource(library: GameEntry[], sources: string[]): boolean {
  const normalizedSources = new Set(sources.map((value) => value.trim().toLowerCase()).filter(Boolean))
  if (normalizedSources.size === 0) {
    return false
  }

  return library.some((entry) => normalizedSources.has(getGameSource(entry)))
}

function connectorHasImports(connectors: ConnectorHealth[] | undefined, connectorId: string): boolean {
  if (!connectors || connectors.length === 0) {
    return false
  }

  const connector = connectors.find((entry) => entry.id.trim().toLowerCase() === connectorId.trim().toLowerCase())
  return (connector?.importCount ?? 0) > 0
}

function factoryDefinitionToCustomSystem(factory: FactorySystemDefinition, now = Date.now()): CustomSystemDefinition {
  return {
    id: `factory-${factory.key}`,
    key: factory.key,
    name: factory.name,
    shortLabel: deriveCustomSystemShortLabel(factory.name),
    iconPath: factory.logoPath,
    collageDataUrl: '',
    accentPrimary: factory.accentPrimary,
    accentSecondary: factory.accentSecondary,
    description: factory.description,
    hidden: false,
    ingestionMode: 'smart',
    rules: {
      includeSources: [...factory.rules.includeSources],
      includePathHints: [...factory.rules.includePathHints],
      includeExtensions: [...factory.rules.includeExtensions],
    },
    createdAt: now,
    updatedAt: now,
  }
}

function isFactorySystemActive(
  factory: FactorySystemDefinition,
  library: GameEntry[],
  connectors?: ConnectorHealth[],
): boolean {
  const hasGames = libraryHasFactorySource(library, factory.rules.includeSources)
  const hasConnectorImports = connectorHasImports(connectors, factory.connectorId)
  return hasGames || hasConnectorImports
}

/** Runtime-only factory platforms (Steam, Epic, Battle.net, Xbox) — never persisted to Library → Systems. */
export function computeActiveFactorySystems(
  library: GameEntry[],
  connectors?: ConnectorHealth[],
): CustomSystemDefinition[] {
  const now = Date.now()

  return FACTORY_SYSTEM_DEFINITIONS
    .filter((factory) => isFactorySystemActive(factory, library, connectors))
    .map((factory) => factoryDefinitionToCustomSystem(factory, now))
}

export function mergeLauncherCustomSystems(
  userCustomSystems: CustomSystemDefinition[],
  library: GameEntry[],
  connectors?: ConnectorHealth[],
): CustomSystemDefinition[] {
  const userOnly = filterUserCustomSystems(userCustomSystems)
  const activeFactorySystems = computeActiveFactorySystems(library, connectors)
  const seenKeys = new Set(userOnly.map((system) => system.key.trim().toLowerCase()))

  const merged = [...userOnly]
  for (const factorySystem of activeFactorySystems) {
    const normalizedKey = factorySystem.key.trim().toLowerCase()
    if (seenKeys.has(normalizedKey)) {
      continue
    }

    seenKeys.add(normalizedKey)
    merged.push(factorySystem)
  }

  merged.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }))
  return merged
}
