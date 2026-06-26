import type { AppTab, LauncherControllerAction } from '../types'
import {
  activateFocusedElement,
  adjustFocusedRangeInput,
  collectNativeFocusable,
  cycleFocusedSelect,
  focusFirst,
  focusLast,
  isRangeInputElement,
  isSelectElement,
  isTextInputElement,
  moveFocusSpatial,
} from '../utils/controllerFocus'
import type { ControllerInputContext } from '../utils/controllerInputContext'
import { handleControllerBack } from '../utils/controllerBackStack'

export const CONTROLLER_V1_LAUNCHER_ONLY = false

export type ControllerInputHandlerDeps = {
  activeTab: AppTab
  isControllerVirtualKeyboardOpen: boolean
  isGameActionLayerEngaged: boolean
  clearGameActionLayerEngaged: () => void
  closeQuickOverlay: () => void
  isQuickOverlayOpen: boolean
  isSearchFocused: boolean
  isQuickCustomizeOpen: boolean
  isQuickSettingsOpen: boolean
  moveControllerVirtualKeyboardCursor: (rowDelta: -1 | 0 | 1, columnDelta: -1 | 0 | 1) => void
  activateControllerVirtualKeyboardKey: () => void
  closeControllerVirtualKeyboard: (commitChanges: boolean) => void
  openControllerVirtualKeyboard: (target: HTMLInputElement | HTMLTextAreaElement) => void
  setQuickOverlaySelectionIndex: (updater: (previous: number) => number) => void
  quickOverlayActionsLength: number
  quickOverlayActions: Array<{ id: string }>
  executeQuickOverlayAction: (actionId: string) => void
  quickOverlaySelectionIndex: number
  moveFocusedGameAction: (direction: 'up' | 'down' | 'left' | 'right') => boolean
  launcherView: 'systems' | 'games'
  isGridView: boolean
  isSystemsGridView: boolean
  moveFocusedSystemInGrid: (columnDelta: -1 | 0 | 1, rowDelta: -1 | 0 | 1) => boolean
  stepSystem: (direction: -1 | 1) => void
  moveFocusedGameInGrid: (columnDelta: -1 | 0 | 1, rowDelta: -1 | 0 | 1) => boolean
  pushGameStackMomentum: (delta: number) => void
  enterSystem: (categoryKey: string) => void
  activeCategory: string
  confirmFocusedGameAction: () => boolean
  focusPrimaryGameAction: () => boolean
  focusCurrentGameTile: () => boolean
  backToSystems: () => void
  switchTab: (tab: AppTab) => void
  toggleSystemsViewMode: () => void
  toggleGamesViewMode: () => void
  jumpToTopGame: () => void
  jumpToBottomGame: () => void
  setActiveCategory: (categoryKey: string) => void
  systemsGridTiles: Array<{ category: { key: string } }>
  sortedSystemsSceneCategories: Array<{ key: string }>
  toggleProfileRail: () => void
  openFunctionsFindPanel: () => void
  openFunctionsLibraryPanel: () => void
  openFunctionsSearch: () => void
  focusLauncherFunctionsToolbar: () => boolean
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return !target.disabled
  }

  return false
}

function dispatchProfileRailCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:profile-rail-command', { detail: { command } }))
}

function dispatchQuickCustomizeCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:quick-customize-command', { detail: { command } }))
}

function dispatchQuickSettingsCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:quick-settings-command', { detail: { command } }))
}

function dispatchFunctionsBarCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:functions-bar-command', { detail: { command } }))
}

function dispatchModalDialogCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('tilezu:modal-dialog-command', { detail: { command } }))
}

function handleDirectionalNavigation(
  context: ControllerInputContext,
  action: LauncherControllerAction,
  deps: ControllerInputHandlerDeps,
): boolean {
  const direction = action === 'navigate_up'
    ? 'up'
    : action === 'navigate_down'
      ? 'down'
      : action === 'navigate_left'
        ? 'left'
        : action === 'navigate_right'
          ? 'right'
          : null

  if (!direction) {
    return false
  }

  switch (context) {
    case 'profile_rail':
      if (direction === 'left') {
        if (deps.isQuickSettingsOpen) {
          dispatchProfileRailCommand('focus-quick-settings')
        } else {
          dispatchProfileRailCommand('focus-quick-customize')
        }
      } else if (direction === 'right') {
        dispatchProfileRailCommand('focus-rail')
      } else {
        dispatchProfileRailCommand(direction === 'up' ? 'up' : 'down')
      }
      return true
    case 'quick_customize':
      dispatchQuickCustomizeCommand(direction)
      return true
    case 'quick_settings':
      dispatchQuickSettingsCommand(direction)
      return true
    case 'functions_panel':
    case 'functions_toolbar':
      dispatchFunctionsBarCommand(direction)
      return true
    case 'modal_dialog':
      dispatchModalDialogCommand(direction)
      return true
    case 'settings_tab':
    case 'appearance_tab':
    case 'profile_tab':
      if (CONTROLLER_V1_LAUNCHER_ONLY) {
        return false
      }
      return handleAppTabDirectionalNavigation(context, direction, deps)
    case 'game_actions':
      return deps.moveFocusedGameAction(direction)
    default:
      return false
  }
}

