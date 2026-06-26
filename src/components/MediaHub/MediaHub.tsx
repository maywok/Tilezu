import type { CSSProperties, RefObject } from 'react'

import styles from './mediahub.module.css'

type MediaPreview = {
  imageUrl: string
  videoUrl?: string
}

type NowPlayingInfo = {
  albumTitle: string
  artist: string
  isPlaying: boolean
  sourceApp: string
  title: string
}

type MediaHubProps = {
  playtimePrimaryText: string
  playtimeSecondaryText: string
  applySystemVolume: (nextValue: number, options?: { debounce?: boolean; syncFromBackend?: boolean }) => void
  handleMediaTransport: (command: 'media_previous_track' | 'media_toggle_playback' | 'media_next_track') => void
  isMuted: boolean
  isTitleOverflowing: boolean
  media: MediaPreview | null
  mediaVolume: number
  normalizedNowPlayingSource: string
  nowPlaying: NowPlayingInfo | null
  titleScrollDistance: number
  titleScrollDurationSeconds: number
  titleTextRef: RefObject<HTMLSpanElement | null>
  titleWrapRef: RefObject<HTMLSpanElement | null>
  toggleMute: () => void
  triggerAction: (action: 'playtime' | 'select') => void
  volumeSliderRef: RefObject<HTMLInputElement | null>
  isHidden?: boolean
  onToggleHidden?: () => void
}

export function MediaHub({
  playtimePrimaryText,
  playtimeSecondaryText,
  applySystemVolume,
  handleMediaTransport,
  isMuted,
  isTitleOverflowing,
  media,
  mediaVolume,
  normalizedNowPlayingSource,
  nowPlaying,
  titleScrollDistance,
  titleScrollDurationSeconds,
  titleTextRef,
  titleWrapRef,
  toggleMute,
  triggerAction,
  volumeSliderRef,
  isHidden = false,
  onToggleHidden,
}: MediaHubProps) {
  const mediaContent = (
    <>
      <button type="button" className="achievement-pill-glass" onClick={() => triggerAction('playtime')}>
        <div className="achievement-icon-placeholder" aria-hidden>
          {'\u23F1'}
        </div>
        <div className="achievement-meta">
          <span className="achievement-count-glass">{'\u23F1'} {playtimePrimaryText}</span>
          <span className="achievement-label-glass">{playtimeSecondaryText}</span>
        </div>
      </button>

      <div className={`${styles.mediaPreviewOffset} media-preview-glass`} onClick={() => triggerAction('select')} role="group" aria-label="Media panel">
        {media && media.imageUrl ? (
          <img src={media.imageUrl} alt="Media Preview" className="media-image-glass" />
        ) : (
          <div className="media-placeholder">
            {nowPlaying ? (
              <>
                <span className="now-playing-source">{normalizedNowPlayingSource}</span>
                <span className={isTitleOverflowing ? 'now-playing-title-wrap is-overflowing' : 'now-playing-title-wrap'} ref={titleWrapRef}>
                  <span
                    ref={titleTextRef}
                    className={isTitleOverflowing ? 'now-playing-title is-marquee' : 'now-playing-title'}
                    style={
                      isTitleOverflowing
                        ? ({
                            ['--title-scroll-distance' as string]: `${titleScrollDistance}px`,
                            ['--title-scroll-duration' as string]: `${titleScrollDurationSeconds}s`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    {nowPlaying.title || 'Unknown title'}
                  </span>
                </span>
                <span className="now-playing-subtitle">{nowPlaying.artist || nowPlaying.albumTitle || 'Unknown artist'}</span>
                <span className="now-playing-state">{nowPlaying.isPlaying ? 'Playing' : 'Paused'}</span>
              </>
            ) : (
              'No media'
            )}
          </div>
        )}
        <div className="media-controls-row" aria-label="Media controls row">
          <div className="media-controls-center">
            <button
              type="button"
              className="media-control-pill"
              aria-label="Previous"
              title="Previous"
              onClick={(event) => {
                event.stopPropagation()
                handleMediaTransport('media_previous_track')
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="media-control-icon">
                <path d="M16 6l-7 6 7 6V6zM8 6H6v12h2V6z" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="media-control-pill"
              aria-label={nowPlaying?.isPlaying ? 'Pause' : 'Play'}
              title={nowPlaying?.isPlaying ? 'Pause' : 'Play'}
              onClick={(event) => {
                event.stopPropagation()
                handleMediaTransport('media_toggle_playback')
              }}
            >
              {nowPlaying?.isPlaying ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="media-control-icon">
                  <path d="M8 6h3v12H8V6zm5 0h3v12h-3V6z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="media-control-icon">
                  <path d="M8 6v12l10-6L8 6z" fill="currentColor" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="media-control-pill"
              aria-label="Next"
              title="Next"
              onClick={(event) => {
                event.stopPropagation()
                handleMediaTransport('media_next_track')
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="media-control-icon">
                <path d="M8 6l7 6-7 6V6zm8 0h2v12h-2V6z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div
            className="media-volume-fade"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <button
              type="button"
              className="media-volume-icon"
              aria-label={isMuted || mediaVolume <= 0 ? 'Unmute volume' : 'Mute volume'}
              title={isMuted || mediaVolume <= 0 ? 'Unmute volume' : 'Mute volume'}
              onClick={(event) => {
                event.stopPropagation()
                toggleMute()
              }}
            >
              {isMuted || mediaVolume <= 0 ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="media-volume-icon-svg">
                  <path d="M4.5 10.2h3.6L12.6 6v12l-4.5-4.2H4.5v-3.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15.4 9.1l4.1 5.8M19.5 9.1l-4.1 5.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="media-volume-icon-svg">
                  <path d="M4.5 10.2h3.6L12.6 6v12l-4.5-4.2H4.5v-3.6z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15.2 10.1a3.2 3.2 0 0 1 0 3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M17.8 8a6.3 6.3 0 0 1 0 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <input
              ref={volumeSliderRef}
              className="media-volume-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={mediaVolume}
              aria-label="Media volume"
              title={`Volume ${mediaVolume}%`}
              onInput={(event) => {
                applySystemVolume(Number(event.currentTarget.value), { debounce: true })
              }}
              onChange={(event) => {
                applySystemVolume(Number(event.currentTarget.value), { syncFromBackend: true })
              }}
            />
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className={`${styles.mediaHubRoot} sidebar-middle-glass`}>
        <div className={styles.mediaHubHeader}>
          {onToggleHidden && (
            <button
              type="button"
              className={styles.mediaHubToggleBtn}
              aria-label={isHidden ? 'Show media player' : 'Hide media player'}
              title={isHidden ? 'Show media player' : 'Hide media player'}
              onClick={onToggleHidden}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.mediaHubToggleIcon}>
                {isHidden
                  ? <path d="M7 10l5 5 5-5H7z" fill="currentColor" />
                  : <path d="M7 14l5-5 5 5H7z" fill="currentColor" />
                }
              </svg>
            </button>
          )}
        </div>
        {!isHidden && mediaContent}
      </div>
    </>
  )
}
