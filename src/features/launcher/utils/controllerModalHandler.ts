import {
  activateFocusedElement,
  collectNativeFocusable,
  focusFirst,
  moveFocusSpatial,
} from './controllerFocus'

const MANAGED_DIALOG_SELECTORS = [
  '#sidebar-profile-action-rail',
  '#sidebar-quick-customize',
  '#sidebar-quick-settings',
  '#titlebar-quick-settings',
  '.launcher-functions-panel.is-open',
  '.launcher-quick-overlay',
  '.launcher-controller-keyboard',
].join(', ')

function isElementVisible(element: HTMLElement): boolean {
  if (element.getAttribute('aria-hidden') === 'true') {
    return false
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function findTopModalDialog(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
    .filter((dialog) => isElementVisible(dialog))
    .filter((dialog) => !dialog.matches(MANAGED_DIALOG_SELECTORS))
    .filter((dialog) => !dialog.closest(MANAGED_DIALOG_SELECTORS))

  if (dialogs.length === 0) {
    return null
  }

  return dialogs[dialogs.length - 1] ?? null
}

function closeModalDialog(dialog: HTMLElement): boolean {
  const closeButton = dialog.querySelector<HTMLElement>(
    'button[aria-label*="Close" i], button[aria-label*="close" i], [data-controller-close]',
  )

  if (closeButton) {
    closeButton.click()
    return true
  }

  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  return true
}

function handleModalDialogCommand(command: string): void {
  const dialog = findTopModalDialog()
  if (!dialog) {
    return
  }

  const focusables = collectNativeFocusable(dialog)

  switch (command) {
    case 'up':
      moveFocusSpatial('up', focusables)
      return
    case 'down':
      moveFocusSpatial('down', focusables)
      return
    case 'left':
      moveFocusSpatial('left', focusables)
      return
    case 'right':
      moveFocusSpatial('right', focusables)
      return
    case 'confirm': {
      const activeElement = document.activeElement as HTMLElement | null
      if (activeElement && dialog.contains(activeElement)) {
        activateFocusedElement()
        return
      }

      focusFirst(focusables)
      const focused = document.activeElement as HTMLElement | null
      if (focused && dialog.contains(focused)) {
        activateFocusedElement()
      }
      return
    }
    case 'back':
      closeModalDialog(dialog)
      return
    default:
      return
  }
}

export function setupModalDialogControllerNavigation(): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ command?: string }>).detail
    const command = detail?.command
    if (!command) {
      return
    }

    handleModalDialogCommand(command)
  }

  window.addEventListener('tilezu:modal-dialog-command', handler)
  return () => {
    window.removeEventListener('tilezu:modal-dialog-command', handler)
  }
}
