import { invoke } from '@tauri-apps/api/core'

const BOOT_PERF_FLAG_KEY = 'tm:perfLogs'
const moduleStartMs = typeof window !== 'undefined' && typeof window.performance !== 'undefined'
  ? window.performance.now()
  : 0
const MAX_LONGTASK_LOGS = 30

let cachedBootPerfEnabled: boolean | null = null
let runtimeObserversInstalled = false
let runtimeLongTaskCount = 0

function resolveBootPerfEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const searchEnabled = window.location.search.toLowerCase().includes('tmperf=1')
  if (searchEnabled) {
    return true
  }

  try {
    return window.localStorage.getItem(BOOT_PERF_FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function isBootPerfEnabled(): boolean {
  if (cachedBootPerfEnabled === null) {
    cachedBootPerfEnabled = resolveBootPerfEnabled()
  }

  return cachedBootPerfEnabled
}

export function markBootStage(stage: string, details?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.performance === 'undefined') {
    return
  }

  const elapsedMs = Math.max(0, window.performance.now() - moduleStartMs)
  const elapsedLabel = `${elapsedMs.toFixed(1)}ms`
  const detailsJson = details && Object.keys(details).length > 0
    ? JSON.stringify(details)
    : ''

  // Always persist boot timing lines when running in Tauri so they can be viewed from chat/terminal.
  void invoke('append_boot_perf_event', {
    request: {
      stage,
      elapsedMs,
      details: detailsJson,
    },
  }).catch(() => {
    // Ignore persistence failures outside Tauri or during very early startup.
  })

  if (!isBootPerfEnabled()) {
    return
  }

  if (details && Object.keys(details).length > 0) {
    console.info(`[boot] ${stage} @ ${elapsedLabel}`, details)
    return
  }

  console.info(`[boot] ${stage} @ ${elapsedLabel}`)
}

export function createBootPerfSpan(stage: string, details?: Record<string, unknown>) {
  const startedAt = typeof window !== 'undefined' && typeof window.performance !== 'undefined'
    ? window.performance.now()
    : 0
  let ended = false

  return {
    end(extraDetails?: Record<string, unknown>) {
      if (ended) {
        return
      }

      ended = true
      const now = typeof window !== 'undefined' && typeof window.performance !== 'undefined'
        ? window.performance.now()
        : startedAt
      const durationMs = Math.max(0, now - startedAt)
      markBootStage(`${stage}:done`, {
        durationMs: Number(durationMs.toFixed(2)),
        ...(details ?? {}),
        ...(extraDetails ?? {}),
      })
    },
  }
}

export function timeBootSync<T>(stage: string, work: () => T, details?: Record<string, unknown>): T {
  const span = createBootPerfSpan(stage, details)
  try {
    return work()
  } finally {
    span.end()
  }
}

export async function timeBootAsync<T>(
  stage: string,
  work: () => Promise<T>,
  details?: Record<string, unknown>,
): Promise<T> {
  const span = createBootPerfSpan(stage, details)
  try {
    return await work()
  } finally {
    span.end()
  }
}

export function installRuntimePerfObservers(): void {
  if (runtimeObserversInstalled || typeof window === 'undefined' || typeof window.performance === 'undefined') {
    return
  }

  runtimeObserversInstalled = true

  markBootStage('runtime:observer-installed', {
    userAgent: navigator.userAgent,
    hardwareConcurrency: typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null,
    deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
  })

  const PerfObserver = window.PerformanceObserver
  if (typeof PerfObserver === 'undefined') {
    return
  }

  try {
    const supported = PerfObserver.supportedEntryTypes ?? []

    if (supported.includes('navigation')) {
      const navigationObserver = new PerfObserver((list) => {
        for (const entry of list.getEntries()) {
          markBootStage('runtime:navigation', {
            domContentLoadedMs: Number(entry.toJSON().domContentLoadedEventEnd ?? 0),
            loadEventEndMs: Number(entry.toJSON().loadEventEnd ?? 0),
          })
        }
      })
      navigationObserver.observe({ type: 'navigation', buffered: true })
    }

    if (supported.includes('paint')) {
      const paintObserver = new PerfObserver((list) => {
        for (const entry of list.getEntries()) {
          markBootStage('runtime:paint', {
            name: entry.name,
            startTimeMs: Number(entry.startTime.toFixed(2)),
          })
        }
      })
      paintObserver.observe({ type: 'paint', buffered: true })
    }

    if (supported.includes('longtask')) {
      const longTaskObserver = new PerfObserver((list) => {
        for (const entry of list.getEntries()) {
          runtimeLongTaskCount += 1
          if (runtimeLongTaskCount > MAX_LONGTASK_LOGS) {
            continue
          }

          markBootStage('runtime:longtask', {
            durationMs: Number(entry.duration.toFixed(2)),
            startTimeMs: Number(entry.startTime.toFixed(2)),
          })
        }
      })
      longTaskObserver.observe({ type: 'longtask', buffered: true })
    }
  } catch {
    // Ignore observer registration errors in environments with partial support.
  }
}
