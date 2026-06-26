import { useEffect, useLayoutEffect, useRef, useState, type FC, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'

export type LauncherContextMenuItem = {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
  danger?: boolean
  dividerBefore?: boolean
}

type LauncherContextMenuProps = {
  position: { x: number; y: number }
  title?: string
  items: LauncherContextMenuItem[]
  onClose: () => void
  ariaLabel: string
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const pad = 10
  const maxX = Math.max(pad, window.innerWidth - width - pad)
  const maxY = Math.max(pad, window.innerHeight - height - pad)
  return {
    x: Math.min(Math.max(pad, x), maxX),
    y: Math.min(Math.max(pad, y), maxY),
  }
}

export const LauncherContextMenu: FC<LauncherContextMenuProps> = ({
  position,
  title,
  items,
  onClose,
  ariaLabel,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [resolvedPosition, setResolvedPosition] = useState(position)

  useLayoutEffect(() => {
    const node = menuRef.current
    if (!node) {
      return
    }

    const rect = node.getBoundingClientRect()
    setResolvedPosition(clampMenuPosition(position.x, position.y, rect.width, rect.height))
  }, [position.x, position.y, items.length, title])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleBackdropPointerDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleItemClick = (item: LauncherContextMenuItem) => {
    if (item.disabled) {
      return
    }

    item.onSelect()
    onClose()
  }

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className="game-tile-context-menu-backdrop"
      data-no-window-drag="true"
      onPointerDown={handleBackdropPointerDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={menuRef}
        className="game-tile-context-menu"
        style={{ left: `${resolvedPosition.x}px`, top: `${resolvedPosition.y}px` }}
        role="menu"
        aria-label={ariaLabel}
        onContextMenu={(event) => event.preventDefault()}
      >
        {title ? (
          <p
            className="game-tile-context-menu-title"
            data-context-copy={title}
            data-context-copy-label="Copy game name"
          >
            {title}
          </p>
        ) : null}
        {items.map((item) => (
          <div key={item.id}>
            {item.dividerBefore ? <div className="game-tile-context-menu-divider" aria-hidden="true" /> : null}
            <button
              type="button"
              role="menuitem"
              className={
                item.danger
                  ? 'game-tile-context-menu-item is-danger'
                  : item.disabled
                    ? 'game-tile-context-menu-item is-disabled'
                    : 'game-tile-context-menu-item'
              }
              disabled={item.disabled}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}