import type {
  CategoryMeta,
  GameEntry,
  GameLibraryMeta,
  GridGroupMode,
  GridSortMode,
  LauncherCategory,
} from '../types'
import { DEFAULT_CATEGORY, getGameCategory, labels } from './category'
import { getFuzzySearchScore, normalizeGameTitle } from './search'

function sourceFromArgs(args: string[]): string {
  for (const raw of args) {
    const value = raw.trim()
    if (!value.startsWith('--tm-source=')) {
      continue
    }

    const source = value.slice('--tm-source='.length).trim().toLowerCase()
    if (source.length > 0) {
      return source
    }
  }

  return ''
}

function firstLaunchArg(args: string[]): string {
  for (const raw of args) {
    const value = raw.trim()
    if (!value || value.startsWith('--tm-')) {
      continue
    }

    return value.toLowerCase()
  }

  return ''
}

function catalogIdentityKey(entry: GameEntry): string {
  const kind = entry.kind.trim().toLowerCase()
  const target = entry.target.trim().toLowerCase()
  const title = normalizeGameTitle(entry.title).trim().toLowerCase()
  const source = sourceFromArgs(entry.args || [])

  if (kind === 'steam' || source === 'steam') {
    return `steam::${target || title}`
  }

  if (kind === 'battle_net' || source === 'battle_net') {
    return `battle_net::${target || title}`
  }

  if (kind === 'xbox' || source === 'xbox_app') {
    return `xbox_app::${target || title}`
  }

  if (kind === 'emulator' || source === 'rom') {
    const rom = firstLaunchArg(entry.args || [])
    return `emulator::${rom || target || title}`
  }

  if (source.length > 0) {
    return `${source}::${target || title}`
  }

  return `${kind}::${target || title}`
}

function isRedundantLauncherLink(entry: GameEntry): boolean {
  const target = entry.target.trim().toLowerCase()
  return [
    '__battle_net__',
    '__epic_launcher__',
    '__ea_app__',
    '__ubisoft_connect__',
    '__xbox_app__',
    '__riot_client__',
    '__minecraft_launcher__',
  ].includes(target)
}

function compareByTitle(left: GameEntry, right: GameEntry): number {
  return normalizeGameTitle(left.title).localeCompare(normalizeGameTitle(right.title), undefined, {
    sensitivity: 'base',
    numeric: true,
  })
}

export type CatalogSectionSnapshot = {
  key: string
  label: string
  categoryKey?: LauncherCategory
  logoPath?: string
  entryIds: string[]
  startIndex: number
}

export type CatalogModelComputeInput = {
  normalizedSearchQuery: string
  library: GameEntry[]
  activeCategory: LauncherCategory
  gridSortMode: GridSortMode
  gridGroupMode: GridGroupMode
  gameMetaById: Record<string, GameLibraryMeta>
  playtimeMinutesByGame: Record<string, number>
  customSystemCategories?: CategoryMeta[]
  customSystemAssignmentsBySystemKey?: Record<string, string[]>
}

export type CatalogModelSnapshot = {
  catalogEntryIds: string[]
  searchScoreByGameId: Record<string, number>
  categoryByGameId: Record<string, CategoryMeta>
  filteredEntryIds: string[]
  categories: CategoryMeta[]
  visibleEntryIds: string[]
  canSortBySystem: boolean
  scrollVisibleEntryIds: string[]
  gridVisibleEntryIds: string[]
  gridCategoryByGameId: Record<string, CategoryMeta>
  gridSections: CatalogSectionSnapshot[]
}