function getAppTabRoot(context: ControllerInputContext): HTMLElement | null {
  switch (context) {
    case 'settings_tab':
      return document.querySelector<HTMLElement>('[data-controller-tab="settings"]')
    case 'appearance_tab':
      return document.querySelector<HTMLElement>('[data-controller-tab="appearance"]')
    case 'profile_tab':
      return document.querySelector<HTMLElement>('[data-controller-tab="profile"]')
    default:
      return null
  }
}

function handleAppTabDirectionalNavigation(
  context: ControllerInputContext,
  direction: 'up' | 'down' | 'left' | 'right',
  _deps: ControllerInputHandlerDeps,
): boolean {
  const root = getAppTabRoot(context)
  if (!root) {
    return false
  }

  const activeElement = document.activeElement as HTMLElement | null
  if (activeElement && root.contains(activeElement)) {
    if (direction === 'left' || direction === 'right') {
      if (isRangeInputElement(activeElement)) {
        return adjustFocusedRangeInput(direction)
      }

      if (isSelectElement(activeElement)) {
        return cycleFocusedSelect(direction === 'left' ? 'prev' : 'next')
      }
    }
  }

  const focusables = collectNativeFocusable(root)
  return moveFocusSpatial(direction, focusables)
}

function handleAppTabConfirm(context: ControllerInputContext, deps: ControllerInputHandlerDeps): boolean {
  const root = getAppTabRoot(context)
  if (!root) {
    return false
  }

  const activeElement = document.activeElement as HTMLElement | null
  if (isTextInputElement(activeElement)) {
    deps.openControllerVirtualKeyboard(activeElement)
    return true
  }

  if (activeElement && root.contains(activeElement)) {
    return activateFocusedElement()
  }

  const focusables = collectNativeFocusable(root)
  if (focusables.length === 0) {
    return false
  }

  focusFirst(focusables)
  const focused = document.activeElement as HTMLElement | null
  if (isTextInputElement(focused)) {
    deps.openControllerVirtualKeyboard(focused)
    return true
  }

  return activateFocusedElement()
}

function handleAppTabJump(context: ControllerInputContext, toTop: boolean): boolean {
  const root = getAppTabRoot(context)
  if (!root) {
    return false
  }

  const focusables = collectNativeFocusable(root)
  return toTop ? focusFirst(focusables) : focusLast(focusables)
}

function handleAppTabSectionJump(context: ControllerInputContext, direction: -1 | 1): boolean {
  const root = getAppTabRoot(context)
  if (!root) {
    return false
  }

  const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-controller-section]'))
  if (sections.length === 0) {
    return false
  }

  const activeElement = document.activeElement as HTMLElement | null
  const currentIndex = activeElement
    ? sections.findIndex((section) => section.contains(activeElement))
    : -1
  const startIndex = currentIndex >= 0 ? currentIndex : (direction > 0 ? 0 : sections.length - 1)
  const nextIndex = Math.max(0, Math.min(sections.length - 1, startIndex + direction))
  const nextSection = sections[nextIndex]
  if (!nextSection) {
    return false
  }

  const focusables = collectNativeFocusable(nextSection)
  return focusFirst(focusables)
}

