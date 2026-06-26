import { useMemo, type FC } from 'react'

import { LauncherContextMenu, type LauncherContextMenuItem } from './LauncherContextMenu'

export type CopyContextMenuState = {
  x: number
  y: number
  text: string
  label: string
}

type CopyContextMenuProps = {
  menu: CopyContextMenuState
  onClose: () => void
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export const CopyContextMenu: FC<CopyContextMenuProps> = ({ menu, onClose }) => {
  const items = useMemo<LauncherContextMenuItem[]>(() => [
    {
      id: 'copy',
      label: menu.label,
      onSelect: () => {
        void copyTextToClipboard(menu.text)
      },
    },
  ], [menu.label, menu.text])

  return (
    <LauncherContextMenu
      position={{ x: menu.x, y: menu.y }}
      items={items}
      onClose={onClose}
      ariaLabel={menu.label}
    />
  )
}