export function computeCatalogModelSnapshot(input: CatalogModelComputeInput): CatalogModelSnapshot {
  const {
    normalizedSearchQuery,
    library,
    activeCategory,
    gridSortMode,
    gridGroupMode,
    gameMetaById,
    playtimeMinutesByGame,
    customSystemCategories = [],
    customSystemAssignmentsBySystemKey = {},
  } = input

  const seen = new Set<string>()
  const catalogLibrary: GameEntry[] = []

  for (const entry of library) {
    if (isRedundantLauncherLink(entry)) {
      continue
    }

    const key = catalogIdentityKey(entry)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    catalogLibrary.push(entry)
  }

  const searchScoreByGameId: Record<string, number> = {}
  if (normalizedSearchQuery) {
    for (const item of catalogLibrary) {
      const titleScore = getFuzzySearchScore(normalizeGameTitle(item.title), normalizedSearchQuery)
      const sourceScore = Math.round(getFuzzySearchScore(labels[item.kind], normalizedSearchQuery) * 0.46)
      const targetScore = Math.round(getFuzzySearchScore(item.target, normalizedSearchQuery) * 0.2)
      const bestScore = Math.max(titleScore, sourceScore, targetScore)
      if (bestScore > 0) {
        searchScoreByGameId[item.id] = bestScore
      }
    }
  }

  const customCategoryByKey = new Map<LauncherCategory, CategoryMeta>()
  for (const customCategory of customSystemCategories) {
    if (!customCategory || customCategory.key === 'all') {
      continue
    }

    customCategoryByKey.set(customCategory.key, customCategory)
  }

  const toFallbackCategory = (key: string): CategoryMeta => {
    const label = key
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (value) => value.toUpperCase())

    const short = label
      .split(' ')
      .map((token) => token[0] ?? '')
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'SYS'

    return {
      key,
      label,
      short,
      logoPath: '/platforms/emulator.svg',
    }
  }

  const categoryByGameId: Record<string, CategoryMeta> = {}
  for (const entry of catalogLibrary) {
    const isUserAddedExecutable =
      entry.kind === 'executable'
      && (entry.args ?? []).some((arg) => arg.trim().toLowerCase() === '--tm-user-added=1')
      && typeof entry.manualSystemKey === 'string'
      && entry.manualSystemKey.trim().length > 0

    if (isUserAddedExecutable) {
      const manualKey = entry.manualSystemKey!.trim().toLowerCase()
      categoryByGameId[entry.id] = customCategoryByKey.get(manualKey) ?? toFallbackCategory(manualKey)
      continue
    }

    categoryByGameId[entry.id] = getGameCategory(entry)
  }

  const activeCustomAssignedIds = new Set<string>(
    customCategoryByKey.has(activeCategory)
      ? [
          ...(customSystemAssignmentsBySystemKey[activeCategory] ?? []),
          ...catalogLibrary
            .filter((entry) => entry.kind === 'executable' && (entry.manualSystemKey ?? '').trim().toLowerCase() === activeCategory)
            .map((entry) => entry.id),
        ]
      : [],
  )

  const filteredGames = !normalizedSearchQuery
    ? catalogLibrary
    : [...catalogLibrary]
        .filter((item) => (searchScoreByGameId[item.id] ?? 0) > 0)
        .sort((left, right) => {
          const scoreDelta = (searchScoreByGameId[right.id] ?? 0) - (searchScoreByGameId[left.id] ?? 0)
          if (scoreDelta !== 0) {
            return scoreDelta
          }

          return compareByTitle(left, right)
        })

  const categories: CategoryMeta[] = [DEFAULT_CATEGORY]
  const seenCategories = new Set<LauncherCategory>(['all'])

  for (const entry of catalogLibrary) {
    const category = categoryByGameId[entry.id] ?? getGameCategory(entry)
    if (category.key === 'links' || category.key === 'applications') {
      continue
    }

    if (seenCategories.has(category.key)) {
      continue
    }

    seenCategories.add(category.key)
    categories.push(category)
  }

  for (const customCategory of customSystemCategories) {
    if (!customCategory || customCategory.key === 'all') {
      continue
    }

    if (seenCategories.has(customCategory.key)) {
      continue
    }

    seenCategories.add(customCategory.key)
    categories.push(customCategory)
  }

  const visibleGames =
    activeCategory === 'all'
      ? filteredGames
      : customCategoryByKey.has(activeCategory)
        ? filteredGames.filter((entry) => {
            const categoryKey = (categoryByGameId[entry.id] ?? getGameCategory(entry)).key
            return activeCustomAssignedIds.has(entry.id) || categoryKey === activeCategory
          })
        : filteredGames.filter((entry) => (categoryByGameId[entry.id] ?? getGameCategory(entry)).key === activeCategory)

  const canSortBySystem = activeCategory === 'all'

  const resolveMostPlayedMinutes = (entryId: string): number => {
    const trackedMinutes = Math.max(0, Math.floor(gameMetaById[entryId]?.trackedPlaytimeMinutes ?? 0))
    const fetchedMinutes = Math.max(0, Math.floor(playtimeMinutesByGame[entryId] ?? 0))
    return Math.max(trackedMinutes, fetchedMinutes)
  }

  const compareBySelectedSortMode = (left: GameEntry, right: GameEntry): number => {
    const leftMeta = gameMetaById[left.id]
    const rightMeta = gameMetaById[right.id]

    if (gridSortMode === 'title-asc') {
      return compareByTitle(left, right)
    }

    if (gridSortMode === 'title-desc') {
      return compareByTitle(right, left)
    }

    if (gridSortMode === 'recently-played') {
      const leftRecent = leftMeta?.lastPlayedAt ?? 0
      const rightRecent = rightMeta?.lastPlayedAt ?? 0
      if (leftRecent !== rightRecent) {
        return rightRecent - leftRecent
      }

      return compareByTitle(left, right)
    }

    if (gridSortMode === 'most-played') {
      const leftScore = (leftMeta?.playCount ?? 0) * 100000 + resolveMostPlayedMinutes(left.id)
      const rightScore = (rightMeta?.playCount ?? 0) * 100000 + resolveMostPlayedMinutes(right.id)
      if (leftScore !== rightScore) {
        return rightScore - leftScore
      }

      return compareByTitle(left, right)
    }

    if (gridSortMode === 'date-added') {
      const leftAdded = leftMeta?.addedAt ?? 0
      const rightAdded = rightMeta?.addedAt ?? 0
      if (leftAdded !== rightAdded) {
        return rightAdded - leftAdded
      }

      return compareByTitle(left, right)
    }

    if (gridSortMode === 'favorites') {
      const leftFav = leftMeta?.isFavorite ? 1 : 0
      const rightFav = rightMeta?.isFavorite ? 1 : 0
      if (leftFav !== rightFav) {
        return rightFav - leftFav
      }

      const favoriteDelta = (rightMeta?.favoritedAt ?? 0) - (leftMeta?.favoritedAt ?? 0)
      if (favoriteDelta !== 0) {
        return favoriteDelta
      }

      const recentDelta = (rightMeta?.lastPlayedAt ?? 0) - (leftMeta?.lastPlayedAt ?? 0)
      if (recentDelta !== 0) {
        return recentDelta
      }

      return compareByTitle(left, right)
    }

    if (gridSortMode === 'category' && canSortBySystem) {
      const leftCategory = categoryByGameId[left.id] ?? getGameCategory(left)
      const rightCategory = categoryByGameId[right.id] ?? getGameCategory(right)
      const categoryDelta = leftCategory.label.localeCompare(rightCategory.label, undefined, {
        sensitivity: 'base',
        numeric: true,
      })
      if (categoryDelta !== 0) {
        return categoryDelta
      }

      return compareByTitle(left, right)
    }

    return compareByTitle(left, right)
  }

  const scrollVisibleGames = (() => {
    if (visibleGames.length <= 1) {
      return visibleGames
    }

    const visibleOrderById: Record<string, number> = {}
    for (let index = 0; index < visibleGames.length; index += 1) {
      visibleOrderById[visibleGames[index].id] = index
    }

    const favorites = visibleGames
      .filter((entry) => Boolean(gameMetaById[entry.id]?.isFavorite))
      .sort((left, right) => {
        const leftMeta = gameMetaById[left.id]
        const rightMeta = gameMetaById[right.id]
        const favoriteDelta = (rightMeta?.favoritedAt ?? 0) - (leftMeta?.favoritedAt ?? 0)
        if (favoriteDelta !== 0) {
          return favoriteDelta
        }

        const recentDelta = (rightMeta?.lastPlayedAt ?? 0) - (leftMeta?.lastPlayedAt ?? 0)
        if (recentDelta !== 0) {
          return recentDelta
        }

        return (visibleOrderById[left.id] ?? 0) - (visibleOrderById[right.id] ?? 0)
      })

    const nonFavorites = visibleGames.filter((entry) => !gameMetaById[entry.id]?.isFavorite)
    if (gridSortMode === 'favorites') {
      return [...favorites, ...nonFavorites]
    }

    const entries = [...visibleGames]
    entries.sort(compareBySelectedSortMode)
    return entries
  })()

  const gridVisibleGames = (() => {
    const entries = [...visibleGames]
    if (entries.length <= 1) {
      return entries
    }

    entries.sort(compareBySelectedSortMode)

    return entries
  })()

  const gridCategoryByGameId: Record<string, CategoryMeta> = {}
  for (const entry of gridVisibleGames) {
    if (customCategoryByKey.has(activeCategory) && activeCustomAssignedIds.has(entry.id)) {
      gridCategoryByGameId[entry.id] = customCategoryByKey.get(activeCategory) ?? (categoryByGameId[entry.id] ?? getGameCategory(entry))
    } else {
      gridCategoryByGameId[entry.id] = categoryByGameId[entry.id] ?? getGameCategory(entry)
    }
  }

  const buildGroupedSections = (
    entries: GameEntry[],
    startIndex: number,
    keyPrefix: string,
    fallbackLabel = '',
  ): CatalogSectionSnapshot[] => {
    if (entries.length === 0) {
      return []
    }

    if (gridGroupMode === 'none') {
      const fallbackCategory = entries[0] ? (gridCategoryByGameId[entries[0].id] ?? getGameCategory(entries[0])) : null
      return [
        {
          key: `${keyPrefix}-all`,
          label: fallbackLabel,
          categoryKey: fallbackCategory?.key,
          logoPath: fallbackCategory?.logoPath,
          entryIds: entries.map((entry) => entry.id),
          startIndex,
        },
      ]
    }

    const grouped = new Map<string, {
      label: string
      categoryKey: LauncherCategory
      logoPath: string
      entries: GameEntry[]
    }>()
    for (const entry of entries) {
      const category = gridCategoryByGameId[entry.id] ?? getGameCategory(entry)
      const existing = grouped.get(category.key)
      if (existing) {
        existing.entries.push(entry)
      } else {
        grouped.set(category.key, {
          label: category.label,
          categoryKey: category.key,
          logoPath: category.logoPath,
          entries: [entry],
        })
      }
    }

    const sections: CatalogSectionSnapshot[] = []
    let sectionStart = startIndex
    for (const [key, section] of grouped.entries()) {
      sections.push({
        key: `${keyPrefix}-${key}`,
        label: section.label,
        categoryKey: section.categoryKey,
        logoPath: section.logoPath,
        entryIds: section.entries.map((entry) => entry.id),
        startIndex: sectionStart,
      })
      sectionStart += section.entries.length
    }

    return sections
  }

  const gridSections = (() => {
    if (gridSortMode === 'favorites') {
      const favorites = gridVisibleGames.filter((entry) => Boolean(gameMetaById[entry.id]?.isFavorite))
      const rest = gridVisibleGames.filter((entry) => !gameMetaById[entry.id]?.isFavorite)

      const favoriteSections = favorites.length
        ? [
            {
              key: 'favorites-all',
              label: 'Favorites',
              entryIds: favorites.map((entry) => entry.id),
              startIndex: 0,
            },
          ]
        : []

      const restSections = buildGroupedSections(rest, favorites.length, 'others', 'All Games')
      return [...favoriteSections, ...restSections]
    }

    if (gridGroupMode === 'none') {
      return [
        {
          key: 'all-games',
          label: '',
          entryIds: gridVisibleGames.map((entry) => entry.id),
          startIndex: 0,
        },
      ]
    }

    const grouped = new Map<string, {
      label: string
      categoryKey: LauncherCategory
      logoPath: string
      entries: GameEntry[]
    }>()
    for (const entry of gridVisibleGames) {
      const category = gridCategoryByGameId[entry.id] ?? getGameCategory(entry)
      const existing = grouped.get(category.key)
      if (existing) {
        existing.entries.push(entry)
      } else {
        grouped.set(category.key, {
          label: category.label,
          categoryKey: category.key,
          logoPath: category.logoPath,
          entries: [entry],
        })
      }
    }

    const sections: CatalogSectionSnapshot[] = []
    let startIndex = 0
    for (const [key, section] of grouped.entries()) {
      sections.push({
        key,
        label: section.label,
        categoryKey: section.categoryKey,
        logoPath: section.logoPath,
        entryIds: section.entries.map((entry) => entry.id),
        startIndex,
      })
      startIndex += section.entries.length
    }

    return sections
  })()

  return {
    catalogEntryIds: catalogLibrary.map((entry) => entry.id),
    searchScoreByGameId,
    categoryByGameId,
    filteredEntryIds: filteredGames.map((entry) => entry.id),
    categories,
    visibleEntryIds: visibleGames.map((entry) => entry.id),
    canSortBySystem,
    scrollVisibleEntryIds: scrollVisibleGames.map((entry) => entry.id),
    gridVisibleEntryIds: gridVisibleGames.map((entry) => entry.id),
    gridCategoryByGameId,
    gridSections,
  }
}
