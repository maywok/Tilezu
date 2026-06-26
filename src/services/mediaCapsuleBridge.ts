export type NowPlayingBridgeInfo = {
  sourceApp: string
  title: string
  artist: string
  albumTitle: string
  isPlaying: boolean
  artworkUrl?: string
}

export type RectLike = {
  left: number
  top: number
  width: number
  height: number
}

export type MediaCapsuleState = {
  nowPlaying: NowPlayingBridgeInfo | null
  normalizedSource: string
  isHidden: boolean
  isPopped: boolean
  isMuted: boolean
  mediaCardRect: RectLike | null
  updatedAt: number
}

export type MediaCapsuleCommand =
  | { type: 'open-player' }
  | { type: 'toggle-playback' }
  | { type: 'previous-track' }
  | { type: 'next-track' }
  | { type: 'hide-player' }

export type MediaCapsuleTransition = {
  direction: 'to-capsule'
  fromRect: RectLike
}

const MEDIA_CAPSULE_STATE_EVENT = 'tm-media-capsule-state'
const MEDIA_CAPSULE_COMMAND_EVENT = 'tm-media-capsule-command'
const MEDIA_CAPSULE_TRANSITION_EVENT = 'tm-media-capsule-transition'

export const TM_MEDIA_PANEL_SELECTOR = '[data-tm-media-panel]'
export const TM_MEDIA_CAPSULE_SELECTOR = '[data-tm-media-capsule]'
const TM_SIDEBAR_MEDIA_CARD_SELECTOR = '.media-preview-glass'

function isVisibleMediaElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function readMediaBridgeCardRect(preferExpandedPanel = true): RectLike | null {
  if (typeof document === 'undefined') {
    return null
  }

  const selectorGroups = preferExpandedPanel
    ? [TM_SIDEBAR_MEDIA_CARD_SELECTOR, TM_MEDIA_PANEL_SELECTOR, TM_MEDIA_CAPSULE_SELECTOR]
    : [TM_SIDEBAR_MEDIA_CARD_SELECTOR, TM_MEDIA_CAPSULE_SELECTOR, TM_MEDIA_PANEL_SELECTOR]

  for (const selector of selectorGroups) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))
    const visible = candidates.find(isVisibleMediaElement)
    if (visible) {
      return rectToRectLike(visible.getBoundingClientRect())
    }
  }

  return null
}

export function rectToRectLike(rect: DOMRect | null | undefined): RectLike | null {
  if (!rect) {
    return null
  }

  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
    return null
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function emitMediaCapsuleState(detail: MediaCapsuleState): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<MediaCapsuleState>(MEDIA_CAPSULE_STATE_EVENT, { detail }))
}

export function onMediaCapsuleState(handler: (detail: MediaCapsuleState) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<MediaCapsuleState>
    if (customEvent.detail) {
      handler(customEvent.detail)
    }
  }

  window.addEventListener(MEDIA_CAPSULE_STATE_EVENT, listener)
  return () => window.removeEventListener(MEDIA_CAPSULE_STATE_EVENT, listener)
}

export function emitMediaCapsuleCommand(command: MediaCapsuleCommand): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<MediaCapsuleCommand>(MEDIA_CAPSULE_COMMAND_EVENT, { detail: command }))
}

export function onMediaCapsuleCommand(handler: (command: MediaCapsuleCommand) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<MediaCapsuleCommand>
    if (customEvent.detail) {
      handler(customEvent.detail)
    }
  }

  window.addEventListener(MEDIA_CAPSULE_COMMAND_EVENT, listener)
  return () => window.removeEventListener(MEDIA_CAPSULE_COMMAND_EVENT, listener)
}

export function emitMediaCapsuleTransition(transition: MediaCapsuleTransition): void {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<MediaCapsuleTransition>(MEDIA_CAPSULE_TRANSITION_EVENT, { detail: transition }))
}

export function onMediaCapsuleTransition(handler: (transition: MediaCapsuleTransition) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<MediaCapsuleTransition>
    if (customEvent.detail) {
      handler(customEvent.detail)
    }
  }

  window.addEventListener(MEDIA_CAPSULE_TRANSITION_EVENT, listener)
  return () => window.removeEventListener(MEDIA_CAPSULE_TRANSITION_EVENT, listener)
}
