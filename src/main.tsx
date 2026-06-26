import { StrictMode, Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/nunito/500.css'
import '@fontsource/nunito/700.css'
import './index.css'
import { SignatureRungoPreview } from './components/SignatureRungoPreview'
import { getKeychainById, ownedKeychains, type KeychainAnimationState } from './components/keychains-data'
import { installRuntimePerfObservers, markBootStage } from './utils/bootPerf'
import { initLauncherContextMenuGuard } from './features/launcher/launcherContextMenuGuard'

initLauncherContextMenuGuard()

const App = lazy(async () => import('./App.tsx'))

const RUNGO_SIGNATURE_STORAGE_KEY = 'tm:rungoSignatureId'
const RUNGO_UNLOCKED_STORAGE_KEY = 'tm:rungoUnlocked'
const DEFAULT_BOOT_RUNGO_ID = 'base'

markBootStage('main:module-evaluated')

function resolveUnlockedBootRungoIds(): string[] {
  if (typeof window === 'undefined') {
    return [DEFAULT_BOOT_RUNGO_ID]
  }

  try {
    const raw = window.localStorage.getItem(RUNGO_UNLOCKED_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const list = Array.isArray(parsed) ? parsed : []
    const valid = list
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => Boolean(entry && getKeychainById(entry)?.sprites?.running))

    if (valid.length > 0) {
      return Array.from(new Set(valid))
    }
  } catch {
    // Ignore malformed local storage payloads and fallback to defaults.
  }

  return ownedKeychains
    .filter((entry) => Boolean(entry.sprites?.running))
    .slice(0, 1)
    .map((entry) => entry.id)
}

function pickRandomRungoIds(ids: string[], count: number): string[] {
  if (ids.length <= count) {
    return [...ids]
  }

  const shuffled = [...ids]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = current
  }

  return shuffled.slice(0, count)
}

function resolveBootRungoId(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_BOOT_RUNGO_ID
  }

  try {
    const raw = window.localStorage.getItem(RUNGO_SIGNATURE_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_BOOT_RUNGO_ID
    }

    const parsed = JSON.parse(raw)
    const normalized = typeof parsed === 'string'
      ? parsed.trim()
      : ''

    if (normalized && getKeychainById(normalized)) {
      return normalized
    }
  } catch {
    // Ignore malformed local storage payloads and keep fallback.
  }

  return DEFAULT_BOOT_RUNGO_ID
}

