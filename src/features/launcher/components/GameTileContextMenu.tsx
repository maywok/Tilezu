import type { FC } from 'react'

import type { GameEntry, GameUpdateStatus } from '../types'
import { normalizeGameTitle } from '../utils/search'
import { LauncherContextMenu, type LauncherContextMenuItem } from './LauncherContextMenu'

export type GameTileContextMenuState = {
  entryId: string
  x: number
  y: number
}

type GameTileContextMenuProps = {
  entry: GameEntry
  position: { x: number; y: number }
  isFavorite: boolean
  updateStatus: GameUpdateStatus
  canOpenFolder: boolean
  onClose: () => void
  onPlay: () => void
  onToggleFavorite: () => void
  onOpenPlaytime: () => void
  onOpenFolder: () => void
  onRemove: () => void
}

export const GameTileContextMenu: FC<GameTileContextMenuProps> = ({
  entry,
  position,
  isFavorite,
  updateStatus,
  canOpenFolder,
  onClose,
  onPlay,
  onToggleFavorite,
  onOpenPlaytime,
  onOpenFolder,
  onRemove,
}) => {
  const primaryLabel =
    updateStatus === 'update_available'
      ? 'Update'
      : updateStatus === 'downloading_or_staging'
        ? 'Updating...'
        : 'Play'

  const items: LauncherContextMenuItem[] = [
    {
      id: 'play',
      label: primaryLabel,
      onSelect: onPlay,
      disabled: updateStatus === 'downloading_or_staging',
    },
    {
      id: 'favorite',
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      onSelect: onToggleFavorite,
    },
    {
      id: 'playtime',
      label: 'View playtime',
      onSelect: onOpenPlaytime,
    },
    {
      id: 'folder',
      label: 'Open install folder',
      onSelect: onOpenFolder,
      disabled: !canOpenFolder,
    },
    {
      id: 'remove',
      label: 'Remove from library',
      onSelect: onRemove,
      danger: true,
      dividerBefore: true,
    },
  ]

  return (
    <LauncherContextMenu
      position={position}
      title={normalizeGameTitle(entry.title)}
      items={items}
      onClose={onClose}
      ariaLabel={`Actions for ${normalizeGameTitle(entry.title)}`}
    />
  )
}