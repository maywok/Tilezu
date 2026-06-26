import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { SCREENSHOT_DATA_URL_CACHE_LIMIT } from '../constants'
import type { AppTab, GameEntry, LauncherView, RecentScreenshotsRequest } from '../types'
import { getRecentScreenshotPaths, readLocalImageAsDataUrl } from '../../../services/launcherService'

type UseGameScreenshotsParams = {
  activeTab: AppTab
  focusedGame: GameEntry | null
  isDeferredStartupReady: boolean
  launcherView: LauncherView
  onStepSound?: () => void
}

type ScreenshotStepDirection = -1 | 1

type UseGameScreenshotsResult = {
  focusedScreenshotIndex: number
  setFocusedScreenshotIndex: Dispatch<SetStateAction<number>>
  focusedScreenshotPath: string | undefined
  focusedScreenshotPaths: string[]
  displayedScreenshotUrl: string | undefined
  previousScreenshotUrl: string | undefined
  isScreenshotCrossfading: boolean
  isScreenshotExpanded: boolean
  isScreenshotClosing: boolean
  showScreenshotFolderFallback: boolean
  openScreenshotFullscreen: () => void
  closeScreenshotFullscreen: (immediate?: boolean) => void
  stepFocusedScreenshot: (direction: ScreenshotStepDirection) => void
  removeGameScreenshots: (gameId: string) => void
}