function handleLauncherMainAction(action: LauncherControllerAction, deps: ControllerInputHandlerDeps): boolean {
  if (deps.isSearchFocused || isEditableElement(document.activeElement)) {
    return false
  }

  switch (action) {
    case 'navigate_up':
      if (deps.launcherView === 'systems') {
        if (deps.isSystemsGridView) {
          deps.moveFocusedSystemInGrid(0, -1)
        } else {
          deps.stepSystem(-1)
        }
      } else if (deps.isGridView) {
        deps.moveFocusedGameInGrid(0, -1)
      } else {
        deps.pushGameStackMomentum(-72)
      }
      return true
    case 'navigate_down':
      if (deps.launcherView === 'systems') {
        if (deps.isSystemsGridView) {
          deps.moveFocusedSystemInGrid(0, 1)
        } else {
          deps.stepSystem(1)
        }
      } else if (deps.isGridView) {
        deps.moveFocusedGameInGrid(0, 1)
      } else {
        deps.pushGameStackMomentum(72)
      }
      return true
    case 'navigate_left': {
      let moved = false
      if (deps.launcherView === 'systems') {
        if (deps.isSystemsGridView) {
          moved = deps.moveFocusedSystemInGrid(-1, 0)
        }
      } else if (deps.isGridView) {
        moved = deps.moveFocusedGameInGrid(-1, 0)
      }

      if (!moved) {
        return deps.focusLauncherFunctionsToolbar()
      }
      return true
    }
    case 'navigate_right':
      if (deps.launcherView === 'systems') {
        if (deps.isSystemsGridView) {
          deps.moveFocusedSystemInGrid(1, 0)
        } else {
          deps.stepSystem(1)
        }
      } else if (deps.isGridView) {
        deps.moveFocusedGameInGrid(1, 0)
      } else {
        deps.pushGameStackMomentum(72)
      }
      return true
    case 'confirm':
      if (deps.launcherView === 'systems') {
        deps.enterSystem(deps.activeCategory)
        return true
      }

      if (deps.launcherView === 'games') {
        if (deps.confirmFocusedGameAction()) {
          return true
        }

        deps.focusPrimaryGameAction()
      }
      return true
    case 'open_settings':
      return false
    case 'toggle_view':
      if (deps.launcherView === 'systems') {
        deps.toggleSystemsViewMode()
      } else {
        deps.toggleGamesViewMode()
      }
      return true
    case 'jump_top':
      if (deps.launcherView === 'systems') {
        const firstCategory = deps.isSystemsGridView
          ? deps.systemsGridTiles[0]?.category
          : deps.sortedSystemsSceneCategories[0]
        if (firstCategory) {
          deps.setActiveCategory(firstCategory.key)
        }
      } else {
        deps.jumpToTopGame()
      }
      return true
    case 'jump_bottom':
      if (deps.launcherView === 'systems') {
        const lastCategory = deps.isSystemsGridView
          ? deps.systemsGridTiles[deps.systemsGridTiles.length - 1]?.category
          : deps.sortedSystemsSceneCategories[deps.sortedSystemsSceneCategories.length - 1]
        if (lastCategory) {
          deps.setActiveCategory(lastCategory.key)
        }
      } else {
        deps.jumpToBottomGame()
      }
      return true
    default:
      return false
  }
}

