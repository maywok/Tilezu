type LauncherContextMenuHandler = (event: MouseEvent) => void

let activeHandler: LauncherContextMenuHandler | null = null
let guardInstalled = false

function shouldAllowNativeContextMenu(target: HTMLElement | null): boolean {
  return Boolean(
    target?.closest('[data-allow-native-context-menu="true"]')
    || target?.closest('input, textarea, select, [contenteditable="true"]'),
  )
}

export function setLauncherContextMenuHandler(handler: LauncherContextMenuHandler | null): void {
  activeHandler = handler
}

export function initLauncherContextMenuGuard(): void {
  if (typeof document === 'undefined' || guardInstalled) {
    return
  }

  guardInstalled = true

  document.addEventListener('contextmenu', (event) => {
    const target = event.target as HTMLElement | null
    if (shouldAllowNativeContextMenu(target)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    activeHandler?.(event)
  }, { capture: true })

  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()
    if (key === 'f12') {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, { capture: true })
}