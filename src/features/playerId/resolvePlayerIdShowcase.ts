import type { GameEntry } from '../launcher/types'
import { formatPlaytimeMinutes, getGameCategory } from '../launcher/utils/category'
import type { PlayerIdFeaturedSystem, PlayerIdGameDisplay, PlayerIdLayoutPrefs, PlayerIdShowcase } from './types'

type CustomSystemLike = {
  iconPath?: string
  collageDataUrl?: string
}

type ResolveShowcaseInput = {
  library: GameEntry[]
  layout: PlayerIdLayoutPrefs
  resolvePlaytimeMinutes: (gameId: string) => number
  resolveCoverUrl: (gameId: string) => string
  customSystemByKey?: Record<string, CustomSystemLike>
}

function resolveGameDisplay(
  gameId: string,
  library: GameEntry[],
  resolvePlaytimeMinutes: (gameId: string) => number,
  resolveCoverUrl: (gameId: string) => string,
): PlayerIdGameDisplay | null {
  const id = gameId.trim()
  if (!id) {
    return null
  }

  const entry = library.find((game) => game.id === id)
  if (!entry) {
    return null
  }

  const minutes = resolvePlaytimeMinutes(entry.id)
  return {
    id: entry.id,
    title: entry.title,
    coverUrl: resolveCoverUrl(entry.id),
    playtimeText: minutes > 0 ? formatPlaytimeMinutes(minutes) : '',
  }
}

function resolveMostPlayedGame(
  library: GameEntry[],
  resolvePlaytimeMinutes: (gameId: string) => number,
  resolveCoverUrl: (gameId: string) => string,
): PlayerIdGameDisplay | null {
  let bestEntry: GameEntry | null = null
  let bestMinutes = -1

  for (const entry of library) {
    const minutes = resolvePlaytimeMinutes(entry.id)
    if (minutes > bestMinutes) {
      bestMinutes = minutes
      bestEntry = entry
    }
  }

  if (!bestEntry) {
    return library[0]
      ? resolveGameDisplay(library[0].id, library, resolvePlaytimeMinutes, resolveCoverUrl)
      : null
  }

  return resolveGameDisplay(bestEntry.id, library, resolvePlaytimeMinutes, resolveCoverUrl)
}

function buildSystemDisplay(
  systemKey: string,
  library: GameEntry[],
  customSystemByKey?: Record<string, CustomSystemLike>,
): PlayerIdFeaturedSystem | null {
  const key = systemKey.trim()
  if (!key) {
    return null
  }

  const custom = customSystemByKey?.[key]
  const match = library.find((entry) => getGameCategory(entry).key === key)
  if (match) {
    const category = getGameCategory(match)
    return {
      key: category.key,
      label: category.label,
      short: category.short,
      logoPath: custom?.iconPath?.trim() || category.logoPath,
      collageOverrideDataUrl: custom?.collageDataUrl?.trim() || undefined,
    }
  }

  if (custom?.iconPath?.trim()) {
    return {
      key,
      label: key.replace(/^custom-/, '').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      short: key.slice(0, 4).toUpperCase(),
      logoPath: custom.iconPath.trim(),
      collageOverrideDataUrl: custom.collageDataUrl?.trim() || undefined,
    }
  }

  return null
}

function resolveMostPlayedSystem(
  library: GameEntry[],
  resolvePlaytimeMinutes: (gameId: string) => number,
  customSystemByKey?: Record<string, CustomSystemLike>,
): PlayerIdFeaturedSystem | null {
  const totals = new Map<string, number>()

  for (const entry of library) {
    const category = getGameCategory(entry)
    const minutes = resolvePlaytimeMinutes(entry.id)
    totals.set(category.key, (totals.get(category.key) ?? 0) + minutes)
  }

  let bestKey = ''
  let bestMinutes = -1
  for (const [key, minutes] of totals) {
    if (minutes > bestMinutes) {
      bestKey = key
      bestMinutes = minutes
    }
  }

  if (!bestKey) {
    return null
  }

  return buildSystemDisplay(bestKey, library, customSystemByKey)
}

export function resolvePlayerIdShowcase({
  library,
  layout,
  resolvePlaytimeMinutes,
  resolveCoverUrl,
  customSystemByKey,
}: ResolveShowcaseInput): PlayerIdShowcase {
  const heroGame =
    resolveGameDisplay(layout.heroGameId, library, resolvePlaytimeMinutes, resolveCoverUrl)
    ?? resolveMostPlayedGame(library, resolvePlaytimeMinutes, resolveCoverUrl)

  const showcaseGames = layout.showcaseGameIds.map((gameId) =>
    resolveGameDisplay(gameId, library, resolvePlaytimeMinutes, resolveCoverUrl),
  ) as [PlayerIdGameDisplay | null, PlayerIdGameDisplay | null, PlayerIdGameDisplay | null]

  const featuredSystem =
    buildSystemDisplay(layout.featuredSystemKey, library, customSystemByKey)
    ?? resolveMostPlayedSystem(library, resolvePlaytimeMinutes, customSystemByKey)

  return {
    heroGame,
    showcaseGames,
    featuredSystem,
  }
}

export function listLibrarySystemOptions(library: GameEntry[]): Array<{ key: string; label: string }> {
  const seen = new Map<string, string>()
  for (const entry of library) {
    const category = getGameCategory(entry)
    if (!seen.has(category.key)) {
      seen.set(category.key, category.label)
    }
  }

  return Array.from(seen.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label))
}
