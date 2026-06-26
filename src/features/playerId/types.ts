import type { CSSProperties } from 'react'

export type PlayerIdFoilType = 'none' | 'holographic' | 'aurora' | 'ripple'

export type PlayerIdAccentId =
  | 'ocean'
  | 'rose'
  | 'mint'
  | 'sunset'
  | 'violet'
  | 'slate'
  | 'gold'
  | 'ember'

export type PlayerIdStickerPlacement = {
  id: string
  sourceImageUrl: string
  outlineImageUrl: string
  foilType: PlayerIdFoilType
  x: number
  y: number
  rotation: number
  scale: number
}

export type PlayerIdLayoutPrefs = {
  accentId: PlayerIdAccentId
  foilType: PlayerIdFoilType
  /** @deprecated migrated into stickers[] */
  stickerImageUrl: string
  bannerDataUrl: string
  stickers: PlayerIdStickerPlacement[]
  heroGameId: string
  showcaseGameIds: [string, string, string]
  featuredSystemKey: string
}

/** @deprecated Use PlayerIdLayoutPrefs */
export type PlayerIdLicense = Pick<PlayerIdLayoutPrefs, 'accentId' | 'foilType' | 'stickerImageUrl'>

/** @deprecated Use PlayerIdLayoutPrefs */
export type PlayerIdAvatarDecoration = Pick<PlayerIdLayoutPrefs, 'foilType' | 'stickerImageUrl'>

export type PlayerIdStats = {
  totalGames: number
  totalPlaytimeText: string
  systemsUsed: number
  favoriteGameName: string
}

export type PlayerIdIdentity = {
  displayName: string
  avatarDataUrl: string
  statusLine: string
  bio: string
}

export type PlayerIdGameDisplay = {
  id: string
  title: string
  coverUrl: string
  playtimeText: string
}

export type PlayerIdFeaturedSystem = {
  key: string
  label: string
  short: string
  logoPath: string
  collageOverrideDataUrl?: string
}

export type PlayerIdShowcase = {
  heroGame: PlayerIdGameDisplay | null
  showcaseGames: [PlayerIdGameDisplay | null, PlayerIdGameDisplay | null, PlayerIdGameDisplay | null]
  featuredSystem: PlayerIdFeaturedSystem | null
}

export type PlayerIdCardEditProps = {
  interactiveStickers?: boolean
  selectedStickerId?: string | null
  onStickerSelect?: (id: string | null) => void
  onStickerPatch?: (id: string, patch: Partial<Pick<PlayerIdStickerPlacement, 'x' | 'y' | 'rotation' | 'scale'>>) => void
}

export type PlayerIdCardProps = {
  identity: PlayerIdIdentity
  stats: PlayerIdStats
  layout: PlayerIdLayoutPrefs
  showcase: PlayerIdShowcase
  variant?: 'chip' | 'card'
  className?: string
  interactive?: boolean
  parallaxStyle?: CSSProperties
} & PlayerIdCardEditProps

export const MAX_PLAYER_ID_STICKERS = 3
