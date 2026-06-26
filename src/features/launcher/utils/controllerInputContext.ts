import type { AppTab } from '../types'

export type ControllerInputContext =
  | 'virtual_keyboard'
  | 'modal_dialog'
  | 'profile_rail'
  | 'quick_customize'
  | 'quick_settings'
  | 'functions_panel'
  | 'functions_toolbar'
  | 'quick_overlay'
  | 'game_actions'
  | 'launcher_main'
  | 'settings_tab'
  | 'appearance_tab'
  | 'profile_tab'

export type ResolveControllerInputContextOptions = {
  activeTab: AppTab
  isControllerVirtualKeyboardOpen: boolean
  isQuickOverlayOpen: boolean
  isQuickCustomizeOpen?: boolean
  isQuickSettingsOpen?: boolean
  isGameActionLayerEngaged?: boolean
}

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

function isQuickCustomizePanelOpen(): boolean {
  const panel = document.getElementById('sidebar-quick-customize')
  return Boolean(panel && panel.classList.contains('is-open') && isElementVisible(panel))
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

function isProfileRailOpen(): boolean {
  const rail = document.getElementById('sidebar-profile-action-rail')
  return Boolean(rail && rail.classList.contains('is-open') && isElementVisible(rail))
}

function isFunctionsPanelOpen(): boolean {
  const panel = document.querySelector<HTMLElement>('.launcher-functions-panel.is-open')
  return Boolean(panel && isElementVisible(panel))
}

function isGameActionMenuFocused(): boolean {
  return Boolean((document.activeElement as HTMLElement | null)?.closest('.game-details-pane .game-action-btn'))
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

function isFocusInQuickCustomize(): boolean {
  const panel = document.getElementById('sidebar-quick-customize')
  const activeElement = document.activeElement as HTMLElement | null
  return Boolean(panel && activeElement && panel.contains(activeElement))
}

function isFocusInQuickSettings(): boolean {
  for (const panelId of ['sidebar-quick-settings', 'titlebar-quick-settings']) {
    const panel = document.getElementById(panelId)
    const activeElement = document.activeElement as HTMLElement | null
    if (panel && activeElement && panel.contains(activeElement)) {
      return true
    }
  }

  return false
}

function isFocusInFunctionsBar(): boolean {
  const shell = document.querySelector<HTMLElement>('.launcher-functions-shell')
  const activeElement = document.activeElement as HTMLElement | null
  return Boolean(shell && activeElement && shell.contains(activeElement))
}

function resolveActiveTabContext(activeTab: AppTab): ControllerInputContext | null {
  switch (activeTab) {
    case 'settings':
      return 'settings_tab'
    case 'appearance':
      return 'appearance_tab'
    case 'profile':
      return 'profile_tab'
    default:
      return null
  }
}

export function resolveControllerInputContext(
  options: ResolveControllerInputContextOptions,
): ControllerInputContext {
  if (options.isControllerVirtualKeyboardOpen) {
    return 'virtual_keyboard'
  }

  if (findTopModalDialog()) {
    return 'modal_dialog'
  }

  if (isQuickCustomizePanelOpen() && (options.isQuickCustomizeOpen || isFocusInQuickCustomize())) {
    return 'quick_customize'
  }

  if (isQuickSettingsPanelOpen() && (options.isQuickSettingsOpen || isFocusInQuickSettings())) {
    return 'quick_settings'
  }

  if (isProfileRailOpen()) {
    return 'profile_rail'
  }

  const activeTabContext = resolveActiveTabContext(options.activeTab)
  if (activeTabContext) {
    return activeTabContext
  }

  if (isFunctionsPanelOpen()) {
    return 'functions_panel'
  }

  if (isFocusInFunctionsBar()) {
    return 'functions_toolbar'
  }

  if (options.isQuickOverlayOpen) {
    return 'quick_overlay'
  }

  if (options.isGameActionLayerEngaged || isGameActionMenuFocused()) {
    return 'game_actions'
  }

  return 'launcher_main'
}
