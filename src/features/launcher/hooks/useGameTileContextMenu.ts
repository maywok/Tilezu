import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react'

import { openFolderInExplorer } from '../../../services/launcherService'
import type { CopyContextMenuState } from '../components/CopyContextMenu'
import type { GameTileContextMenuState } from '../components/GameTileContextMenu'
import { setLauncherContextMenuHandler } from '../launcherContextMenuGuard'
import type { GameEntry, GameLibraryMeta, GameUpdateStatus } from '../types'
import { resolveGameExplorerFolder } from '../utils/resolveGameExplorerFolder'

type UseGameTileContextMenuOptions = {
  enabled: boolean
  library: GameEntry[]
  gameMetaById: Record<string, GameLibraryMeta>
  gameUpdateStatusById: Record<string, GameUpdateStatus>
  onFocusGame: (gameId: string) => void
  launchGame: (entry: GameEntry) => void
  requestGameUpdate: (entry: GameEntry) => void
  toggleFavoriteGame: (gameId: string) => void
  removeGame: (gameId: string) => void
  openPlaytimeHub: (gameId?: string) => void
}

function resolveCopyTarget(target: HTMLElement | null): { text: string; label: string } | null {
  const copyTarget = target?.closest('[data-context-copy]') as HTMLElement | null
  if (!copyTarget) {
    return null
  }

  const text = copyTarget.getAttribute('data-context-copy')?.trim()
    || copyTarget.textContent?.trim()
    || ''

  if (!text) {
    return null
  }

  const label = copyTarget.getAttribute('data-context-copy-label')?.trim() || 'Copy'
  return { text, label }
}

function resolveGameTileEntryId(target: HTMLElement | null): string | null {
  if (resolveCopyTarget(target)) {
    return null
  }

  const tile = target?.closest('[data-entry-id]') as HTMLElement | null
  if (!tile) {
    return null
  }

  if (!tile.closest('.game-grid-pane, .game-stack, .wii-scene')) {
    return null
  }

  const entryId = tile.getAttribute('data-entry-id')?.trim()
  return entryId || null
}

export function useGameTileContextMenu({
  enabled,
  library,
  gameMetaById,
  gameUpdateStatusById,
  onFocusGame,
  launchGame,
  requestGameUpdate,
  toggleFavoriteGame,
  removeGame,
  openPlaytimeHub,
}: UseGameTileContextMenuOptions) {
  const [menu, setMenu] = useState<GameTileContextMenuState | null>(null)
  const [copyMenu, setCopyMenu] = useState<CopyContextMenuState | null>(null)

  const closeMenu = useCallback(() => {
    setMenu(null)
  }, [])

  const closeCopyMenu = useCallback(() => {
    setCopyMenu(null)
  }, [])

  const closeAllMenus = useCallback(() => {
    setMenu(null)
    setCopyMenu(null)
  }, [])

  const openMenuFromEvent = useCallback((event: ReactMouseEvent, entryId: string) => {
    if (resolveCopyTarget(event.target as HTMLElement | null)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    closeCopyMenu()
    onFocusGame(entryId)
    setMenu({
      entryId,
      x: event.clientX,
      y: event.clientY,
    })
  }, [closeCopyMenu, onFocusGame])

  useEffect(() => {
    if (!enabled) {
      closeAllMenus()
      setLauncherContextMenuHandler(null)
      return
    }

    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const copyPayload = resolveCopyTarget(target)
      if (copyPayload) {
        event.stopImmediatePropagation()
        closeMenu()
        setCopyMenu({
          x: event.clientX,
          y: event.clientY,
          text: copyPayload.text,
          label: copyPayload.label,
        })
        return
      }

      const entryId = resolveGameTileEntryId(target)
      if (!entryId) {
        return
      }

      event.stopImmediatePropagation()
      closeCopyMenu()
      onFocusGame(entryId)
      setMenu({
        entryId,
        x: event.clientX,
        y: event.clientY,
      })
    }

    setLauncherContextMenuHandler(handleContextMenu)
    return () => {
      setLauncherContextMenuHandler(null)
    }
  }, [closeAllMenus, closeCopyMenu, closeMenu, enabled, onFocusGame])

  useEffect(() => {
    if (!menu && !copyMenu) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.game-tile-context-menu')) {
        return
      }

      closeAllMenus()
    }

    window.addEventListener('pointerdown', handlePointerDown, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    }
  }, [closeAllMenus, copyMenu, menu])

  const menuEntry = useMemo(() => {
    if (!menu) {
      return null
    }

    return library.find((entry) => entry.id === menu.entryId) ?? null
  }, [library, menu])

  const menuExplorerFolder = useMemo(() => {
    if (!menuEntry) {
      return null
    }

    return resolveGameExplorerFolder(menuEntry)
  }, [menuEntry])

  const handlePlay = useCallback(() => {
    if (!menuEntry) {
      return
    }

    const updateStatus = gameUpdateStatusById[menuEntry.id] ?? 'unknown'
    if (updateStatus === 'update_available' || updateStatus === 'downloading_or_staging') {
      void requestGameUpdate(menuEntry)
      return
    }

    void launchGame(menuEntry)
  }, [gameUpdateStatusById, launchGame, menuEntry, requestGameUpdate])

  const handleToggleFavorite = useCallback(() => {
    if (!menuEntry) {
      return
    }

    toggleFavoriteGame(menuEntry.id)
  }, [menuEntry, toggleFavoriteGame])

  const handleOpenPlaytime = useCallback(() => {
    if (!menuEntry) {
      return
    }

    openPlaytimeHub(menuEntry.id)
  }, [menuEntry, openPlaytimeHub])

  const handleOpenFolder = useCallback(() => {
    if (!menuExplorerFolder) {
      return
    }

    void openFolderInExplorer(menuExplorerFolder).catch(() => {
      // Explorer open failures are non-fatal for context menu usage.
    })
  }, [menuExplorerFolder])

  const handleRemove = useCallback(() => {
    if (!menuEntry) {
      return
    }

    removeGame(menuEntry.id)
  }, [menuEntry, removeGame])

  return {
    menu,
    copyMenu,
    menuEntry,
    menuExplorerFolder,
    openMenuFromEvent,
    closeMenu,
    closeCopyMenu,
    handlePlay,
    handleToggleFavorite,
    handleOpenPlaytime,
    handleOpenFolder,
    handleRemove,
    menuIsFavorite: menuEntry ? Boolean(gameMetaById[menuEntry.id]?.isFavorite) : false,
    menuUpdateStatus: menuEntry ? (gameUpdateStatusById[menuEntry.id] ?? 'unknown') : 'unknown',
  }
}