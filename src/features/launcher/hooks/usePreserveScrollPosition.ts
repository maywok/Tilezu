import { useCallback, useEffect, useMemo } from 'react'

import type { GameEntry, GameLibraryMeta } from '../types'
import { getJumpLetter } from '../utils/search'

type UsePreserveScrollPositionParams = {
  scrollVisibleGames: GameEntry[]
  scrollVisibleGameIndexById: Record<string, number>
  focusedGameId: string | null
  setFocusedGameId: (value: string | null) => void
  focusedGameIdRef: React.MutableRefObject<string | null>
  gameMetaById: Record<string, GameLibraryMeta>
  playUiSound: (ref: React.RefObject<HTMLAudioElement | null>) => void
  iconScrollAudioRef: React.RefObject<HTMLAudioElement | null>
}

export function usePreserveScrollPosition({
  scrollVisibleGames,
  scrollVisibleGameIndexById,
  focusedGameId,
  setFocusedGameId,
  focusedGameIdRef,
  gameMetaById,
  playUiSound,
  iconScrollAudioRef,
}: UsePreserveScrollPositionParams) {
  useEffect(() => {
    if (scrollVisibleGames.length === 0) {
      setFocusedGameId(null)
      return
    }

    if (focusedGameId && scrollVisibleGames.some((entry) => entry.id === focusedGameId)) {
      return
    }

    setFocusedGameId(scrollVisibleGames[0].id)
  }, [scrollVisibleGames, focusedGameId, setFocusedGameId])

  const focusedGameIndex = useMemo(() => {
    if (scrollVisibleGames.length === 0) {
      return -1
    }

    if (!focusedGameId) {
      return 0
    }

    return scrollVisibleGameIndexById[focusedGameId] ?? 0
  }, [focusedGameId, scrollVisibleGameIndexById, scrollVisibleGames.length])

  const focusedGame = useMemo(() => {
    if (focusedGameIndex < 0 || focusedGameIndex >= scrollVisibleGames.length) {
      return scrollVisibleGames[0] ?? null
    }

    return scrollVisibleGames[focusedGameIndex] ?? null
  }, [focusedGameIndex, scrollVisibleGames])

  const stackEntries = useMemo(() => {
    if (scrollVisibleGames.length === 0 || focusedGameIndex < 0) {
      return [] as Array<{ entry: GameEntry | null; offset: number }>
    }

    const offsets = [-2, -1, 0, 1, 2]

    return offsets.map((offset) => {
      const index = focusedGameIndex + offset
      const entry = index >= 0 && index < scrollVisibleGames.length ? scrollVisibleGames[index] : null
      return {
        entry,
        offset,
      }
    })
  }, [focusedGameIndex, scrollVisibleGames])

  const stackScrollProgress = useMemo(() => {
    if (scrollVisibleGames.length <= 1 || focusedGameIndex < 0) {
      return 0
    }

    return focusedGameIndex / (scrollVisibleGames.length - 1)
  }, [focusedGameIndex, scrollVisibleGames])

  const hasVisibleFavoriteGame = useMemo(() => {
    return scrollVisibleGames.some((entry) => Boolean(gameMetaById[entry.id]?.isFavorite))
  }, [gameMetaById, scrollVisibleGames])

  const firstFavoriteGameIndex = useMemo(() => {
    for (let index = 0; index < scrollVisibleGames.length; index += 1) {
      const entry = scrollVisibleGames[index]
      if (gameMetaById[entry.id]?.isFavorite) {
        return index
      }
    }

    return -1
  }, [gameMetaById, scrollVisibleGames])

  const firstGameIndexByLetter = useMemo(() => {
    const indexByLetter: Record<string, number> = {}

    for (let index = 0; index < scrollVisibleGames.length; index += 1) {
      const entry = scrollVisibleGames[index]
      const letter = getJumpLetter(entry.title)
      if (Object.prototype.hasOwnProperty.call(indexByLetter, letter)) {
        continue
      }

      indexByLetter[letter] = index
    }

    return indexByLetter
  }, [scrollVisibleGames])

  const letterJumpTargets = useMemo(() => {
    if (scrollVisibleGames.length < 14) {
      return [] as Array<{ letter: string; index: number; gameId: string }>
    }

    const targets: Array<{ letter: string; index: number; gameId: string }> = []
    const seenLetters = new Set<string>()
    for (let index = 0; index < scrollVisibleGames.length; index += 1) {
      const entry = scrollVisibleGames[index]
      const letter = getJumpLetter(entry.title)
      if (seenLetters.has(letter)) {
        continue
      }

      seenLetters.add(letter)
      targets.push({ letter, index, gameId: entry.id })
      if (targets.length >= 10) {
        break
      }
    }

    return targets
  }, [scrollVisibleGames])

  const stackMiniMapTargets = useMemo(() => {
    return letterJumpTargets.slice(0, 8)
  }, [letterJumpTargets])

  const focusGameById = useCallback(
    (gameId: string, options?: { playSound?: boolean }) => {
      if (!gameId) {
        return false
      }

      const targetIndex = scrollVisibleGameIndexById[gameId]
      if (targetIndex === undefined) {
        return false
      }

      if (focusedGameIdRef.current === gameId) {
        return false
      }

      if (options?.playSound ?? true) {
        playUiSound(iconScrollAudioRef)
      }

      focusedGameIdRef.current = gameId
      setFocusedGameId(gameId)
      return true
    },
    [focusedGameIdRef, iconScrollAudioRef, playUiSound, scrollVisibleGameIndexById, setFocusedGameId],
  )

  const focusGameByIndex = useCallback(
    (index: number, options?: { playSound?: boolean }) => {
      if (scrollVisibleGames.length === 0) {
        return false
      }

      const boundedIndex = Math.max(0, Math.min(index, scrollVisibleGames.length - 1))
      const nextEntry = scrollVisibleGames[boundedIndex]
      if (!nextEntry) {
        return false
      }

      return focusGameById(nextEntry.id, options)
    },
    [focusGameById, scrollVisibleGames],
  )

  const stepFocusedGame = useCallback(
    (direction: -1 | 1, options?: { playSound?: boolean }) => {
      if (scrollVisibleGames.length === 0) {
        return false
      }

      const currentId = focusedGameIdRef.current
      const currentIndex = currentId ? (scrollVisibleGameIndexById[currentId] ?? -1) : -1
      const baseIndex = currentIndex >= 0 ? currentIndex : 0
      const nextIndex = Math.max(0, Math.min(baseIndex + direction, scrollVisibleGames.length - 1))
      if (nextIndex === baseIndex) {
        return false
      }

      return focusGameByIndex(nextIndex, options)
    },
    [focusGameByIndex, focusedGameIdRef, scrollVisibleGameIndexById, scrollVisibleGames.length],
  )

  const jumpToTopGame = useCallback(() => {
    focusGameByIndex(0)
  }, [focusGameByIndex])

  const jumpToBottomGame = useCallback(() => {
    focusGameByIndex(scrollVisibleGames.length - 1)
  }, [focusGameByIndex, scrollVisibleGames.length])

  const jumpToFavoriteGame = useCallback(() => {
    if (firstFavoriteGameIndex >= 0) {
      focusGameByIndex(firstFavoriteGameIndex)
    }
  }, [firstFavoriteGameIndex, focusGameByIndex])

  const jumpToLetter = useCallback(
    (letter: string) => {
      const targetIndex = firstGameIndexByLetter[letter]
      if (targetIndex === undefined) {
        return
      }

      focusGameByIndex(targetIndex)
    },
    [firstGameIndexByLetter, focusGameByIndex],
  )

  const jumpToStackProgress = useCallback(
    (progress: number) => {
      if (scrollVisibleGames.length <= 1) {
        return
      }

      const normalized = Number.isFinite(progress) ? progress : 0
      const bounded = Math.max(0, Math.min(1, normalized))
      const targetIndex = Math.round((scrollVisibleGames.length - 1) * bounded)
      focusGameByIndex(targetIndex)
    },
    [focusGameByIndex, scrollVisibleGames.length],
  )

  return {
    focusedGameIndex,
    focusedGame,
    stackEntries,
    stackScrollProgress,
    hasVisibleFavoriteGame,
    letterJumpTargets,
    stackMiniMapTargets,
    focusGameById,
    focusGameByIndex,
    stepFocusedGame,
    jumpToTopGame,
    jumpToBottomGame,
    jumpToFavoriteGame,
    jumpToLetter,
    jumpToStackProgress,
  }
}
