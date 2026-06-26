import type { AppTab } from '../types'

const MANAGED_DIALOG_SELECTORS = [
  '#sidebar-profile-action-rail',
  '#sidebar-quick-customize',
  '#sidebar-quick-settings',
  '#titlebar-quick-settings',
  '.launcher-functions-panel.is-open',
  '.launcher-quick-overlay',
  '.launcher-controller-keyboard',
].join(', ')

export type ControllerBackStackDeps = {
  activeTab: AppTab
  isControllerVirtualKeyboardOpen: boolean
  closeControllerVirtualKeyboard: (commitChanges: boolean) => void
  isQuickOverlayOpen: boolean
  closeQuickOverlay: () => void
  isGameActionLayerEngaged: boolean
  focusCurrentGameTile: () => boolean
  clearGameActionLayerEngaged: () => void
  launcherView: 'systems' | 'games'
  backToSystems: () => void
  switchTab: (tab: AppTab) => void
}

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

function isQuickCustomizePanelOpen(): boolean {
  const panel = document.getElementById('sidebar-quick-customize')
  return Boolean(panel && panel.classList.contains('is-open') && isElementVisible(panel))
}

function isProfileRailOpen(): boolean {
  const rail = document.getElementById('sidebar-profile-action-rail')
  return Boolean(rail && rail.classList.contains('is-open') && isElementVisible(rail))
}

function isFunctionsPanelOpen(): boolean {
  const panel = document.querySelector<HTMLElement>('.launcher-functions-panel.is-open')
  return Boolean(panel && isElementVisible(panel))
}

function isFocusInFunctionsBar(): boolean {
  const shell = document.querySelector<HTMLElement>('.launcher-functions-shell')
  const activeElement = document.activeElement as HTMLElement | null
  return Boolean(shell && activeElement && shell.contains(activeElement))
}

function dispatchModalDialogCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:modal-dialog-command', { detail: { command } }))
}

function isQuickSettingsPanelOpen(): boolean {
  for (const panelId of ['sidebar-quick-settings', 'titlebar-quick-settings']) {
    const panel = document.getElementById(panelId)
    if (panel && panel.classList.contains('is-open') && isElementVisible(panel)) {
      return true
    }
  }

  return false
}

function dispatchQuickSettingsCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:quick-settings-command', { detail: { command } }))
}

function dispatchQuickCustomizeCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:quick-customize-command', { detail: { command } }))
}

function dispatchProfileRailCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:profile-rail-command', { detail: { command } }))
}

function dispatchFunctionsBarCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:functions-bar-command', { detail: { command } }))
}

function blurFunctionsShellFocus(): void {
  const shell = document.querySelector<HTMLElement>('.launcher-functions-shell')
  const activeElement = document.activeElement as HTMLElement | null
  if (shell && activeElement && shell.contains(activeElement)) {
    activeElement.blur()
  }
}

export function handleControllerBack(deps: ControllerBackStackDeps): boolean {
  if (deps.isControllerVirtualKeyboardOpen) {
    deps.closeControllerVirtualKeyboard(true)
    return true
  }

  if (findTopModalDialog()) {
    dispatchModalDialogCommand('back')
    return true
  }

  if (deps.isQuickOverlayOpen) {
    deps.closeQuickOverlay()
    return true
  }

  if (isQuickCustomizePanelOpen()) {
    dispatchQuickCustomizeCommand('back')
    return true
  }

  if (isQuickSettingsPanelOpen()) {
    dispatchQuickSettingsCommand('back')
    return true
  }

  if (isProfileRailOpen()) {
    dispatchProfileRailCommand('back')
    return true
  }

  if (isFunctionsPanelOpen()) {
    dispatchFunctionsBarCommand('back')
    return true
  }

  if (deps.isGameActionLayerEngaged) {
    if (deps.focusCurrentGameTile()) {
      deps.clearGameActionLayerEngaged()
    }
    return true
  }

  if (isFocusInFunctionsBar()) {
    blurFunctionsShellFocus()
    return true
  }

  if (deps.activeTab !== 'launcher') {
    deps.switchTab('launcher')
    return true
  }

  if (deps.launcherView === 'games') {
    deps.backToSystems()
    return true
  }

  return false
}