export const useGameScreenshots = ({
  activeTab,
  focusedGame,
  isDeferredStartupReady,
  launcherView,
  onStepSound,
}: UseGameScreenshotsParams): UseGameScreenshotsResult => {
  const [recentScreenshotPathsByGame, setRecentScreenshotPathsByGame] = useState<Record<string, string[]>>({})
  const [screenshotDataUrlByPath, setScreenshotDataUrlByPath] = useState<Record<string, string>>({})
  const [screenshotLookupBusyByGame, setScreenshotLookupBusyByGame] = useState<Record<string, boolean>>({})
  const [focusedScreenshotIndex, setFocusedScreenshotIndex] = useState(0)
  const [isScreenshotExpanded, setIsScreenshotExpanded] = useState(false)
  const [isScreenshotClosing, setIsScreenshotClosing] = useState(false)
  const [activeScreenshotUrl, setActiveScreenshotUrl] = useState<string | undefined>(undefined)
  const [previousScreenshotUrl, setPreviousScreenshotUrl] = useState<string | undefined>(undefined)
  const [isScreenshotCrossfading, setIsScreenshotCrossfading] = useState(false)

  const screenshotDataCacheOrderRef = useRef<string[]>([])
  const screenshotFadeTimerRef = useRef<number | null>(null)
  const screenshotFadeFrameRef = useRef<number | null>(null)
  const screenshotCloseTimerRef = useRef<number | null>(null)

  const focusedScreenshotPaths = useMemo(() => {
    return focusedGame ? recentScreenshotPathsByGame[focusedGame.id] ?? [] : []
  }, [focusedGame, recentScreenshotPathsByGame])

  const focusedScreenshotPath = useMemo(() => {
    if (focusedScreenshotPaths.length === 0) {
      return undefined
    }

    const normalizedIndex =
      ((focusedScreenshotIndex % focusedScreenshotPaths.length) + focusedScreenshotPaths.length) %
      focusedScreenshotPaths.length

    return focusedScreenshotPaths[normalizedIndex]
  }, [focusedScreenshotIndex, focusedScreenshotPaths])

  const focusedScreenshotUrl = focusedScreenshotPath ? screenshotDataUrlByPath[focusedScreenshotPath] : undefined
  const displayedScreenshotUrl = activeScreenshotUrl ?? focusedScreenshotUrl
  const showScreenshotFolderFallback = !focusedScreenshotPath && !screenshotLookupBusyByGame[focusedGame?.id ?? '']

  const cacheScreenshotDataUrl = useCallback((path: string, dataUrl: string) => {
    setScreenshotDataUrlByPath((previous) => {
      if (previous[path] === dataUrl) {
        const refreshedOrder = screenshotDataCacheOrderRef.current.filter((entryPath) => entryPath !== path)
        refreshedOrder.push(path)
        screenshotDataCacheOrderRef.current = refreshedOrder
        return previous
      }

      const next = {
        ...previous,
        [path]: dataUrl,
      }

      const nextOrder = screenshotDataCacheOrderRef.current.filter((entryPath) => entryPath !== path)
      nextOrder.push(path)

      while (nextOrder.length > SCREENSHOT_DATA_URL_CACHE_LIMIT) {
        const evicted = nextOrder.shift()
        if (evicted) {
          delete next[evicted]
        }
      }

      screenshotDataCacheOrderRef.current = nextOrder
      return next
    })
  }, [])

  const openScreenshotFullscreen = useCallback(() => {
    if (screenshotCloseTimerRef.current !== null) {
      window.clearTimeout(screenshotCloseTimerRef.current)
      screenshotCloseTimerRef.current = null
    }

    setIsScreenshotClosing(false)
    setIsScreenshotExpanded(true)
  }, [])

  const closeScreenshotFullscreen = useCallback(
    (immediate?: boolean) => {
      if (screenshotCloseTimerRef.current !== null) {
        window.clearTimeout(screenshotCloseTimerRef.current)
        screenshotCloseTimerRef.current = null
      }

      if (immediate) {
        setIsScreenshotClosing(false)
        setIsScreenshotExpanded(false)
        return
      }

      if (!isScreenshotExpanded || isScreenshotClosing) {
        return
      }

      setIsScreenshotClosing(true)
      screenshotCloseTimerRef.current = window.setTimeout(() => {
        setIsScreenshotExpanded(false)
        setIsScreenshotClosing(false)
        screenshotCloseTimerRef.current = null
      }, 230)
    },
    [isScreenshotExpanded, isScreenshotClosing],
  )

  const stepFocusedScreenshot = useCallback(
    (direction: ScreenshotStepDirection) => {
      if (focusedScreenshotPaths.length <= 1) {
        return
      }

      onStepSound?.()
      setFocusedScreenshotIndex((previous) => {
        const nextIndex = previous + direction
        const length = focusedScreenshotPaths.length
        return ((nextIndex % length) + length) % length
      })
    },
    [focusedScreenshotPaths.length, onStepSound],
  )

  const removeGameScreenshots = useCallback(
    (gameId: string) => {
      const removedScreenshotPaths = recentScreenshotPathsByGame[gameId] ?? []
      const removedScreenshotPathSet = removedScreenshotPaths.length > 0 ? new Set(removedScreenshotPaths) : null

      setRecentScreenshotPathsByGame((previous) => {
        if (!previous[gameId]) {
          return previous
        }

        const next = { ...previous }
        delete next[gameId]
        return next
      })

      setScreenshotLookupBusyByGame((previous) => {
        if (!Object.prototype.hasOwnProperty.call(previous, gameId)) {
          return previous
        }

        const next = { ...previous }
        delete next[gameId]
        return next
      })

      if (removedScreenshotPathSet) {
        setScreenshotDataUrlByPath((previous) => {
          let changed = false
          const next = { ...previous }

          for (const path of removedScreenshotPathSet) {
            if (!Object.prototype.hasOwnProperty.call(next, path)) {
              continue
            }

            delete next[path]
            changed = true
          }

          return changed ? next : previous
        })

        screenshotDataCacheOrderRef.current = screenshotDataCacheOrderRef.current.filter(
          (path) => !removedScreenshotPathSet.has(path),
        )
      }
    },
    [recentScreenshotPathsByGame],
  )

  useEffect(() => {
    setFocusedScreenshotIndex(0)
  }, [focusedGame?.id])

  useEffect(() => {
    if (!isDeferredStartupReady || !focusedGame) {
      return
    }

    if (Object.prototype.hasOwnProperty.call(recentScreenshotPathsByGame, focusedGame.id)) {
      return
    }

    setScreenshotLookupBusyByGame((previous) => ({
      ...previous,
      [focusedGame.id]: true,
    }))

    void getRecentScreenshotPaths({
      kind: focusedGame.kind,
      target: focusedGame.target,
      title: focusedGame.title,
      limit: 12,
    } satisfies RecentScreenshotsRequest)
      .then((paths) => {
        setRecentScreenshotPathsByGame((previous) => ({
          ...previous,
          [focusedGame.id]: paths,
        }))
      })
      .catch(() => {
        setRecentScreenshotPathsByGame((previous) => ({
          ...previous,
          [focusedGame.id]: [],
        }))
      })
      .finally(() => {
        setScreenshotLookupBusyByGame((previous) => ({
          ...previous,
          [focusedGame.id]: false,
        }))
      })
  }, [focusedGame, isDeferredStartupReady, recentScreenshotPathsByGame])

  useEffect(() => {
    if (!isDeferredStartupReady || !focusedScreenshotPath) {
      return
    }

    if (screenshotDataUrlByPath[focusedScreenshotPath]) {
      return
    }

    void readLocalImageAsDataUrl(focusedScreenshotPath)
      .then((dataUrl) => {
        cacheScreenshotDataUrl(focusedScreenshotPath, dataUrl)
      })
      .catch(() => {
        return
      })
  }, [focusedScreenshotPath, screenshotDataUrlByPath, cacheScreenshotDataUrl, isDeferredStartupReady])

  useEffect(() => {
    if (focusedScreenshotUrl === activeScreenshotUrl) {
      return
    }

    if (screenshotFadeTimerRef.current !== null) {
      window.clearTimeout(screenshotFadeTimerRef.current)
      screenshotFadeTimerRef.current = null
    }

    if (screenshotFadeFrameRef.current !== null) {
      window.cancelAnimationFrame(screenshotFadeFrameRef.current)
      screenshotFadeFrameRef.current = null
    }

    if (!activeScreenshotUrl || !focusedScreenshotUrl) {
      setActiveScreenshotUrl(focusedScreenshotUrl)
      setPreviousScreenshotUrl(undefined)
      setIsScreenshotCrossfading(false)
      return
    }

    setPreviousScreenshotUrl(activeScreenshotUrl)
    setActiveScreenshotUrl(focusedScreenshotUrl)

    screenshotFadeFrameRef.current = window.requestAnimationFrame(() => {
      setIsScreenshotCrossfading(true)
      screenshotFadeFrameRef.current = null
    })

    screenshotFadeTimerRef.current = window.setTimeout(() => {
      setPreviousScreenshotUrl(undefined)
      setIsScreenshotCrossfading(false)
      screenshotFadeTimerRef.current = null
    }, 520)
  }, [focusedScreenshotUrl, activeScreenshotUrl])

  useEffect(() => {
    if (launcherView !== 'games' || focusedScreenshotPaths.length <= 1 || isScreenshotExpanded) {
      return
    }

    const cycle = window.setInterval(() => {
      setFocusedScreenshotIndex((previous) => (previous + 1) % focusedScreenshotPaths.length)
    }, 3600)

    return () => {
      window.clearInterval(cycle)
    }
  }, [launcherView, focusedScreenshotPaths.length, isScreenshotExpanded])

  useEffect(() => {
    if (launcherView !== 'games') {
      closeScreenshotFullscreen(true)
    }
  }, [launcherView, closeScreenshotFullscreen])

  useEffect(() => {
    if (activeTab !== 'launcher' || launcherView !== 'games' || !isScreenshotExpanded) {
      document.body.classList.remove('screenshot-expanded')
      return
    }

    document.body.classList.add('screenshot-expanded')
    return () => {
      document.body.classList.remove('screenshot-expanded')
    }
  }, [activeTab, launcherView, isScreenshotExpanded])

  useEffect(() => {
    if (activeTab !== 'launcher' || launcherView !== 'games') {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement | null
      const isEditableTarget =
        targetElement?.tagName === 'INPUT' ||
        targetElement?.tagName === 'TEXTAREA' ||
        targetElement?.tagName === 'SELECT' ||
        targetElement?.isContentEditable

      if (isEditableTarget) {
        return
      }

      if (event.key === ';') {
        event.preventDefault()
        if (isScreenshotExpanded) {
          closeScreenshotFullscreen()
        } else {
          openScreenshotFullscreen()
        }
        return
      }

      if (event.key === 'Escape') {
        closeScreenshotFullscreen()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeTab, launcherView, closeScreenshotFullscreen, isScreenshotExpanded, openScreenshotFullscreen])

  useEffect(() => {
    return () => {
      if (screenshotFadeTimerRef.current !== null) {
        window.clearTimeout(screenshotFadeTimerRef.current)
      }

      if (screenshotFadeFrameRef.current !== null) {
        window.cancelAnimationFrame(screenshotFadeFrameRef.current)
      }

      if (screenshotCloseTimerRef.current !== null) {
        window.clearTimeout(screenshotCloseTimerRef.current)
      }

      screenshotDataCacheOrderRef.current = []
      document.body.classList.remove('screenshot-expanded')
    }
  }, [])

  return {
    focusedScreenshotIndex,
    setFocusedScreenshotIndex,
    focusedScreenshotPath,
    focusedScreenshotPaths,
    displayedScreenshotUrl,
    previousScreenshotUrl,
    isScreenshotCrossfading,
    isScreenshotExpanded,
    isScreenshotClosing,
    showScreenshotFolderFallback,
    openScreenshotFullscreen,
    closeScreenshotFullscreen,
    stepFocusedScreenshot,
    removeGameScreenshots,
  }
}
