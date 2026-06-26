import type { CSSProperties } from 'react'

import styles from './StickerFoilImage.module.css'
import type { PlayerIdFoilType } from './types'

type StickerFoilImageProps = {
  imageUrl: string
  outlineImageUrl?: string
  foilType: PlayerIdFoilType
  alt?: string
  className?: string
  imageClassName?: string
  pixelCrunch?: boolean
}

function foilClassName(foilType: PlayerIdFoilType): string {
  switch (foilType) {
    case 'holographic':
      return styles.foilHolographic
    case 'aurora':
      return styles.foilAurora
    case 'ripple':
      return styles.foilRipple
    default:
      return styles.foilNone
  }
}

export function StickerFoilImage({
  imageUrl,
  outlineImageUrl,
  foilType,
  alt = '',
  className,
  imageClassName,
  pixelCrunch = false,
}: StickerFoilImageProps) {
  const displayUrl = (outlineImageUrl?.trim() || imageUrl).trim()
  if (!displayUrl) {
    return null
  }

  const wrapClass = [styles.foilWrap, foilClassName(foilType), className].filter(Boolean).join(' ')
  const imgClass = [styles.foilImage, pixelCrunch ? styles.foilImagePixel : '', imageClassName].filter(Boolean).join(' ')

  const style = {
    WebkitMaskImage: `url("${displayUrl}")`,
    maskImage: `url("${displayUrl}")`,
  } as CSSProperties

  return (
    <span className={wrapClass}>
      <img src={displayUrl} alt={alt} className={imgClass} />
      {foilType !== 'none' ? (
        <>
          <span className={styles.stickerSpecular} style={style} aria-hidden="true" />
          <span className={styles.stickerPolychrome} style={style} aria-hidden="true" />
        </>
      ) : null}
    </span>
  )
}