export function handleControllerActionForContext(
  context: ControllerInputContext,
  action: LauncherControllerAction,
  deps: ControllerInputHandlerDeps,
): boolean {
  if (action === 'back') {
    return handleControllerBack({
      activeTab: deps.activeTab,
      isControllerVirtualKeyboardOpen: deps.isControllerVirtualKeyboardOpen,
      closeControllerVirtualKeyboard: deps.closeControllerVirtualKeyboard,
      isQuickOverlayOpen: deps.isQuickOverlayOpen,
      closeQuickOverlay: deps.closeQuickOverlay,
      isGameActionLayerEngaged: deps.isGameActionLayerEngaged,
      focusCurrentGameTile: deps.focusCurrentGameTile,
      clearGameActionLayerEngaged: deps.clearGameActionLayerEngaged,
      launcherView: deps.launcherView,
      backToSystems: deps.backToSystems,
      switchTab: deps.switchTab,
    })
  }

  if (action.startsWith('navigate_')) {
    if (handleDirectionalNavigation(context, action, deps)) {
      return true
    }
  }

  switch (context) {
    case 'virtual_keyboard':
      switch (action) {
        case 'navigate_up':
          deps.moveControllerVirtualKeyboardCursor(-1, 0)
          return true
        case 'navigate_down':
          deps.moveControllerVirtualKeyboardCursor(1, 0)
          return true
        case 'navigate_left':
          deps.moveControllerVirtualKeyboardCursor(0, -1)
          return true
        case 'navigate_right':
          deps.moveControllerVirtualKeyboardCursor(0, 1)
          return true
        case 'confirm':
          deps.activateControllerVirtualKeyboardKey()
          return true
        case 'open_settings':
          deps.closeControllerVirtualKeyboard(true)
          return true
        default:
          return false
      }

    case 'profile_rail':
      switch (action) {
        case 'confirm':
          dispatchProfileRailCommand('confirm')
          return true
        case 'navigate_left':
          if (deps.isQuickSettingsOpen) {
            dispatchProfileRailCommand('focus-quick-settings')
          } else {
            dispatchProfileRailCommand('focus-quick-customize')
          }
          return true
        case 'navigate_right':
          dispatchProfileRailCommand('focus-rail')
          return true
        default:
          return handleDirectionalNavigation(context, action, deps)
      }

    case 'quick_customize':
      switch (action) {
        case 'confirm':
          dispatchQuickCustomizeCommand('confirm')
          return true
        case 'navigate_left':
          dispatchQuickCustomizeCommand('left')
          return true
        case 'navigate_right':
          dispatchQuickCustomizeCommand('right')
          return true
        default:
          return handleDirectionalNavigation(context, action, deps)
      }

    case 'quick_settings':
      switch (action) {
        case 'confirm':
          dispatchQuickSettingsCommand('confirm')
          return true
        case 'navigate_left':
          dispatchQuickSettingsCommand('left')
          return true
        case 'navigate_right':
          dispatchQuickSettingsCommand('right')
          return true
        default:
          return handleDirectionalNavigation(context, action, deps)
      }

    case 'functions_panel':
    case 'functions_toolbar':
      switch (action) {
        case 'open_find_panel':
        case 'open_functions_menu':
          deps.openFunctionsFindPanel()
          return true
        case 'open_library_panel':
          deps.openFunctionsLibraryPanel()
          return true
        case 'open_search':
          deps.openFunctionsSearch()
          return true
        case 'confirm':
          dispatchFunctionsBarCommand('confirm')
          return true
        default:
          return handleDirectionalNavigation(context, action, deps)
      }

    case 'quick_overlay':
      switch (action) {
        case 'navigate_up':
        case 'navigate_left':
          deps.setQuickOverlaySelectionIndex((previous) => Math.max(0, previous - 1))
          return true
        case 'navigate_down':
        case 'navigate_right':
          deps.setQuickOverlaySelectionIndex((previous) => Math.min(deps.quickOverlayActionsLength - 1, previous + 1))
          return true
        case 'confirm': {
          const targetAction = deps.quickOverlayActions[deps.quickOverlaySelectionIndex] ?? deps.quickOverlayActions[0]
          if (targetAction) {
            deps.executeQuickOverlayAction(targetAction.id)
          }
          return true
        }
        case 'open_settings':
          deps.executeQuickOverlayAction('open-settings')
          return true
        case 'toggle_view':
          deps.executeQuickOverlayAction('close-overlay')
          return true
        case 'jump_top':
          deps.setQuickOverlaySelectionIndex(() => 0)
          return true
        case 'jump_bottom':
          deps.setQuickOverlaySelectionIndex(() => Math.max(0, deps.quickOverlayActionsLength - 1))
          return true
        default:
          return false
      }

    case 'modal_dialog':
      switch (action) {
        case 'confirm':
          dispatchModalDialogCommand('confirm')
          return true
        default:
          return handleDirectionalNavigation(context, action, deps)
      }

    case 'settings_tab':
    case 'appearance_tab':
    case 'profile_tab':
      if (CONTROLLER_V1_LAUNCHER_ONLY) {
        return false
      }
      switch (action) {
        case 'confirm':
          return handleAppTabConfirm(context, deps)
        case 'open_settings':
          if (context !== 'settings_tab') {
            deps.switchTab('settings')
          }
          return true
        case 'jump_top':
          return handleAppTabJump(context, true)
        case 'jump_bottom':
          return handleAppTabJump(context, false)
        case 'tab_prev':
          return handleAppTabSectionJump(context, -1)
        case 'tab_next':
          return handleAppTabSectionJump(context, 1)
        default:
          return handleDirectionalNavigation(context, action, deps)
      }

    case 'game_actions':
      if (action.startsWith('navigate_')) {
        return handleDirectionalNavigation(context, action, deps)
      }

      switch (action) {
        case 'confirm':
          return deps.confirmFocusedGameAction()
        default:
          return false
      }

    case 'launcher_main':
      switch (action) {
        case 'open_profile_rail':
          deps.toggleProfileRail()
          return true
        case 'open_find_panel':
        case 'open_functions_menu':
          deps.openFunctionsFindPanel()
          return true
        case 'open_library_panel':
          deps.openFunctionsLibraryPanel()
          return true
        case 'open_search':
          deps.openFunctionsSearch()
          return true
        case 'open_settings':
          return false
        default:
          return handleLauncherMainAction(action, deps)
      }

    default:
      return false
  }
}

export function getControllerPromptContextLabel(context: ControllerInputContext): string {
  switch (context) {
    case 'virtual_keyboard':
      return 'Keyboard'
    case 'modal_dialog':
      return 'Dialog'
    case 'profile_rail':
      return 'Profile'
    case 'quick_customize':
      return 'Customize'
    case 'quick_settings':
      return 'Settings'
    case 'functions_panel':
      return 'Functions'
    case 'functions_toolbar':
      return 'Toolbar'
    case 'quick_overlay':
      return 'Overlay'
    case 'game_actions':
      return 'Actions'
    case 'settings_tab':
      return 'Settings'
    case 'appearance_tab':
      return 'Appearance'
    case 'profile_tab':
      return 'Profile Tab'
    default:
      return 'Launcher'
  }
}