function BootSplash({ locked = false }: { locked?: boolean }) {
  const rungoId = resolveBootRungoId()
  const [loadProgress, setLoadProgress] = useState(0)
  const [hopToken, setHopToken] = useState(0)
  const [ambientMode, setAmbientMode] = useState<KeychainAnimationState>('running')
  const eventTimerRef = useRef<number | null>(null)
  const eventChainTimeoutsRef = useRef<number[]>([])
  const specialEventActiveRef = useRef(false)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 })
  const [companionRungoIds] = useState(() => {
    const unlockedIds = resolveUnlockedBootRungoIds().filter((entry) => entry !== rungoId)
    if (unlockedIds.length === 0) {
      return [rungoId]
    }

    return pickRandomRungoIds(unlockedIds, 3)
  })
  useEffect(() => {
    markBootStage('splash:mounted', {
      locked,
      companions: companionRungoIds.length,
    })
  }, [companionRungoIds.length, locked])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateReducedMotion = () => {
      setIsReducedMotion(mediaQuery.matches)
    }

    updateReducedMotion()
    mediaQuery.addEventListener('change', updateReducedMotion)

    return () => {
      mediaQuery.removeEventListener('change', updateReducedMotion)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const intervalId = window.setInterval(() => {
      setLoadProgress((previous) => {
        const next = previous + (Math.random() * 6.8) + 1.8
        return next >= 100 ? 0 : next
      })
    }, 180)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const clearEventChain = () => {
      eventChainTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      eventChainTimeoutsRef.current = []
      specialEventActiveRef.current = false
    }

    const runBumpToFallEvent = () => {
      clearEventChain()
      specialEventActiveRef.current = true
      setAmbientMode('bump')

      const fallTimeout = window.setTimeout(() => {
        setAmbientMode('fall')
      }, 360)

      const recoverTimeout = window.setTimeout(() => {
        setAmbientMode('running')
        clearEventChain()
      }, 1200)

      eventChainTimeoutsRef.current = [fallTimeout, recoverTimeout]
    }

    if (eventTimerRef.current !== null) {
      window.clearInterval(eventTimerRef.current)
      eventTimerRef.current = null
    }

    eventTimerRef.current = window.setInterval(() => {
      if (specialEventActiveRef.current) {
        return
      }

      const roll = Math.random()
      const specialChance = locked ? 0.1 : 0.02

      if (roll < specialChance) {
        runBumpToFallEvent()
        return
      }

      if (roll < (isReducedMotion ? 0.18 : 0.28)) {
        setHopToken((previous) => previous + 1)
      }
    }, isReducedMotion ? 2800 : 2100)

    return () => {
      if (eventTimerRef.current !== null) {
        window.clearInterval(eventTimerRef.current)
        eventTimerRef.current = null
      }
      clearEventChain()
    }
  }, [isReducedMotion, locked])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (isReducedMotion) {
      setParallaxOffset({ x: 0, y: 0 })
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const width = Math.max(1, window.innerWidth)
      const height = Math.max(1, window.innerHeight)
      const nx = ((event.clientX / width) - 0.5) * 2
      const ny = ((event.clientY / height) - 0.5) * 2
      const clamp = (value: number) => Math.max(-1, Math.min(1, value))

      setParallaxOffset({
        x: Math.round(clamp(nx) * 14),
        y: Math.round(clamp(ny) * 10),
      })
    }

    const handlePointerLeave = () => {
      setParallaxOffset({ x: 0, y: 0 })
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [isReducedMotion])

  const splashStyle = useMemo<CSSProperties>(() => {
    return {
      '--boot-parallax-x': `${parallaxOffset.x}px`,
      '--boot-parallax-y': `${parallaxOffset.y}px`,
    } as CSSProperties
  }, [parallaxOffset.x, parallaxOffset.y])
  const progressStyle = useMemo<CSSProperties>(() => {
    return {
      '--boot-progress': `${loadProgress.toFixed(2)}%`,
    } as CSSProperties
  }, [loadProgress])

  return (
    <div className="boot-splash" style={splashStyle} role="status" aria-live="polite" aria-label="Loading Tilezu">
      <div className="boot-splash-atmo" aria-hidden="true">
        <span className="boot-splash-atmo-shape shape-a" />
        <span className="boot-splash-atmo-shape shape-b" />
        <span className="boot-splash-atmo-shape shape-c" />
      </div>

      <div className="boot-splash-center">
        <div className="boot-splash-hero-ring" aria-hidden="true">
          {companionRungoIds.map((entryId, index) => {
            const companionCount = Math.max(1, companionRungoIds.length)
            const angleStep = 360 / companionCount
            const angle = angleStep * index
            const orbitDuration = 8.2 + (index * 0.9)
            return (
              <span
                key={`boot-orbit-${entryId}-${index}`}
                className="boot-splash-orbit-offset"
                style={{ '--orbit-angle': `${angle}deg` } as CSSProperties}
              >
                <span
                  className="boot-splash-companion-orbit"
                  style={{ '--orbit-duration': `${orbitDuration.toFixed(2)}s` } as CSSProperties}
                >
                  <span className="boot-splash-companion-runner">
                    <SignatureRungoPreview
                      rungoId={entryId}
                      className="boot-splash-companion-rungo"
                      fallbackClassName="boot-splash-companion-fallback"
                      sizePx={30}
                      ambientMode="running"
                    />
                  </span>
                </span>
              </span>
            )
          })}
        </div>

        <div className="boot-splash-rungo-wrap" aria-hidden="true">
          <SignatureRungoPreview
            rungoId={rungoId}
            className="boot-splash-rungo"
            fallbackClassName="boot-splash-rungo-fallback"
            sizePx={64}
            ambientMode={ambientMode}
            hopToken={hopToken}
          />
        </div>

        <div className="boot-splash-progress" aria-hidden="true" style={progressStyle}>
          <span className="boot-splash-progress-fill" />
          <span className="boot-splash-progress-gap" />
        </div>
      </div>
    </div>
  )
}

function RootApp() {
  const [isBootSplashLocked, setIsBootSplashLocked] = useState(false)

  useEffect(() => {
    markBootStage('root:mounted')
    installRuntimePerfObservers()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.code !== 'Backquote') {
        return
      }

      event.preventDefault()
      setIsBootSplashLocked((previous) => !previous)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  if (isBootSplashLocked) {
    return <BootSplash locked />
  }

  return (
    <Suspense fallback={<BootSplash />}>
      <App />
    </Suspense>
  )
}

import ErrorBoundary from './ErrorBoundary'

markBootStage('main:render-start')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RootApp />
    </ErrorBoundary>
  </StrictMode>,
)

queueMicrotask(() => {
  markBootStage('main:first-microtask')
})
