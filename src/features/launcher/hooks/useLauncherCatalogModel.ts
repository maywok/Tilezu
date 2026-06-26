import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type {
  CategoryMeta,
  GameEntry,
  GameLibraryMeta,
  GamesViewMode,
  GridGroupMode,
  GridSortMode,
  LauncherCategory,
  LauncherView,
} from '../types'
import {
  computeCatalogModelSnapshot,
  type CatalogModelComputeInput,
  type CatalogModelSnapshot,
} from '../utils/catalogModelCompute'
import { markBootStage, timeBootSync } from '../../../utils/bootPerf'

const CATALOG_WORKER_MIN_LIBRARY_SIZE = 96
const HIDDEN_SYSTEM_CATEGORY_KEYS = new Set(['emulator', 'links'])

function resolveCatalogWorkerThreshold(): number {
  if (typeof navigator === 'undefined') {
    return CATALOG_WORKER_MIN_LIBRARY_SIZE
  }

  const extendedNavigator = navigator as Navigator & { deviceMemory?: number }
  const hardwareConcurrency = Math.max(1, Math.floor(extendedNavigator.hardwareConcurrency || 4))
  const deviceMemory = typeof extendedNavigator.deviceMemory === 'number' ? extendedNavigator.deviceMemory : 8

  let threshold = CATALOG_WORKER_MIN_LIBRARY_SIZE

  if (hardwareConcurrency <= 4) {
    threshold -= 32
  } else if (hardwareConcurrency >= 10) {
    threshold += 20
  }

  if (deviceMemory <= 4) {
    threshold -= 14
  } else if (deviceMemory >= 16) {
    threshold += 10
  }

  return Math.max(56, Math.min(180, threshold))
}

type CatalogWorkerRequestMessage = {
  requestId: number
  input: CatalogModelComputeInput
}

type CatalogWorkerResponseMessage = {
  requestId: number
  snapshot: CatalogModelSnapshot
}

function materializeEntries(entryIds: string[], entryById: Record<string, GameEntry>): GameEntry[] {
  const entries: GameEntry[] = []
  for (const id of entryIds) {
    const entry = entryById[id]
    if (entry) {
      entries.push(entry)
    }
  }

  return entries
}

type UseLauncherCatalogModelParams = {
  search: string
  library: GameEntry[]
  activeCategory: LauncherCategory
  launcherView: LauncherView
  gamesViewMode: GamesViewMode
  gridSortMode: GridSortMode
  gridGroupMode: GridGroupMode
  gameMetaById: Record<string, GameLibraryMeta>
  playtimeMinutesByGame: Record<string, number>
  customSystemCategories?: CategoryMeta[]
  customSystemAssignmentsBySystemKey?: Record<string, string[]>
  focusedGameId: string | null
  categoryScrollRef: MutableRefObject<HTMLDivElement | null>
  setActiveCategory: Dispatch<SetStateAction<LauncherCategory>>
  setFocusedGameId: Dispatch<SetStateAction<string | null>>
  setGridSortMode: Dispatch<SetStateAction<GridSortMode>>
}

