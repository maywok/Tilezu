import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent, RefObject } from 'react'

type UseLauncherInteractionEffectsParams = {
  isEnabled?: boolean
  sceneRef: RefObject<HTMLElement | null>
  sceneTrailFrameRef: MutableRefObject<number | null>
  pendingScenePointerRef: MutableRefObject<{ clientX: number; clientY: number } | null>
  lastScenePointerRef: MutableRefObject<{ x: number; y: number; time: number } | null>
  sceneTrailFadeTimerRef: MutableRefObject<number | null>
  scrollGlassResetTimerRef: MutableRefObject<number | null>
  pendingGlassWeightRef: MutableRefObject<{ direction: -1 | 1; wheelDelta: number } | null>
  applyGlassFrameRef: MutableRefObject<number | null>
}

export function useLauncherInteractionEffects({
  isEnabled = true,
  sceneRef,
  sceneTrailFrameRef,
  pendingScenePointerRef,
  lastScenePointerRef,
  sceneTrailFadeTimerRef,
  scrollGlassResetTimerRef,
  pendingGlassWeightRef,
  applyGlassFrameRef,
}: UseLauncherInteractionEffectsParams) {
  const isEnabledRef = useRef(isEnabled)
  const hoverPointerByCardRef = useRef(new Map<HTMLButtonElement, { clientX: number; clientY: number }>())
  const hoverFrameByCardRef = useRef(new Map<HTMLButtonElement, number>())
  const gamepadHoverCardRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    isEnabledRef.current = isEnabled
  }, [isEnabled])

  const triggerSystemEnterFeedback = useCallback((button: HTMLButtonElement, clientX?: number, clientY?: number) => {
    const bounds = button.getBoundingClientRect()
    if (!bounds.width || !bounds.height) {
      return
    }

    const fallbackX = bounds.left + bounds.width / 2
    const fallbackY = bounds.top + bounds.height / 2
    const originX = clientX ?? fallbackX
    const originY = clientY ?? fallbackY

    const x = Math.max(0, Math.min(100, ((originX - bounds.left) / bounds.width) * 100))
    const y = Math.max(0, Math.min(100, ((originY - bounds.top) / bounds.height) * 100))

    const ripple = document.createElement('span')
    ripple.className = 'system-enter-ripple'
    ripple.setAttribute('aria-hidden', 'true')
    ripple.style.setProperty('--ripple-x', `${x}%`)
    ripple.style.setProperty('--ripple-y', `${y}%`)

    button.classList.add('system-enter-pulsing')
    button.appendChild(ripple)

    window.setTimeout(() => {
      ripple.remove()
    }, 420)

    window.setTimeout(() => {
      button.classList.remove('system-enter-pulsing')
    }, 430)
  }, [])

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    const onGlobalButtonPress = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }

      const target = event.target as HTMLElement | null
      if (!target) {
        return
      }

      const button = target.closest('button') as HTMLButtonElement | null
      if (!button || button.disabled) {
        return
      }

      if (!button.closest('.wii-scene')) {
        return
      }

      if (button.classList.contains('press-droplet-host')) {
        return
      }

      if (button.classList.contains('system-enter-action') || button.classList.contains('system-launcher-action')) {
        return
      }

      if (button.querySelector('.game-click-fx-layer')) {
        return
      }

      const bounds = button.getBoundingClientRect()
      if (!bounds.width || !bounds.height) {
        return
      }

      button.classList.add('press-droplet-host')

      const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100))
      const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100))

      const layer = document.createElement('span')
      layer.className = 'press-click-fx-layer'
      layer.setAttribute('aria-hidden', 'true')

      const effect = document.createElement('span')
      effect.className = 'press-click-effect'
      effect.style.setProperty('--fx-x', `${x}%`)
      effect.style.setProperty('--fx-y', `${y}%`)

      const ripple = document.createElement('span')
      ripple.className = 'press-click-ripple'
      effect.appendChild(ripple)

      const dropletCount = 2 + Math.floor(Math.random() * 2)
      for (let index = 0; index < dropletCount; index += 1) {
        const angle = -0.85 + index * 0.8 + (Math.random() - 0.5) * 0.38
        const distance = 12 + Math.random() * 18
        const droplet = document.createElement('span')
        droplet.className = 'press-click-droplet'
        droplet.style.setProperty('--drop-x', `${Math.cos(angle) * distance}px`)
        droplet.style.setProperty('--drop-y', `${Math.sin(angle) * distance}px`)
        droplet.style.setProperty('--drop-scale', `${0.72 + Math.random() * 0.42}`)
        droplet.style.setProperty('--drop-delay', `${Math.random() * 0.08}s`)
        effect.appendChild(droplet)
      }

      layer.appendChild(effect)
      button.appendChild(layer)

      const cleanupTimer = window.setTimeout(() => {
        layer.remove()
      }, 620)

      window.setTimeout(() => {
        if (button.querySelector('.press-click-fx-layer')) {
          return
        }
        button.classList.remove('press-droplet-host')
      }, 700)

      window.setTimeout(() => {
        window.clearTimeout(cleanupTimer)
      }, 740)
    }

    window.addEventListener('pointerdown', onGlobalButtonPress, true)
    return () => {
      window.removeEventListener('pointerdown', onGlobalButtonPress, true)
    }
  }, [isEnabled])

  useEffect(() => {
    const hoverFrameByCard = hoverFrameByCardRef.current
    const hoverPointerByCard = hoverPointerByCardRef.current

    return () => {
      for (const frameId of hoverFrameByCard.values()) {
        window.cancelAnimationFrame(frameId)
      }
      hoverFrameByCard.clear()
      hoverPointerByCard.clear()

      const card = gamepadHoverCardRef.current
      if (card) {
        card.style.setProperty('--hover-tilt-x', '0deg')
        card.style.setProperty('--hover-tilt-y', '0deg')
        card.style.setProperty('--hover-shift-x', '0px')
        card.style.setProperty('--hover-shift-y', '0px')
        card.style.setProperty('--hover-energy', '0')
        card.style.setProperty('--x', '50%')
        card.style.setProperty('--y', '50%')
        card.style.setProperty('--liquid-refraction-x', '0px')
        card.style.setProperty('--liquid-refraction-y', '0px')
        card.style.setProperty('--liquid-bg-x', '0px')
        card.style.setProperty('--liquid-bg-y', '0px')
        card.style.setProperty('--liquid-content-x', '0px')
        card.style.setProperty('--liquid-content-y', '0px')
        card.style.setProperty('--liquid-highlight-x', '0px')
        card.style.setProperty('--liquid-highlight-y', '0px')

        if (card.dataset.gamepadHoverParallax === 'true') {
          delete card.dataset.gamepadHoverParallax
          delete card.dataset.hover
        }

        gamepadHoverCardRef.current = null
      }
    }
  }, [])

  const applyCardHoverVisual = useCallback((card: HTMLButtonElement, clampedX: number, clampedY: number) => {
    const normalizedX = clampedX - 0.5
    const normalizedY = clampedY - 0.5
    const hoverEnergy = Math.min(1, Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY) * 2)
    const depthGain = 0.72 + hoverEnergy * 0.9

    const tiltX = normalizedY * 14
    const tiltY = normalizedX * -14
    const shiftX = normalizedX * 6.6
    const shiftY = normalizedY * 6.6

    const pointerX = clampedX * 100
    const pointerY = clampedY * 100

    const refractionX = normalizedX * (1.5 * depthGain)
    const refractionY = normalizedY * (1.5 * depthGain)
    const backgroundX = normalizedX * (2.6 * depthGain)
    const backgroundY = normalizedY * (2.6 * depthGain)
    const contentX = normalizedX * (4.8 * depthGain)
    const contentY = normalizedY * (4.8 * depthGain)
    const highlightX = normalizedX * (7.4 * depthGain)
    const highlightY = normalizedY * (7.4 * depthGain)

    card.style.setProperty('--hover-tilt-x', `${tiltX.toFixed(2)}deg`)
    card.style.setProperty('--hover-tilt-y', `${tiltY.toFixed(2)}deg`)
    card.style.setProperty('--hover-shift-x', `${shiftX.toFixed(2)}px`)
    card.style.setProperty('--hover-shift-y', `${shiftY.toFixed(2)}px`)
    card.style.setProperty('--hover-energy', hoverEnergy.toFixed(3))
    card.style.setProperty('--x', `${pointerX.toFixed(2)}%`)
    card.style.setProperty('--y', `${pointerY.toFixed(2)}%`)
    card.style.setProperty('--liquid-refraction-x', `${refractionX.toFixed(2)}px`)
    card.style.setProperty('--liquid-refraction-y', `${refractionY.toFixed(2)}px`)
    card.style.setProperty('--liquid-bg-x', `${backgroundX.toFixed(2)}px`)
    card.style.setProperty('--liquid-bg-y', `${backgroundY.toFixed(2)}px`)
    card.style.setProperty('--liquid-content-x', `${contentX.toFixed(2)}px`)
    card.style.setProperty('--liquid-content-y', `${contentY.toFixed(2)}px`)
    card.style.setProperty('--liquid-highlight-x', `${highlightX.toFixed(2)}px`)
    card.style.setProperty('--liquid-highlight-y', `${highlightY.toFixed(2)}px`)
    card.dataset.hover = 'true'
  }, [])

  const resetCardHoverVisual = useCallback((card: HTMLButtonElement, clearHoverState = true) => {
    card.style.setProperty('--hover-tilt-x', '0deg')
    card.style.setProperty('--hover-tilt-y', '0deg')
    card.style.setProperty('--hover-shift-x', '0px')
    card.style.setProperty('--hover-shift-y', '0px')
    card.style.setProperty('--hover-energy', '0')
    card.style.setProperty('--x', '50%')
    card.style.setProperty('--y', '50%')
    card.style.setProperty('--liquid-refraction-x', '0px')
    card.style.setProperty('--liquid-refraction-y', '0px')
    card.style.setProperty('--liquid-bg-x', '0px')
    card.style.setProperty('--liquid-bg-y', '0px')
    card.style.setProperty('--liquid-content-x', '0px')
    card.style.setProperty('--liquid-content-y', '0px')
    card.style.setProperty('--liquid-highlight-x', '0px')
    card.style.setProperty('--liquid-highlight-y', '0px')

    if (clearHoverState) {
      delete card.dataset.hover
    }
  }, [])

  const getGridCardByEntryId = useCallback((entryId: string) => {
    if (!entryId) {
      return null
    }

    const activeCard = gamepadHoverCardRef.current
    if (activeCard && activeCard.isConnected && activeCard.dataset.entryId === entryId) {
      return activeCard
    }

    const cards = document.querySelectorAll<HTMLButtonElement>(
      '.game-grid-pane .grid-game-card[data-entry-id], .game-stack .stack-item[data-entry-id]',
    )
    for (const card of cards) {
      if (card.dataset.entryId === entryId) {
        return card
      }
    }

    const activeGridCard = document.querySelector<HTMLButtonElement>('.game-grid-pane .grid-game-card.active')
    if (activeGridCard) {
      return activeGridCard
    }

    const activeStackCard = document.querySelector<HTMLButtonElement>('.game-stack .stack-item.active')
    if (activeStackCard) {
      return activeStackCard
    }

    return null
  }, [])

  const flushScenePointerTrail = useCallback(() => {
    sceneTrailFrameRef.current = null

    if (!isEnabledRef.current) {
      pendingScenePointerRef.current = null
      return
    }

    const pointer = pendingScenePointerRef.current
    pendingScenePointerRef.current = null

    if (!pointer) {
      return
    }

    const scene = sceneRef.current
    if (!scene) {
      return
    }

    const bounds = scene.getBoundingClientRect()
    if (!bounds.width || !bounds.height) {
      return
    }

    const x = ((pointer.clientX - bounds.left) / bounds.width) * 100
    const y = ((pointer.clientY - bounds.top) / bounds.height) * 100
    const now = performance.now()
    const previous = lastScenePointerRef.current

    let intensity = 0
    let angle = 0
    if (previous) {
      const deltaX = pointer.clientX - previous.x
      const deltaY = pointer.clientY - previous.y
      const deltaTime = Math.max(10, now - previous.time)
      const speed = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / deltaTime
      intensity = Math.max(0, Math.min(1, (speed - 0.25) / 1.65))
      angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI
    }

    lastScenePointerRef.current = { x: pointer.clientX, y: pointer.clientY, time: now }

    if (intensity <= 0.03) {
      return
    }

    scene.style.setProperty('--trail-x', `${x.toFixed(2)}%`)
    scene.style.setProperty('--trail-y', `${y.toFixed(2)}%`)
    scene.style.setProperty('--trail-angle', `${angle.toFixed(2)}deg`)
    scene.style.setProperty('--trail-strength', intensity.toFixed(3))
    scene.style.setProperty('--trail-opacity', `${(0.14 + intensity * 0.3).toFixed(3)}`)

    if (sceneTrailFadeTimerRef.current !== null) {
      window.clearTimeout(sceneTrailFadeTimerRef.current)
    }

    sceneTrailFadeTimerRef.current = window.setTimeout(() => {
      if (!sceneRef.current) {
        return
      }

      sceneRef.current.style.setProperty('--trail-opacity', '0')
      sceneTrailFadeTimerRef.current = null
    }, 110)
  }, [lastScenePointerRef, pendingScenePointerRef, sceneRef, sceneTrailFadeTimerRef, sceneTrailFrameRef])

  const handleScenePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!isEnabledRef.current) {
        return
      }

      pendingScenePointerRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      }

      if (sceneTrailFrameRef.current !== null) {
        return
      }

      sceneTrailFrameRef.current = window.requestAnimationFrame(flushScenePointerTrail)
    },
    [flushScenePointerTrail, pendingScenePointerRef, sceneTrailFrameRef],
  )

  const flushGlassScrollWeight = useCallback(() => {
    applyGlassFrameRef.current = null

    if (!isEnabledRef.current) {
      pendingGlassWeightRef.current = null
      return
    }

    const pending = pendingGlassWeightRef.current
    pendingGlassWeightRef.current = null

    if (!pending) {
      return
    }

    const scene = sceneRef.current
    if (!scene) {
      return
    }

    const { direction, wheelDelta } = pending
    const strength = Math.max(0.12, Math.min(0.72, Math.abs(wheelDelta) / 140))
    scene.style.setProperty('--glass-lag-y', `${(direction * 5 * strength).toFixed(2)}px`)
    scene.style.setProperty('--glass-lag-x', `${(direction * 2.4 * strength).toFixed(2)}px`)
    scene.style.setProperty('--glass-lag-scale', `${(1 + 0.01 * strength).toFixed(4)}`)
    scene.style.setProperty('--scroll-parallax-soft-x', `${(-direction * 1.7 * strength).toFixed(2)}px`)
    scene.style.setProperty('--scroll-parallax-soft-y', `${(direction * 5.8 * strength).toFixed(2)}px`)
    scene.style.setProperty('--scroll-parallax-mid-x', `${(-direction * 1.2 * strength).toFixed(2)}px`)
    scene.style.setProperty('--scroll-parallax-mid-y', `${(direction * 4.2 * strength).toFixed(2)}px`)
    scene.style.setProperty('--scroll-parallax-fg-x', `${(-direction * 0.9 * strength).toFixed(2)}px`)
    scene.style.setProperty('--scroll-parallax-fg-y', `${(direction * 3.2 * strength).toFixed(2)}px`)

    if (scrollGlassResetTimerRef.current !== null) {
      window.clearTimeout(scrollGlassResetTimerRef.current)
    }

    scrollGlassResetTimerRef.current = window.setTimeout(() => {
      if (!sceneRef.current) {
        return
      }

      sceneRef.current.style.setProperty('--glass-lag-y', '0px')
      sceneRef.current.style.setProperty('--glass-lag-x', '0px')
      sceneRef.current.style.setProperty('--glass-lag-scale', '1')
      sceneRef.current.style.setProperty('--scroll-parallax-soft-x', '0px')
      sceneRef.current.style.setProperty('--scroll-parallax-soft-y', '0px')
      sceneRef.current.style.setProperty('--scroll-parallax-mid-x', '0px')
      sceneRef.current.style.setProperty('--scroll-parallax-mid-y', '0px')
      sceneRef.current.style.setProperty('--scroll-parallax-fg-x', '0px')
      sceneRef.current.style.setProperty('--scroll-parallax-fg-y', '0px')
      scrollGlassResetTimerRef.current = null
    }, 180)
  }, [applyGlassFrameRef, pendingGlassWeightRef, sceneRef, scrollGlassResetTimerRef])

  const applyGlassScrollWeight = useCallback(
    (direction: -1 | 1, wheelDelta: number) => {
      if (!isEnabledRef.current) {
        return
      }

      pendingGlassWeightRef.current = {
        direction,
        wheelDelta,
      }

      if (applyGlassFrameRef.current !== null) {
        return
      }

      applyGlassFrameRef.current = window.requestAnimationFrame(flushGlassScrollWeight)
    },
    [applyGlassFrameRef, flushGlassScrollWeight, pendingGlassWeightRef],
  )

  const handleCardPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isEnabledRef.current) {
      return
    }

    const card = event.currentTarget

    hoverPointerByCardRef.current.set(card, {
      clientX: event.clientX,
      clientY: event.clientY,
    })

    if (hoverFrameByCardRef.current.has(card)) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      hoverFrameByCardRef.current.delete(card)
      const pointer = hoverPointerByCardRef.current.get(card)
      if (!pointer) {
        return
      }

      const bounds = card.getBoundingClientRect()
      if (!bounds.width || !bounds.height) {
        return
      }

      const x = (pointer.clientX - bounds.left) / bounds.width
      const y = (pointer.clientY - bounds.top) / bounds.height
      const clampedX = Math.max(0, Math.min(1, x))
      const clampedY = Math.max(0, Math.min(1, y))
      applyCardHoverVisual(card, clampedX, clampedY)
    })

    hoverFrameByCardRef.current.set(card, frameId)
  }, [applyCardHoverVisual])

  const resetCardPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const card = event.currentTarget
    const frameId = hoverFrameByCardRef.current.get(card)
    if (typeof frameId === 'number') {
      window.cancelAnimationFrame(frameId)
      hoverFrameByCardRef.current.delete(card)
    }

    hoverPointerByCardRef.current.delete(card)
    resetCardHoverVisual(card)
  }, [resetCardHoverVisual])

  const applyGamepadGridCardParallax = useCallback((entryId: string, axisX: number, axisY: number) => {
    const card = getGridCardByEntryId(entryId)
    if (!card) {
      return
    }

    const previousCard = gamepadHoverCardRef.current
    if (previousCard && previousCard !== card && previousCard.isConnected) {
      if (previousCard.dataset.gamepadHoverParallax === 'true') {
        delete previousCard.dataset.gamepadHoverParallax
      }
      resetCardHoverVisual(previousCard)
    }

    gamepadHoverCardRef.current = card

    const clampedAxisX = Math.max(-1, Math.min(1, Number.isFinite(axisX) ? axisX : 0))
    const clampedAxisY = Math.max(-1, Math.min(1, Number.isFinite(axisY) ? axisY : 0))
    const pointerX = Math.max(0, Math.min(1, 0.5 + clampedAxisX * 0.42))
    const pointerY = Math.max(0, Math.min(1, 0.5 + clampedAxisY * 0.42))

    applyCardHoverVisual(card, pointerX, pointerY)
    card.dataset.gamepadHoverParallax = 'true'
  }, [applyCardHoverVisual, getGridCardByEntryId, resetCardHoverVisual])

  const clearGamepadGridCardParallax = useCallback((entryId?: string) => {
    const targetCard = entryId ? getGridCardByEntryId(entryId) : gamepadHoverCardRef.current
    if (!targetCard) {
      return
    }

    if (targetCard.dataset.gamepadHoverParallax === 'true') {
      delete targetCard.dataset.gamepadHoverParallax
    }

    resetCardHoverVisual(targetCard)
    if (gamepadHoverCardRef.current === targetCard) {
      gamepadHoverCardRef.current = null
    }
  }, [getGridCardByEntryId, resetCardHoverVisual])

  return {
    triggerSystemEnterFeedback,
    handleScenePointerMove,
    handleCardPointerMove,
    resetCardPointerMove,
    applyGamepadGridCardParallax,
    clearGamepadGridCardParallax,
    applyGlassScrollWeight,
  }
}
