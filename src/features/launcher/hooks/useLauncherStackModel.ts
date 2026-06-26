import { useCallback, useEffect, useMemo } from 'react'
import {
  STACK_WHEEL_ACCUMULATOR_CAP,
  STACK_WHEEL_GLIDE_STEP_MS,
  STACK_WHEEL_INPUT_CLAMP,
  STACK_WHEEL_MOMENTUM_SETTLE_MS,
  STACK_WHEEL_STEP_DELTA,
} from '../constants'
import type {
  GameEntry,
  GameLibraryMeta,
  GamesViewMode,
  LauncherView,
  SceneRouteTransition,
} from '../types'
import { getJumpLetter } from '../utils/search'
import { usePreserveScrollPosition } from './usePreserveScrollPosition'

type GameClickEffect = {
  id: string
  gameId: string
  x: number
  y: number
  droplets: Array<{ x: number; y: number; scale: number; delay: number }>
}

const SYSTEM_STACK_CENTER_BIAS_PX = 8
const SYSTEM_STACK_CENTER_LOCK_MIN_RATIO = 0.46
const SYSTEM_STACK_CENTER_LOCK_MAX_RATIO = 0.62

type UseLauncherStackModelParams = {
  activeSystemKey: string
  scrollVisibleGames: GameEntry[]
  scrollVisibleGameIndexById: Record<string, number>
  focusedGameId: string | null
  setFocusedGameId: (value: string | null) => void
  focusedGameIdRef: React.MutableRefObject<string | null>
  gameMetaById: Record<string, GameLibraryMeta>
  playUiSound: (ref: React.RefObject<HTMLAudioElement | null>) => void
  iconScrollAudioRef: React.RefObject<HTMLAudioElement | null>
  applyGlassScrollWeight: (direction: -1 | 1, wheelDelta: number) => void
  gameStackListRef: React.RefObject<HTMLDivElement | null>
  categoryScrollRef: React.RefObject<HTMLDivElement | null>
  launcherView: LauncherView
  gamesViewMode: GamesViewMode
  isGamesViewSwitching: boolean
  sceneRouteTransition: SceneRouteTransition
  systemCategoriesCount: number
  gameClickEffects: GameClickEffect[]
  gameStackMomentumRef: React.MutableRefObject<number>
  gameStackWheelAccumulatorRef: React.MutableRefObject<number>
  gameStackScrollDirectionRef: React.MutableRefObject<-1 | 1>
  gameStackLastStepAtRef: React.MutableRefObject<number>
  gameStackMomentumFrameRef: React.MutableRefObject<number | null>
  gameStackMomentumSettleTimerRef: React.MutableRefObject<number | null>
  lastWheelGameStepSoundAtRef: React.MutableRefObject<number>
  isGameStackMomentumActive: boolean
  setIsGameStackMomentumActive: (value: boolean) => void
}