export function useLauncherCatalogModel(params: UseLauncherCatalogModelParams) {
  const {
    search,
    library,
    activeCategory,
    launcherView,
    gamesViewMode,
    gridSortMode,
    gridGroupMode,
    gameMetaById,
    playtimeMinutesByGame,
    customSystemCategories = [],
    customSystemAssignmentsBySystemKey = {},
    focusedGameId,
    categoryScrollRef: _categoryScrollRef,
    setActiveCategory,
    setFocusedGameId,
    setGridSortMode,
  } = params

  const normalizedSearchQuery = useMemo(() => search.trim().toLowerCase(), [search])
  const deferredSearchQuery = useDeferredValue(normalizedSearchQuery)
  const catalogWorkerThreshold = useMemo(() => resolveCatalogWorkerThreshold(), [])

  const computeInput = useMemo<CatalogModelComputeInput>(() => {
    return {
      normalizedSearchQuery: deferredSearchQuery,
      library,
      activeCategory,
      gridSortMode,
      gridGroupMode,
      gameMetaById,
      playtimeMinutesByGame,
      customSystemCategories,
      customSystemAssignmentsBySystemKey,
    }
  }, [activeCategory, customSystemAssignmentsBySystemKey, customSystemCategories, deferredSearchQuery, gameMetaById, gridGroupMode, gridSortMode, library, playtimeMinutesByGame])

  const shouldUseWorker = typeof Worker !== 'undefined' && library.length >= catalogWorkerThreshold

  useEffect(() => {
    markBootStage('catalog-model:mode-selection', {
      shouldUseWorker,
      librarySize: library.length,
      threshold: catalogWorkerThreshold,
    })
  }, [catalogWorkerThreshold, library.length, shouldUseWorker])

  const workerRef = useRef<Worker | null>(null)
  const workerRequestIdRef = useRef(0)
  const fallbackSnapshotRef = useRef<CatalogModelSnapshot | null>(null)
  if (fallbackSnapshotRef.current === null) {
    fallbackSnapshotRef.current = timeBootSync(
      'catalog-model:initial-sync-compute',
      () => computeCatalogModelSnapshot(computeInput),
      { librarySize: computeInput.library.length, activeCategory: computeInput.activeCategory },
    )
  }
  const [workerSnapshot, setWorkerSnapshot] = useState<CatalogModelSnapshot | null>(null)

  useEffect(() => {
    if (!shouldUseWorker) {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }

      setWorkerSnapshot(null)
      return
    }

    if (workerRef.current) {
      return
    }

    const worker = new Worker(new URL('../workers/catalogModel.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<CatalogWorkerResponseMessage>) => {
      const { requestId, snapshot } = event.data
      if (requestId !== workerRequestIdRef.current) {
        return
      }

      fallbackSnapshotRef.current = snapshot
      startTransition(() => {
        setWorkerSnapshot(snapshot)
      })
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      if (workerRef.current === worker) {
        workerRef.current = null
      }
    }
  }, [shouldUseWorker])

  useEffect(() => {
    if (!shouldUseWorker) {
      return
    }

    const worker = workerRef.current
    if (!worker) {
      return
    }

    const requestId = workerRequestIdRef.current + 1
    workerRequestIdRef.current = requestId

    const message: CatalogWorkerRequestMessage = {
      requestId,
      input: computeInput,
    }

    worker.postMessage(message)
  }, [computeInput, shouldUseWorker])

  const syncSnapshot = useMemo(() => {
    if (shouldUseWorker) {
      return null
    }

    const snapshot = computeCatalogModelSnapshot(computeInput)
    fallbackSnapshotRef.current = snapshot
    return snapshot
  }, [computeInput, shouldUseWorker])

  const snapshot = shouldUseWorker
    ? workerSnapshot ?? fallbackSnapshotRef.current
    : syncSnapshot ?? fallbackSnapshotRef.current

  const entryById = useMemo(() => {
    const byId: Record<string, GameEntry> = {}
    for (const entry of library) {
      if (!byId[entry.id]) {
        byId[entry.id] = entry
      }
    }

    return byId
  }, [library])

  const searchScoreByGameId = snapshot.searchScoreByGameId

  const catalogLibrary = useMemo(() => {
    return materializeEntries(snapshot.catalogEntryIds, entryById)
  }, [entryById, snapshot.catalogEntryIds])

  const filteredGames = useMemo(() => {
    return materializeEntries(snapshot.filteredEntryIds, entryById)
  }, [entryById, snapshot.filteredEntryIds])

  const categories = useMemo(() => {
    return snapshot.categories.filter((category) => !HIDDEN_SYSTEM_CATEGORY_KEYS.has(category.key))
  }, [snapshot.categories])

  const systemCategories = useMemo(() => {
    return categories
  }, [categories])

  useEffect(() => {
    if (!categories.some((category) => category.key === activeCategory)) {
      if (systemCategories.length > 0) {
        startTransition(() => {
          setActiveCategory(systemCategories[0].key)
        })
      } else {
        startTransition(() => {
          setActiveCategory('all')
        })
      }
    }
  }, [activeCategory, categories, setActiveCategory, systemCategories])

  const visibleGames = useMemo(() => {
    return materializeEntries(snapshot.visibleEntryIds, entryById)
  }, [entryById, snapshot.visibleEntryIds])

  const canSortBySystem = snapshot.canSortBySystem

  const scrollVisibleGames = useMemo(() => {
    return materializeEntries(snapshot.scrollVisibleEntryIds, entryById)
  }, [entryById, snapshot.scrollVisibleEntryIds])

  const scrollVisibleGameIndexById = useMemo(() => {
    const indexById: Record<string, number> = {}
    for (let index = 0; index < scrollVisibleGames.length; index += 1) {
      indexById[scrollVisibleGames[index].id] = index
    }

    return indexById
  }, [scrollVisibleGames])

  const hasSearchQuery = normalizedSearchQuery.length > 0
  const searchResultCount = hasSearchQuery ? filteredGames.length : 0

  const favoritesScrollContextKeyRef = useRef<string>('')

  useEffect(() => {
    const contextKey = `${launcherView}|${gamesViewMode}|${gridSortMode}|${activeCategory}`

    if (launcherView !== 'games' || gamesViewMode === 'grid' || gridSortMode !== 'favorites') {
      favoritesScrollContextKeyRef.current = contextKey
      return
    }

    const firstEntry = scrollVisibleGames[0]
    if (!firstEntry) {
      favoritesScrollContextKeyRef.current = contextKey
      return
    }

    if (favoritesScrollContextKeyRef.current === contextKey) {
      return
    }

    favoritesScrollContextKeyRef.current = contextKey
    if (focusedGameId !== firstEntry.id) {
      startTransition(() => {
        setFocusedGameId(firstEntry.id)
      })
    }
  }, [launcherView, gamesViewMode, gridSortMode, activeCategory, scrollVisibleGames, focusedGameId, setFocusedGameId])

  const gridVisibleGames = useMemo(() => {
    return materializeEntries(snapshot.gridVisibleEntryIds, entryById)
  }, [entryById, snapshot.gridVisibleEntryIds])

  const gridCategoryByGameId = snapshot.gridCategoryByGameId

  useEffect(() => {
    if (!canSortBySystem && gridSortMode === 'category') {
      startTransition(() => {
        setGridSortMode('title-asc')
      })
    }
  }, [canSortBySystem, gridSortMode, setGridSortMode])

  const gridSections = useMemo(() => {
    const sections = snapshot.gridSections
      .map((section) => ({
        key: section.key,
        label: section.label,
        categoryKey: section.categoryKey,
        logoPath: section.logoPath,
        entries: materializeEntries(section.entryIds, entryById),
        startIndex: section.startIndex,
      }))
      .filter((section) => section.entries.length > 0)

    if (sections.length === 0 && gridVisibleGames.length > 0) {
      return [
        {
          key: 'all-games',
          label: '',
          categoryKey: undefined,
          logoPath: undefined,
          entries: gridVisibleGames,
          startIndex: 0,
        },
      ]
    }

    return sections
  }, [entryById, gridVisibleGames, snapshot.gridSections])

  const activeCategoryIndex = useMemo(() => {
    const index = systemCategories.findIndex((category) => category.key === activeCategory)
    return index >= 0 ? index : 0
  }, [systemCategories, activeCategory])

  const selectCategoryByIndex = (index: number): boolean => {
    const normalized = Math.max(0, Math.min(index, systemCategories.length - 1))
    const targetCategory = systemCategories[normalized]
    if (!targetCategory) {
      return false
    }

    if (targetCategory.key === activeCategory) {
      return false
    }

    setActiveCategory(targetCategory.key)
    return true
  }

  const moveCategory = (direction: -1 | 1): boolean => {
    return selectCategoryByIndex(activeCategoryIndex + direction)
  }

  return {
    normalizedSearchQuery,
    searchScoreByGameId,
    filteredGames,
    categories,
    systemCategories,
    visibleGames,
    canSortBySystem,
    scrollVisibleGames,
    scrollVisibleGameIndexById,
    hasSearchQuery,
    searchResultCount,
    gridVisibleGames,
    gridCategoryByGameId,
    gridSections,
    activeCategoryIndex,
    moveCategory,
    catalogLibrary,
    catalogDiagnostics: {
      workerActive: shouldUseWorker,
      workerThreshold: catalogWorkerThreshold,
      libraryCount: library.length,
      catalogCount: catalogLibrary.length,
      visibleCount: visibleGames.length,
      filteredCount: filteredGames.length,
      searchLength: normalizedSearchQuery.length,
    },
  }
}
