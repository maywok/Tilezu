import { useEffect, useState } from 'react'
import { createBootPerfSpan } from '../utils/bootPerf'

export function useDeferredStartup(delayMs: number): boolean {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const startupSpan = createBootPerfSpan('deferred-startup', { delayMs })
    let cancelled = false
    let secondFrameId: number | null = null
    let deferredTimerId: number | null = null

    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        deferredTimerId = window.setTimeout(() => {
          if (!cancelled) {
            setIsReady(true)
            startupSpan.end({ ready: true })
          }
        }, delayMs)
      })
    })

    return () => {
      cancelled = true
      startupSpan.end({ ready: false })
      window.cancelAnimationFrame(firstFrameId)
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId)
      }
      if (deferredTimerId !== null) {
        window.clearTimeout(deferredTimerId)
      }
    }
  }, [delayMs])

  return isReady
}
