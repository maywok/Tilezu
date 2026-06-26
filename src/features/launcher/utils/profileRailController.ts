import { focusElement } from './controllerFocus'

export type ProfileRailCommand =
  | 'up'
  | 'down'
  | 'confirm'
  | 'back'
  | 'focus-quick-customize'
  | 'focus-quick-settings'
  | 'focus-rail'

export type ProfileRailCommandHandlers = {
  getRailRoot: () => HTMLElement | null
  onBack: () => void
  onFocusQuickCustomize?: () => void
  onFocusQuickSettings?: () => void
  playHoverSound?: () => void
}

export function getProfileRailButtons(root: HTMLElement | null): HTMLButtonElement[] {
  if (!root) {
    return []
  }

  return Array.from(root.querySelectorAll<HTMLButtonElement>('.profile-action-list .profile-rail-item'))
    .filter((button) => !button.disabled)
}

export function focusProfileRailButton(root: HTMLElement | null, index: number): boolean {
  const buttons = getProfileRailButtons(root)
  const target = buttons[index]
  if (!target) {
    return false
  }

  return focusElement(target, false)
}

export function handleProfileRailCommand(
  command: ProfileRailCommand | string | undefined,
  handlers: ProfileRailCommandHandlers,
): void {
  const root = handlers.getRailRoot()
  const buttons = getProfileRailButtons(root)
  if (buttons.length === 0) {
    return
  }

  const activeElement = document.activeElement as HTMLElement | null
  const currentIndex = activeElement
    ? buttons.findIndex((button) => button === activeElement || button.contains(activeElement))
    : -1

  const focusAt = (index: number) => {
    if (focusProfileRailButton(root, index)) {
      handlers.playHoverSound?.()
    }
  }

  switch (command) {
    case 'up': {
      const nextIndex = currentIndex < 0 ? 0 : Math.max(0, currentIndex - 1)
      focusAt(nextIndex)
      return
    }
    case 'down': {
      const nextIndex = currentIndex < 0 ? 0 : Math.min(buttons.length - 1, currentIndex + 1)
      focusAt(nextIndex)
      return
    }
    case 'confirm': {
      const target = currentIndex >= 0 ? buttons[currentIndex] : buttons[0]
      target?.click()
      return
    }
    case 'back':
      handlers.onBack()
      return
    case 'focus-quick-customize':
      handlers.onFocusQuickCustomize?.()
      return
    case 'focus-quick-settings':
      handlers.onFocusQuickSettings?.()
      return
    case 'focus-rail':
      focusAt(currentIndex >= 0 ? currentIndex : 0)
      return
    default:
      return
  }
}