import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

import { onMediaCapsuleState } from '../../../services/mediaCapsuleBridge'
import {
  isExternalMediaPlaying,
  type ExternalMediaInfo,
} from '../utils/externalMediaDetection'

const EXTERNAL_MEDIA_POLL_MS = 1200

type NowPlayingResponse = ExternalMediaInfo | null

export function useExternalMediaPlaying(enabled = true): boolean {
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsPlaying(false)
      return
    }

    const apply = (media: NowPlayingResponse) => {
      setIsPlaying(isExternalMediaPlaying(media))
    }

    const disposeCapsule = onMediaCapsuleState((detail) => {
      apply(detail.nowPlaying)
    })

    const poll = () => {
      void invoke<NowPlayingResponse>('get_now_playing')
        .then((data) => apply(data))
        .catch(() => apply(null))
    }

    poll()
    const pollTimer = window.setInterval(poll, EXTERNAL_MEDIA_POLL_MS)

    return () => {
      disposeCapsule()
      window.clearInterval(pollTimer)
    }
  }, [enabled])

  return isPlaying
}
