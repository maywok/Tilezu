export type ExternalMediaInfo = {
  sourceApp?: string
  title?: string
  artist?: string
  albumTitle?: string
  isPlaying?: boolean
}

export function hasExternalMediaMetadata(media: ExternalMediaInfo | null | undefined): boolean {
  if (!media) {
    return false
  }

  return [media.title, media.artist, media.albumTitle, media.sourceApp].some(
    (value) => (value ?? '').trim().length > 0,
  )
}

export function isExternalMediaPlaying(media: ExternalMediaInfo | null | undefined): boolean {
  return Boolean(media?.isPlaying) && hasExternalMediaMetadata(media)
}