export function useLauncherStackModel({
  activeSystemKey,
  scrollVisibleGames,
  scrollVisibleGameIndexById,
  focusedGameId,
  setFocusedGameId,
  focusedGameIdRef,
  gameMetaById,
  playUiSound,
  iconScrollAudioRef,
  applyGlassScrollWeight,
  gameStackListRef,
  categoryScrollRef,
  launcherView,
  gamesViewMode,
  isGamesViewSwitching,
  sceneRouteTransition,
  systemCategoriesCount,
  gameClickEffects,
  gameStackMomentumRef,
  gameStackWheelAccumulatorRef,
  gameStackScrollDirectionRef,
  gameStackLastStepAtRef,
  gameStackMomentumFrameRef,
  gameStackMomentumSettleTimerRef,
  lastWheelGameStepSoundAtRef,
  isGameStackMomentumActive,
  setIsGameStackMomentumActive,
}: UseLauncherStackModelParams) {
  const {
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
  } = usePreserveScrollPosition({
    scrollVisibleGames,
    scrollVisibleGameIndexById,
    focusedGameId,
    setFocusedGameId,
    focusedGameIdRef,
    gameMetaById,
    playUiSound,
    iconScrollAudioRef,
  })

  const firstFavoriteGameIndex = useMemo(() => {
    for (let index = 0; index < scrollVisibleGames.length; index += 1) {
      const entry = scrollVisibleGames[index]
      if (gameMetaById[entry.id]?.isFavorite) {
        return index
      }
    }

    return -1
  }, [scrollVisibleGames, gameMetaById])

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

  const settleGameStackMomentumVisuals = useCallback(() => {
    if (gameStackMomentumSettleTimerRef.current !== null) {
      window.clearTimeout(gameStackMomentumSettleTimerRef.current)
    }

    gameStackMomentumSettleTimerRef.current = window.setTimeout(() => {
      gameStackMomentumSettleTimerRef.current = null
      gameStackMomentumRef.current = 0
      if (gameStackListRef.current) {
        gameStackListRef.current.style.setProperty('--stack-scroll-strength', '0')
        gameStackListRef.current.style.setProperty('--stack-scroll-direction', '0')
      }

      setIsGameStackMomentumActive(false)
    }, STACK_WHEEL_MOMENTUM_SETTLE_MS)
  }, [gameStackListRef, gameStackMomentumRef, gameStackMomentumSettleTimerRef, setIsGameStackMomentumActive])

  const flushGameStackMomentumSteps = useCallback(
    (frameTime: number) => {
      gameStackMomentumFrameRef.current = null

      if (scrollVisibleGames.length <= 1) {
        gameStackWheelAccumulatorRef.current = 0
        settleGameStackMomentumVisuals()
        return
      }

      const elapsed = frameTime - gameStackLastStepAtRef.current
      let accumulator = gameStackWheelAccumulatorRef.current

      if (Math.abs(accumulator) >= STACK_WHEEL_STEP_DELTA && elapsed >= STACK_WHEEL_GLIDE_STEP_MS) {
        const direction: -1 | 1 = accumulator > 0 ? 1 : -1
        gameStackScrollDirectionRef.current = direction

        const moved = stepFocusedGame(direction, { playSound: false })
        if (moved) {
          gameStackLastStepAtRef.current = frameTime
          accumulator -= direction * STACK_WHEEL_STEP_DELTA
          accumulator *= 0.66

          if (frameTime - lastWheelGameStepSoundAtRef.current >= 72) {
            playUiSound(iconScrollAudioRef)
            lastWheelGameStepSoundAtRef.current = frameTime
          }
        } else {
          accumulator = 0
        }
      } else {
        accumulator *= 0.9
      }

      if (Math.abs(accumulator) < 0.75) {
        accumulator = 0
      }

      gameStackWheelAccumulatorRef.current = accumulator

      if (accumulator !== 0) {
        const direction: -1 | 1 = accumulator > 0 ? 1 : -1
        gameStackScrollDirectionRef.current = direction

        const momentumStrength = Math.min(1, 0.22 + Math.abs(accumulator) / (STACK_WHEEL_STEP_DELTA * 2.8))
        gameStackMomentumRef.current = Math.max(momentumStrength, gameStackMomentumRef.current * 0.8)

        if (gameStackListRef.current) {
          gameStackListRef.current.style.setProperty('--stack-scroll-strength', gameStackMomentumRef.current.toFixed(3))
          gameStackListRef.current.style.setProperty('--stack-scroll-direction', direction.toString())
        }

        gameStackMomentumFrameRef.current = window.requestAnimationFrame(flushGameStackMomentumSteps)
        return
      }

      settleGameStackMomentumVisuals()
    },
    [
      gameStackLastStepAtRef,
      gameStackListRef,
      gameStackMomentumFrameRef,
      gameStackMomentumRef,
      gameStackScrollDirectionRef,
      gameStackWheelAccumulatorRef,
      iconScrollAudioRef,
      lastWheelGameStepSoundAtRef,
      playUiSound,
      scrollVisibleGames.length,
      settleGameStackMomentumVisuals,
      stepFocusedGame,
    ],
  )

  const stopGameStackMomentum = useCallback(() => {
    if (gameStackMomentumFrameRef.current !== null) {
      window.cancelAnimationFrame(gameStackMomentumFrameRef.current)
      gameStackMomentumFrameRef.current = null
    }

    if (gameStackMomentumSettleTimerRef.current !== null) {
      window.clearTimeout(gameStackMomentumSettleTimerRef.current)
      gameStackMomentumSettleTimerRef.current = null
    }

    gameStackMomentumRef.current = 0
    gameStackWheelAccumulatorRef.current = 0
    gameStackScrollDirectionRef.current = 1
    gameStackLastStepAtRef.current = 0
    if (gameStackListRef.current) {
      gameStackListRef.current.style.setProperty('--stack-scroll-strength', '0')
      gameStackListRef.current.style.setProperty('--stack-scroll-direction', '0')
    }

    setIsGameStackMomentumActive(false)
  }, [
    gameStackLastStepAtRef,
    gameStackListRef,
    gameStackMomentumFrameRef,
    gameStackMomentumRef,
    gameStackMomentumSettleTimerRef,
    gameStackScrollDirectionRef,
    gameStackWheelAccumulatorRef,
    setIsGameStackMomentumActive,
  ])

  const pushGameStackMomentum = useCallback(
    (deltaY: number) => {
      if (scrollVisibleGames.length <= 1) {
        return
      }

      if (deltaY === 0) {
        return
      }

      const direction: -1 | 1 = deltaY > 0 ? 1 : -1
      gameStackScrollDirectionRef.current = direction
      const wheelDelta = Math.abs(deltaY)
      applyGlassScrollWeight(direction, wheelDelta)

      const impulseStrength = Math.max(0.16, Math.min(0.86, wheelDelta / 180))
      gameStackMomentumRef.current = Math.max(impulseStrength, gameStackMomentumRef.current * 0.84)
      if (gameStackListRef.current) {
        gameStackListRef.current.style.setProperty('--stack-scroll-strength', gameStackMomentumRef.current.toFixed(3))
        gameStackListRef.current.style.setProperty('--stack-scroll-direction', direction.toString())
      }

      setIsGameStackMomentumActive(true)

      if (gameStackMomentumSettleTimerRef.current !== null) {
        window.clearTimeout(gameStackMomentumSettleTimerRef.current)
        gameStackMomentumSettleTimerRef.current = null
      }

      const clampedInput = Math.max(-STACK_WHEEL_INPUT_CLAMP, Math.min(STACK_WHEEL_INPUT_CLAMP, deltaY))
      const previousAccumulator = gameStackWheelAccumulatorRef.current
      if (previousAccumulator !== 0 && Math.sign(previousAccumulator) !== Math.sign(clampedInput)) {
        gameStackWheelAccumulatorRef.current = previousAccumulator * 0.34
      }
      gameStackWheelAccumulatorRef.current += clampedInput
      gameStackWheelAccumulatorRef.current = Math.max(
        -STACK_WHEEL_ACCUMULATOR_CAP,
        Math.min(STACK_WHEEL_ACCUMULATOR_CAP, gameStackWheelAccumulatorRef.current),
      )

      if (gameStackMomentumFrameRef.current === null) {
        gameStackMomentumFrameRef.current = window.requestAnimationFrame(flushGameStackMomentumSteps)
      }
    },
    [
      applyGlassScrollWeight,
      flushGameStackMomentumSteps,
      gameStackListRef,
      gameStackMomentumFrameRef,
      gameStackMomentumRef,
      gameStackMomentumSettleTimerRef,
      gameStackScrollDirectionRef,
      gameStackWheelAccumulatorRef,
      scrollVisibleGames.length,
      setIsGameStackMomentumActive,
    ],
  )

  useEffect(() => {
    if (launcherView !== 'games' || gamesViewMode === 'grid') {
      stopGameStackMomentum()
    }
  }, [gamesViewMode, launcherView, stopGameStackMomentum])

  const parsePixelVariable = useCallback((value: string) => {
    const parsed = Number.parseFloat(value.replace('px', ''))
    return Number.isFinite(parsed) ? parsed : 0
  }, [])

  const clampAutoCenterOffset = useCallback((offset: number, listRect: DOMRect) => {
    const dynamicLimit = Math.max(420, Math.min(920, listRect.height * 0.74))
    return Math.max(-dynamicLimit, Math.min(dynamicLimit, offset))
  }, [])

  const setPixelVariableIfChanged = useCallback(
    (
      element: HTMLElement,
      variableName: '--stack-center-auto' | '--mini-system-anchor-delta',
      nextValue: number,
      epsilon = 0.55,
    ) => {
      const currentRaw = element.style.getPropertyValue(variableName).trim()
      const currentValue = parsePixelVariable(currentRaw)
      if (Math.abs(nextValue - currentValue) < epsilon) {
        return
      }

      element.style.setProperty(variableName, `${nextValue.toFixed(2)}px`)
    },
    [parsePixelVariable],
  )

  const syncSystemStackCenter = useCallback(() => {
    const stackList = categoryScrollRef.current
    if (!stackList) {
      return
    }

    const applyAutoCenter = (nextOffset: number) => {
      setPixelVariableIfChanged(stackList, '--stack-center-auto', nextOffset)
    }

    if (launcherView !== 'systems') {
      applyAutoCenter(0)
      return
    }

    if (sceneRouteTransition) {
      return
    }

    const activeCard =
      stackList.querySelector<HTMLButtonElement>('.stack-item.system-item.active') ??
      stackList.querySelector<HTMLButtonElement>('.stack-item.active')
    if (!activeCard) {
      applyAutoCenter(0)
      return
    }

    const listRect = stackList.getBoundingClientRect()
    const systemStack = stackList.closest('.system-stack') as HTMLElement | null
    const systemsMain = stackList.closest('.systems-main') as HTMLElement | null
    const sceneRoot = stackList.closest('.wii-scene') as HTMLElement | null
    const systemsMainStyles = systemsMain ? window.getComputedStyle(systemsMain) : null
    const stackRect = systemStack?.getBoundingClientRect()
    const systemsRect = systemsMain?.getBoundingClientRect()
    const sceneRect = sceneRoot?.getBoundingClientRect()
    const systemsCenterNudge = systemsMainStyles
      ? parsePixelVariable(systemsMainStyles.getPropertyValue('--systems-center-nudge'))
      : 0
    const lockMinRatioRaw = systemsMainStyles
      ? Number.parseFloat(systemsMainStyles.getPropertyValue('--systems-center-lock-min'))
      : Number.NaN
    const lockMaxRatioRaw = systemsMainStyles
      ? Number.parseFloat(systemsMainStyles.getPropertyValue('--systems-center-lock-max'))
      : Number.NaN
    const lockMinRatio = Number.isFinite(lockMinRatioRaw) ? lockMinRatioRaw : SYSTEM_STACK_CENTER_LOCK_MIN_RATIO
    const lockMaxRatio = Number.isFinite(lockMaxRatioRaw) ? lockMaxRatioRaw : SYSTEM_STACK_CENTER_LOCK_MAX_RATIO
    const boundedLockMinRatio = Math.max(0.3, Math.min(0.7, lockMinRatio))
    const boundedLockMaxRatio = Math.max(boundedLockMinRatio + 0.06, Math.min(0.86, lockMaxRatio))
    const targetCenterY = systemsRect
      ? systemsRect.top + systemsRect.height / 2
      : stackRect
      ? stackRect.top + stackRect.height / 2
      : sceneRect
        ? sceneRect.top + sceneRect.height / 2
        : listRect.top + listRect.height / 2
    const targetCenterYBiasedRaw = targetCenterY + SYSTEM_STACK_CENTER_BIAS_PX + systemsCenterNudge
    const targetCenterYBiased = sceneRect
      ? Math.max(
          sceneRect.top + sceneRect.height * boundedLockMinRatio,
          Math.min(sceneRect.top + sceneRect.height * boundedLockMaxRatio, targetCenterYBiasedRaw),
        )
      : targetCenterYBiasedRaw
    const activeCardStyles = window.getComputedStyle(activeCard)
    const stackCenterShift = parsePixelVariable(activeCardStyles.getPropertyValue('--stack-center-shift'))
    const slotY = parsePixelVariable(activeCardStyles.getPropertyValue('--slot-y'))
    const activeLiftY = parsePixelVariable(activeCardStyles.getPropertyValue('--active-lift-y'))
    const listCenterY = listRect.top + listRect.height / 2
    const baselineCenterY = listCenterY + stackCenterShift + slotY + activeLiftY
    const centeredOffset = clampAutoCenterOffset(targetCenterYBiased - baselineCenterY, listRect)
    applyAutoCenter(centeredOffset)
  }, [
    categoryScrollRef,
    clampAutoCenterOffset,
    launcherView,
    parsePixelVariable,
    sceneRouteTransition,
    setPixelVariableIfChanged,
  ])

  useEffect(() => {
    const stackList = categoryScrollRef.current
    if (!stackList) {
      return
    }

    const resetAutoCenter = () => {
      stackList.style.setProperty('--stack-center-auto', '0px')
    }

    if (launcherView !== 'systems') {
      resetAutoCenter()
      return
    }

    if (sceneRouteTransition) {
      return
    }

    let rafPrimary = 0
    let settleTimer: number | null = null
    let resizeObserver: ResizeObserver | null = null

    const systemStack = stackList.closest('.system-stack') as HTMLElement | null
    const systemsMain = stackList.closest('.systems-main') as HTMLElement | null
    const sceneRoot = stackList.closest('.wii-scene') as HTMLElement | null

    rafPrimary = window.requestAnimationFrame(() => {
      syncSystemStackCenter()
    })
    settleTimer = window.setTimeout(() => {
      syncSystemStackCenter()
    }, 220)

    const handleResize = () => {
      syncSystemStackCenter()
    }

    window.addEventListener('resize', handleResize)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncSystemStackCenter()
      })

      if (systemsMain) {
        resizeObserver.observe(systemsMain)
      }
      if (systemStack) {
        resizeObserver.observe(systemStack)
      }
      if (sceneRoot) {
        resizeObserver.observe(sceneRoot)
      }
    }

    return () => {
      if (rafPrimary) {
        window.cancelAnimationFrame(rafPrimary)
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer)
      }
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [activeSystemKey, categoryScrollRef, launcherView, sceneRouteTransition, systemCategoriesCount, syncSystemStackCenter])

  const syncGameStackCenter = useCallback(() => {
    const stackList = gameStackListRef.current
    if (!stackList) {
      return
    }

    const gamesMain = stackList.closest('.games-main') as HTMLElement | null
    const gameStack = stackList.closest('.game-stack') as HTMLElement | null
    const isViewSwitching = isGamesViewSwitching || gamesMain?.classList.contains('is-view-switching') === true
    const applyAutoCenter = (nextOffset: number) => {
      setPixelVariableIfChanged(stackList, '--stack-center-auto', nextOffset)
      if (gamesMain) {
        setPixelVariableIfChanged(gamesMain, '--stack-center-auto', nextOffset)
      }
    }
    const applyMiniAnchorDelta = (nextDelta: number) => {
      if (gamesMain) {
        setPixelVariableIfChanged(gamesMain, '--mini-system-anchor-delta', nextDelta, 0.45)
      }
    }

    const syncMiniAnchorDelta = () => {
      if (!gamesMain || !gameStack) {
        applyMiniAnchorDelta(0)
        return
      }

      const listRect = stackList.getBoundingClientRect()
      const gameStackRect = gameStack.getBoundingClientRect()
      if (listRect.height < 2 || gameStackRect.height < 2) {
        applyMiniAnchorDelta(0)
        return
      }
      const listCenterY = listRect.top + listRect.height / 2
      const stackCenterY = gameStackRect.top + gameStackRect.height / 2
      const deltaY = listCenterY - stackCenterY
      applyMiniAnchorDelta(deltaY)
    }

    if (launcherView !== 'games' || gamesViewMode === 'grid') {
      applyAutoCenter(0)
      applyMiniAnchorDelta(0)
      return
    }

    if (sceneRouteTransition === 'to-systems') {
      return
    }

    if (isViewSwitching) {
      return
    }

    syncMiniAnchorDelta()

    const activeCard = stackList.querySelector<HTMLButtonElement>('.stack-item.active')
    if (!activeCard) {
      applyAutoCenter(0)
      return
    }

    const listRect = stackList.getBoundingClientRect()
    if (listRect.height < 2) {
      applyAutoCenter(0)
      return
    }
    const gamesMainRect = gamesMain?.getBoundingClientRect()
    const sceneRoot = stackList.closest('.wii-scene') as HTMLElement | null
    const sceneRect = sceneRoot?.getBoundingClientRect()
    const visibleCenterY = gamesMainRect && gamesMainRect.height > 2
      ? gamesMainRect.top + gamesMainRect.height / 2
      : sceneRect
        ? sceneRect.top + sceneRect.height / 2
        : listRect.top + listRect.height / 2
    const activeCardStyles = window.getComputedStyle(activeCard)
    const stackCenterShift = parsePixelVariable(activeCardStyles.getPropertyValue('--stack-center-shift'))
    const slotY = parsePixelVariable(activeCardStyles.getPropertyValue('--slot-y'))
    const activeLiftY = parsePixelVariable(activeCardStyles.getPropertyValue('--active-lift-y'))
    const listCenterY = listRect.top + listRect.height / 2
    const baselineCenterY = listCenterY + stackCenterShift + slotY + activeLiftY
    const centeredOffset = clampAutoCenterOffset(visibleCenterY - baselineCenterY, listRect)
    applyAutoCenter(centeredOffset)
  }, [
    clampAutoCenterOffset,
    gameStackListRef,
    gamesViewMode,
    isGamesViewSwitching,
    launcherView,
    parsePixelVariable,
    sceneRouteTransition,
    setPixelVariableIfChanged,
  ])

  useEffect(() => {
    const stackList = gameStackListRef.current
    if (!stackList) {
      return
    }

    const gamesMain = stackList.closest('.games-main') as HTMLElement | null
    const gameStack = stackList.closest('.game-stack') as HTMLElement | null
    const sceneRoot = stackList.closest('.wii-scene') as HTMLElement | null
    const resetAutoCenter = () => {
      stackList.style.setProperty('--stack-center-auto', '0px')
      if (gamesMain) {
        gamesMain.style.setProperty('--stack-center-auto', '0px')
        gamesMain.style.setProperty('--mini-system-anchor-delta', '0px')
      }
    }

    if (launcherView !== 'games' || gamesViewMode === 'grid') {
      resetAutoCenter()
      return
    }

    if (sceneRouteTransition === 'to-systems') {
      return
    }

    let rafPrimary = 0
    let settleTimer: number | null = null
    let settleTimerLate: number | null = null
    let settleTimerFinal: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let classObserver: MutationObserver | null = null

    const syncWhenViewStable = () => {
      if (isGamesViewSwitching || gamesMain?.classList.contains('is-view-switching')) {
        return
      }

      syncGameStackCenter()
    }

    rafPrimary = window.requestAnimationFrame(() => {
      syncWhenViewStable()
    })
    settleTimer = window.setTimeout(() => {
      syncWhenViewStable()
    }, 220)
    settleTimerLate = window.setTimeout(() => {
      syncWhenViewStable()
    }, 520)
    settleTimerFinal = window.setTimeout(() => {
      syncWhenViewStable()
    }, 760)

    const handleResize = () => {
      syncWhenViewStable()
    }

    window.addEventListener('resize', handleResize)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncWhenViewStable()
      })

      if (gamesMain) {
        resizeObserver.observe(gamesMain)
      }
      if (gameStack) {
        resizeObserver.observe(gameStack)
      }
      resizeObserver.observe(stackList)
      if (sceneRoot) {
        resizeObserver.observe(sceneRoot)
      }
    }

    if (typeof MutationObserver !== 'undefined' && gamesMain) {
      classObserver = new MutationObserver(() => {
        if (gamesMain.classList.contains('is-view-switching')) {
          return
        }

        window.requestAnimationFrame(() => {
          syncWhenViewStable()
        })
      })

      classObserver.observe(gamesMain, { attributes: true, attributeFilter: ['class'] })
    }

    return () => {
      if (rafPrimary) {
        window.cancelAnimationFrame(rafPrimary)
      }
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer)
      }
      if (settleTimerLate !== null) {
        window.clearTimeout(settleTimerLate)
      }
      if (settleTimerFinal !== null) {
        window.clearTimeout(settleTimerFinal)
      }
      window.removeEventListener('resize', handleResize)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (classObserver) {
        classObserver.disconnect()
      }
    }
  }, [
    activeSystemKey,
    focusedGameId,
    gameStackListRef,
    gamesViewMode,
    isGamesViewSwitching,
    isGameStackMomentumActive,
    launcherView,
    sceneRouteTransition,
    scrollVisibleGames.length,
    syncGameStackCenter,
  ])

  const jumpToTopGame = useCallback(() => {
    if (scrollVisibleGames.length === 0) {
      return
    }

    stopGameStackMomentum()
    applyGlassScrollWeight(focusedGameIndex > 0 ? -1 : 1, 120)
    focusGameByIndex(0)
  }, [applyGlassScrollWeight, focusGameByIndex, focusedGameIndex, scrollVisibleGames.length, stopGameStackMomentum])

  const jumpToBottomGame = useCallback(() => {
    if (scrollVisibleGames.length === 0) {
      return
    }

    stopGameStackMomentum()
    const lastIndex = scrollVisibleGames.length - 1
    applyGlassScrollWeight(focusedGameIndex < lastIndex ? 1 : -1, 120)
    focusGameByIndex(lastIndex)
  }, [applyGlassScrollWeight, focusGameByIndex, focusedGameIndex, scrollVisibleGames, stopGameStackMomentum])

  const jumpToFavoriteGame = useCallback(() => {
    if (scrollVisibleGames.length === 0) {
      return
    }

    const targetIndex = firstFavoriteGameIndex
    if (targetIndex < 0) {
      return
    }

    stopGameStackMomentum()
    const direction: -1 | 1 = targetIndex >= focusedGameIndex ? 1 : -1
    applyGlassScrollWeight(direction, 118)
    focusGameByIndex(targetIndex)
  }, [
    applyGlassScrollWeight,
    firstFavoriteGameIndex,
    focusGameByIndex,
    focusedGameIndex,
    scrollVisibleGames.length,
    stopGameStackMomentum,
  ])

  const jumpToLetter = useCallback(
    (letter: string) => {
      if (scrollVisibleGames.length === 0) {
        return
      }

      const targetIndex = firstGameIndexByLetter[letter] ?? -1
      if (targetIndex < 0) {
        return
      }

      stopGameStackMomentum()
      const direction: -1 | 1 = targetIndex >= focusedGameIndex ? 1 : -1
      applyGlassScrollWeight(direction, 114)
      focusGameByIndex(targetIndex)
    },
    [
      applyGlassScrollWeight,
      firstGameIndexByLetter,
      focusGameByIndex,
      focusedGameIndex,
      scrollVisibleGames.length,
      stopGameStackMomentum,
    ],
  )

  const jumpToStackProgress = useCallback(
    (progress: number) => {
      if (scrollVisibleGames.length <= 1) {
        return
      }

      const clampedProgress = Math.max(0, Math.min(1, progress))
      const targetIndex = Math.round(clampedProgress * (scrollVisibleGames.length - 1))
      stopGameStackMomentum()
      const direction: -1 | 1 = targetIndex >= focusedGameIndex ? 1 : -1
      applyGlassScrollWeight(direction, 108)
      focusGameByIndex(targetIndex)
    },
    [applyGlassScrollWeight, focusGameByIndex, focusedGameIndex, scrollVisibleGames, stopGameStackMomentum],
  )

  const gameClickEffectsByGameId = useMemo(() => {
    const grouped: Record<string, Array<(typeof gameClickEffects)[number]>> = {}
    for (const effect of gameClickEffects) {
      if (!grouped[effect.gameId]) {
        grouped[effect.gameId] = []
      }

      grouped[effect.gameId].push(effect)
    }

    return grouped
  }, [gameClickEffects])

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
    stopGameStackMomentum,
    pushGameStackMomentum,
    jumpToTopGame,
    jumpToBottomGame,
    jumpToFavoriteGame,
    jumpToLetter,
    jumpToStackProgress,
    gameClickEffectsByGameId,
  }
}
