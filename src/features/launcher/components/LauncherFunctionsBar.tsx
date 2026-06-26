import { useEffect, useMemo, useRef, useState, type FC, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  activateFocusedElement,
  collectFocusable,
  focusElement,
  focusFirst,
  moveFocusSpatial,
} from '../utils/controllerFocus'
import { SearchBar } from './SearchBar'
import type {
  CategoryMeta,
  GridGroupMode,
  GridSizeMode,
  GridSortMode,
  LauncherCategory,
  SystemsGridSizeMode,
  SystemsGridSortMode,
  SystemsViewMode,
} from '../types'

type FunctionsPanelKey = 'find' | 'view' | 'library'
type FunctionsIcon = string | 'library-controller'

type GridSortOption = {
  mode: GridSortMode
  label: string
  icon: string
  disabled?: boolean
}

type LetterJumpTarget = {
  letter: string
  index: number
}

type LauncherFunctionsBarProps = {
  isSystemsView?: boolean
  systemsViewMode?: SystemsViewMode
  systemsGridSortMode?: SystemsGridSortMode
  systemsGridSizeMode?: SystemsGridSizeMode
  systemsSearch: string
  systemsHasSearchQuery: boolean
  systemsSearchResultCount: number
  systemsSearchMatches: CategoryMeta[]
  isGridView: boolean
  isImporting: boolean
  search: string
  hasSearchQuery: boolean
  searchResultCount: number
  isSearchFocused: boolean
  focusedGameIndex: number
  scrollVisibleGamesLength: number
  systemCategories: CategoryMeta[]
  activeCategory: LauncherCategory
  gridSortOptions: GridSortOption[]
  gridSortMode: GridSortMode
  gridGroupMode: GridGroupMode
  gridSizeMode: GridSizeMode
  hasVisibleFavoriteGame: boolean
  letterJumpTargets: LetterJumpTarget[]
  activeSystemLabel: string
  onSearchChange: (value: string) => void
  onSystemsSearchChange: (value: string) => void
  onSearchFocusChange: (isFocused: boolean) => void
  onBackToSystems: () => void
  onStopGameStackMomentum: () => void
  onStepFocusedGame: (direction: -1 | 1) => void
  onFocusGameByIndex: (index: number) => void
  onJumpToTopGame: () => void
  onJumpToBottomGame: () => void
  onJumpToFavoriteGame: () => void
  onJumpToLetter: (letter: string) => void
  onOpenAddGames?: (initialTab?: 'apps-games' | 'roms' | 'systems') => void
  onSelectCategory: (categoryKey: LauncherCategory) => void
  onSetGridSortMode: (mode: GridSortMode) => void
  onSetGridGroupMode: (mode: GridGroupMode) => void
  onSetGridSizeMode: (mode: GridSizeMode) => void
  onToggleSystemsViewMode?: () => void
  onSetSystemsGridSortMode?: (mode: SystemsGridSortMode) => void
  onSetSystemsGridSizeMode?: (mode: SystemsGridSizeMode) => void
  onToggleViewMode: () => void
  onAutoImport: () => void
  onOpenManageSystems: () => void
  onOpenCreateSystem?: () => void
  onPlayUiHoverSound?: () => void
  onPlayUiSelectSound?: () => void
  showGamepadPrompts?: boolean
  gamepadPromptByControl?: Partial<Record<'toggle-view' | 'back-to-systems' | FunctionsPanelKey, string>>
}

const PANEL_ORDER: FunctionsPanelKey[] = ['find', 'view', 'library']

function getGamepadPanelOrder(_isSystemsView: boolean): FunctionsPanelKey[] {
  return ['find', 'library']
}
const glyph = (codePoint: number) => String.fromCodePoint(codePoint)

const PANEL_META: Record<FunctionsPanelKey, { label: string; icon: FunctionsIcon; description: string }> = {
  find: {
    label: 'Find',
    icon: glyph(0x2315),
    description: 'Search, sort, and jump from one place.',
  },
  view: {
    label: 'View',
    icon: glyph(0x21c5),
    description: 'Focus systems and tune layout controls.',
  },
  library: {
    label: 'Library',
    icon: 'library-controller',
    description: 'Open the full Library.',
  },
}

function renderFunctionsIcon(icon: FunctionsIcon): ReactNode {
  if (icon === 'library-controller') {
    return (
      <svg className="launcher-functions-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 9.5h10a3.5 3.5 0 0 1 3.42 4.28l-.62 2.48a2.4 2.4 0 0 1-3.72 1.35l-2.08-1.39h-4l-2.08 1.39a2.4 2.4 0 0 1-3.72-1.35l-.62-2.48A3.5 3.5 0 0 1 7 9.5Z" />
        <path d="M8.7 12.2v2.2" />
        <path d="M7.6 13.3h2.2" />
        <circle cx="14.9" cy="12.7" r="0.9" />
        <circle cx="17.1" cy="14.2" r="0.9" />
      </svg>
    )
  }

  return icon
}

function getPanelMeta(panel: FunctionsPanelKey, isSystemsView: boolean): { label: string; icon: FunctionsIcon; description: string } {
  if (panel === 'find') {
    return {
      ...PANEL_META.find,
      label: isSystemsView ? 'Find Systems' : 'Find Games',
      description: isSystemsView
        ? 'Search systems and set systems sort behavior.'
        : 'Search, sort, and jump through games quickly.',
    }
  }

  if (panel === 'view') {
    return {
      ...PANEL_META.view,
      label: isSystemsView ? 'Systems View' : 'Games View',
      description: isSystemsView
        ? 'Focus systems and adjust systems grid sizing.'
        : 'Filter by system and tune grouping and grid density.',
    }
  }

  return {
    ...PANEL_META.library,
    description: 'Open the full Library.',
  }
}

export const LauncherFunctionsBar: FC<LauncherFunctionsBarProps> = ({
  isSystemsView = false,
  systemsViewMode = 'stack',
  systemsGridSortMode = 'title-asc',
  systemsGridSizeMode = 'medium',
  systemsSearch,
  systemsHasSearchQuery,
  systemsSearchResultCount,
  systemsSearchMatches,
  isGridView,
  search,
  hasSearchQuery,
  searchResultCount,
  isSearchFocused,
  focusedGameIndex,
  scrollVisibleGamesLength,
  systemCategories,
  activeCategory,
  gridSortOptions,
  gridSortMode,
  gridGroupMode,
  gridSizeMode,
  hasVisibleFavoriteGame,
  letterJumpTargets,
  activeSystemLabel,
  onSearchChange,
  onSystemsSearchChange,
  onSearchFocusChange,
  onBackToSystems,
  onStopGameStackMomentum,
  onStepFocusedGame,
  onFocusGameByIndex,
  onJumpToTopGame,
  onJumpToBottomGame,
  onJumpToFavoriteGame,
  onJumpToLetter,
  onOpenAddGames,
  onSelectCategory,
  onSetGridSortMode,
  onSetGridGroupMode,
  onSetGridSizeMode,
  onToggleSystemsViewMode,
  onSetSystemsGridSortMode,
  onSetSystemsGridSizeMode,
  onToggleViewMode,
  onPlayUiHoverSound,
  onPlayUiSelectSound,
  showGamepadPrompts = false,
  gamepadPromptByControl,
}) => {
  const [activePanel, setActivePanel] = useState<FunctionsPanelKey | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const lastHoveredControlRef = useRef<HTMLElement | null>(null)
  const isSystemsGridView = systemsViewMode === 'grid'

  useEffect(() => {
    if (!activePanel) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }

      if (shellRef.current?.contains(target)) {
        return
      }

      setActivePanel(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setActivePanel(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePanel])

  const activePanelMeta = activePanel ? getPanelMeta(activePanel, isSystemsView) : null
  const panelTitle = activePanelMeta?.label ?? 'Functions'
  const panelDescription = activePanelMeta?.description ?? ''
  const visiblePanelOrder = showGamepadPrompts ? getGamepadPanelOrder(isSystemsView) : PANEL_ORDER

  const hasFavoriteSortMode = useMemo(
    () => gridSortOptions.some((option) => option.mode === 'favorites' && !option.disabled),
    [gridSortOptions],
  )

  const gamepadSortOptions = useMemo(
    () => gridSortOptions.filter((option) => !option.disabled).slice(0, 3),
    [gridSortOptions],
  )

  const playSelectSound = () => {
    onPlayUiSelectSound?.()
  }

  const closeActivePanel = () => {
    if (!activePanel) {
      return
    }

    playSelectSound()
    setActivePanel(null)
  }

  const openPanel = (panel: FunctionsPanelKey) => {
    if (panel === 'library') {
      triggerOpenAddGames('apps-games')
      return
    }

    playSelectSound()
    setActivePanel((previous) => (previous === panel ? null : panel))
  }

  const activateCategory = (categoryKey: LauncherCategory) => {
    if (activeCategory === categoryKey) {
      return
    }

    playSelectSound()
    onSelectCategory(categoryKey)
  }

  const activateSortMode = (mode: GridSortMode) => {
    if (gridSortMode === mode) {
      return
    }

    playSelectSound()
    onSetGridSortMode(mode)
  }

  const activateGridGroupMode = (mode: GridGroupMode) => {
    if (gridGroupMode === mode) {
      return
    }

    playSelectSound()
    onSetGridGroupMode(mode)
  }

  const activateGridSizeMode = (mode: GridSizeMode) => {
    if (gridSizeMode === mode) {
      return
    }

    playSelectSound()
    onSetGridSizeMode(mode)
  }

  const activateSystemsGridSortMode = (mode: SystemsGridSortMode) => {
    if (systemsGridSortMode === mode) {
      return
    }

    playSelectSound()
    onSetSystemsGridSortMode?.(mode)
  }

  const activateSystemsGridSizeMode = (mode: SystemsGridSizeMode) => {
    if (systemsGridSizeMode === mode) {
      return
    }

    playSelectSound()
    onSetSystemsGridSizeMode?.(mode)
  }

  const triggerJumpToTop = () => {
    playSelectSound()
    onJumpToTopGame()
  }

  const triggerJumpToBottom = () => {
    playSelectSound()
    onJumpToBottomGame()
  }

  const triggerJumpToFavorite = () => {
    if (!hasVisibleFavoriteGame) {
      return
    }

    playSelectSound()
    onJumpToFavoriteGame()
  }

  const triggerJumpToLetter = (letter: string) => {
    playSelectSound()
    onJumpToLetter(letter)
  }

  const togglePrimaryViewMode = () => {
    playSelectSound()
    if (isSystemsView) {
      onToggleSystemsViewMode?.()
      return
    }

    onToggleViewMode()
  }

  const triggerOpenAddGames = (initialTab?: 'apps-games' | 'roms' | 'systems') => {
    if (!onOpenAddGames) {
      return
    }

    playSelectSound()
    onOpenAddGames(initialTab)
  }

  const handleSearchInputHover = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (event.pointerType === 'touch') {
      return
    }

    onPlayUiHoverSound?.()
  }

  const handleSystemsSearchFocus = () => {
    playSelectSound()
  }

  const handleShellPointerOver = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      return
    }

    const target = event.target as HTMLElement | null
    if (!target) {
      return
    }

    const control = target.closest('button, [role="button"]') as HTMLElement | null
    if (!control) {
      return
    }

    if (control === lastHoveredControlRef.current) {
      return
    }

    if (control.hasAttribute('disabled') || control.getAttribute('aria-disabled') === 'true') {
      lastHoveredControlRef.current = control
      return
    }

    lastHoveredControlRef.current = control
    onPlayUiHoverSound?.()
  }

  const resetHoveredControl = () => {
    lastHoveredControlRef.current = null
  }

  useEffect(() => {
    const getToolbarButtons = () => Array.from(
      shellRef.current?.querySelectorAll<HTMLButtonElement>('.launcher-functions-rail .launcher-functions-button') ?? [],
    )

    const getPanelFocusables = () => {
      const gamepadNav = shellRef.current?.querySelector('.launcher-functions-gamepad-nav')
      if (gamepadNav) {
        return collectFocusable(gamepadNav)
      }

      const panelBody = shellRef.current?.querySelector('.launcher-functions-panel-body')
      if (!panelBody) {
        return [] as HTMLElement[]
      }

      return collectFocusable(panelBody)
    }

    const blurFunctionsShellFocus = () => {
      const activeElement = document.activeElement as HTMLElement | null
      if (activeElement && shellRef.current?.contains(activeElement)) {
        activeElement.blur()
      }
    }

    const focusSearchField = () => {
      openPanel('find')
      window.requestAnimationFrame(() => {
        const searchInput = shellRef.current?.querySelector<HTMLInputElement>(
          '.launcher-functions-panel .search-input, .launcher-functions-panel .games-search-input',
        )
        if (searchInput) {
          focusElement(searchInput)
          searchInput.click()
        }
      })
    }

    const cyclePanel = () => {
      if (!activePanel) {
        openPanel('find')
        return
      }

      const currentIndex = visiblePanelOrder.indexOf(activePanel)
      const nextPanel = visiblePanelOrder[(currentIndex + 1) % visiblePanelOrder.length]
      openPanel(nextPanel)
    }

    const moveToolbarFocus = (direction: 'up' | 'down' | 'left' | 'right') => {
      const buttons = getToolbarButtons()
      if (buttons.length === 0) {
        return
      }

      const preferHorizontalRow = direction === 'left' || direction === 'right'
      moveFocusSpatial(direction, buttons, { preferHorizontalRow })
    }

    const returnFocusToLauncherMain = () => {
      window.dispatchEvent(new CustomEvent('tilezu:focus-launcher-main'))
    }

    const openPanelDirect = (panel: FunctionsPanelKey) => {
      playSelectSound()
      setActivePanel(panel)
      window.requestAnimationFrame(() => {
        focusFirst(getPanelFocusables())
      })
    }

    const handleControllerCommand = (event: Event) => {
      const detail = (event as CustomEvent<{ command?: string }>).detail
      const command = detail?.command
      if (!command) {
        return
      }

      switch (command) {
        case 'open-find':
          openPanelDirect('find')
          return
        case 'open-library':
          triggerOpenAddGames('apps-games')
          return
        case 'open-menu':
          if (activePanel) {
            cyclePanel()
          } else {
            openPanel('find')
            window.requestAnimationFrame(() => {
              focusFirst(getToolbarButtons())
            })
          }
          return
        case 'focus-search':
          focusSearchField()
          return
        case 'left':
          if (activePanel) {
            const panelFocusables = getPanelFocusables()
            const activeElement = document.activeElement as HTMLElement | null
            const currentIndex = activeElement
              ? panelFocusables.findIndex((element) => element === activeElement || element.contains(activeElement))
              : -1
            if (currentIndex <= 0) {
              const panelButton = getToolbarButtons().find((button) => button.classList.contains('active'))
              if (panelButton) {
                focusElement(panelButton)
                return
              }
            }
            moveFocusSpatial('left', panelFocusables, { preferHorizontalRow: false })
          } else {
            moveToolbarFocus('left')
          }
          return
        case 'right':
          if (activePanel) {
            moveFocusSpatial('right', getPanelFocusables(), { preferHorizontalRow: false })
          } else {
            returnFocusToLauncherMain()
          }
          return
        case 'up':
          if (activePanel) {
            moveFocusSpatial('up', getPanelFocusables(), { preferHorizontalRow: false })
          } else {
            moveToolbarFocus('up')
          }
          return
        case 'down':
          if (activePanel) {
            moveFocusSpatial('down', getPanelFocusables(), { preferHorizontalRow: false })
          } else {
            moveToolbarFocus('down')
          }
          return
        case 'confirm': {
          const activeElement = document.activeElement as HTMLElement | null
          if (activeElement && shellRef.current?.contains(activeElement)) {
            activateFocusedElement()
            return
          }

          if (activePanel) {
            focusFirst(getPanelFocusables())
            return
          }

          const toolbarButtons = getToolbarButtons()
          const findButton = toolbarButtons.find((button) => button.getAttribute('aria-label')?.includes('Find'))
          if (findButton) {
            findButton.click()
          }
          return
        }
        case 'back':
          if (activePanel) {
            closeActivePanel()
            return
          }

          blurFunctionsShellFocus()
          returnFocusToLauncherMain()
          return
        default:
          return
      }
    }

    window.addEventListener('tilezu:functions-bar-command', handleControllerCommand)
    return () => {
      window.removeEventListener('tilezu:functions-bar-command', handleControllerCommand)
    }
  }, [activePanel, isSystemsView, showGamepadPrompts, visiblePanelOrder])

  const isPrimaryGridView = isSystemsView ? isSystemsGridView : isGridView
  const primaryViewModeIcon = isPrimaryGridView ? glyph(0x2630) : glyph(0x25a6)
  const primaryViewModeLabel = isPrimaryGridView ? 'Scroll Mode' : 'Grid Mode'
  const primaryViewModeTitle = isPrimaryGridView
    ? 'Switch to Scroll Mode'
    : 'Switch to Grid Mode'

  return (
    <div
      className={activePanel ? 'launcher-functions-shell is-open' : 'launcher-functions-shell'}
      ref={shellRef}
      onPointerOver={handleShellPointerOver}
      onPointerLeave={resetHoveredControl}
    >
      <div className="launcher-functions-rail" role="toolbar" aria-label={isSystemsView ? 'Systems functions' : 'Launcher functions'}>
        {!isSystemsView && (
          <button
            type="button"
            className="launcher-functions-button launcher-functions-button-mode"
            data-controller-focusable=""
            aria-label="Back to Systems"
            title="Back to Systems"
            onClick={() => {
              playSelectSound()
              onBackToSystems()
            }}
          >
            <span className="launcher-functions-icon" aria-hidden="true">{glyph(0x2190)}</span>
            {showGamepadPrompts && gamepadPromptByControl?.['back-to-systems'] && (
              <span className="launcher-functions-pad-hint" aria-hidden="true">{gamepadPromptByControl['back-to-systems']}</span>
            )}
            <span className="launcher-functions-label">Back to Systems</span>
          </button>
        )}

        <button
          type="button"
          className="launcher-functions-button launcher-functions-button-mode"
          data-controller-focusable=""
          aria-label={primaryViewModeTitle}
          title={primaryViewModeTitle}
          onClick={togglePrimaryViewMode}
        >
          <span className="launcher-functions-icon" aria-hidden="true">{primaryViewModeIcon}</span>
          {showGamepadPrompts && gamepadPromptByControl?.['toggle-view'] && (
            <span className="launcher-functions-pad-hint" aria-hidden="true">{gamepadPromptByControl['toggle-view']}</span>
          )}
          <span className="launcher-functions-label">{primaryViewModeLabel}</span>
        </button>

        {visiblePanelOrder.map((panel) => {
          const meta = getPanelMeta(panel, isSystemsView)
          const isActive = activePanel === panel

          return (
            <button
              key={`launcher-functions-${panel}`}
              type="button"
              data-controller-focusable=""
              className={isActive ? 'launcher-functions-button active' : 'launcher-functions-button'}
              aria-pressed={isActive}
              aria-label={meta.label}
              title={meta.label}
              onClick={() => openPanel(panel)}
            >
              <span className="launcher-functions-icon" aria-hidden="true">{renderFunctionsIcon(meta.icon)}</span>
              {showGamepadPrompts && gamepadPromptByControl?.[panel] && (
                <span className="launcher-functions-pad-hint" aria-hidden="true">{gamepadPromptByControl[panel]}</span>
              )}
              <span className="launcher-functions-label">{meta.label}</span>
            </button>
          )
        })}
      </div>

      <aside
        className={activePanel ? 'launcher-functions-panel is-open' : 'launcher-functions-panel'}
        role="dialog"
        aria-modal="false"
        aria-label={`${panelTitle} controls`}
      >
        {activePanel && (
          <>
            <div className="launcher-functions-panel-head">
              <div className="launcher-functions-panel-headline">
                <p className="launcher-functions-kicker">Functions</p>
                <h3>{panelTitle}</h3>
                <p>{panelDescription}</p>
              </div>
              <button
                type="button"
                className="launcher-functions-close"
                aria-label="Close functions panel"
                onClick={closeActivePanel}
              >
                X
              </button>
            </div>

            <div className="launcher-functions-panel-body">
              {activePanel === 'find' && (
                <>
                  {showGamepadPrompts && (
                    <div className="launcher-functions-gamepad-nav" aria-label="Find">
                      {isSystemsView ? (
                        <>
                          <input
                            className="search-input games-search-input launcher-functions-gamepad-item"
                            data-controller-focusable=""
                            value={systemsSearch}
                            onChange={(event) => onSystemsSearchChange(event.target.value)}
                            onFocus={handleSystemsSearchFocus}
                            placeholder="Search systems"
                            aria-label="Search systems"
                          />
                          <button
                            type="button"
                            data-controller-focusable=""
                            className={systemsGridSortMode === 'title-asc' ? 'launcher-functions-gamepad-item active' : 'launcher-functions-gamepad-item'}
                            onClick={() => activateSystemsGridSortMode('title-asc')}
                          >
                            A-Z
                          </button>
                          <button
                            type="button"
                            data-controller-focusable=""
                            className={systemsGridSortMode === 'game-count' ? 'launcher-functions-gamepad-item active' : 'launcher-functions-gamepad-item'}
                            onClick={() => activateSystemsGridSortMode('game-count')}
                          >
                            Most Games
                          </button>
                          <button
                            type="button"
                            data-controller-focusable=""
                            className={systemsGridSortMode === 'recently-played' ? 'launcher-functions-gamepad-item active' : 'launcher-functions-gamepad-item'}
                            onClick={() => activateSystemsGridSortMode('recently-played')}
                          >
                            Recent
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            className="search-input games-search-input launcher-functions-gamepad-item"
                            data-controller-focusable=""
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            onFocus={() => onSearchFocusChange(true)}
                            placeholder="Search games"
                            aria-label="Search games"
                          />
                          {gamepadSortOptions.map((option) => (
                            <button
                              key={`gamepad-sort-${option.mode}`}
                              type="button"
                              data-controller-focusable=""
                              className={gridSortMode === option.mode ? 'launcher-functions-gamepad-item active' : 'launcher-functions-gamepad-item'}
                              onClick={() => activateSortMode(option.mode)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}

                  <div className={showGamepadPrompts ? 'launcher-functions-section launcher-functions-search launcher-functions-mouse-only' : 'launcher-functions-section launcher-functions-search'}>
                  {isSystemsView ? (
                    <>
                      <div className={systemsHasSearchQuery ? 'wii-search-wrap games-search-wrap has-query' : 'wii-search-wrap games-search-wrap'}>
                        <span className="search-leading-icon" aria-hidden="true">{glyph(0x2315)}</span>
                        <input
                          className="search-input games-search-input"
                          value={systemsSearch}
                          onChange={(event) => onSystemsSearchChange(event.target.value)}
                          onPointerEnter={handleSearchInputHover}
                          onFocus={handleSystemsSearchFocus}
                          placeholder="Search systems"
                          aria-label="Search systems"
                        />
                        {systemsHasSearchQuery && (
                          <span className="search-results-pill" aria-live="polite">
                            {systemsSearchResultCount} {systemsSearchResultCount === 1 ? 'match' : 'matches'}
                          </span>
                        )}
                      </div>

                      {systemsHasSearchQuery ? (
                        systemsSearchMatches.length > 0 ? (
                          <div className="launcher-functions-chip-grid" role="listbox" aria-label="Matching systems">
                            {systemsSearchMatches.slice(0, 16).map((category) => {
                              const isActive = activeCategory === category.key
                              return (
                                <button
                                  key={`functions-systems-search-${category.key}`}
                                  type="button"
                                  className={isActive ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                                  aria-selected={isActive}
                                  title={`Focus ${category.label}`}
                                  onClick={() => activateCategory(category.key)}
                                >
                                  <span>{category.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="launcher-functions-note">No systems match this search.</p>
                        )
                      ) : (
                        <p className="launcher-functions-note">Type to find and focus a system quickly.</p>
                      )}

                      <p className="launcher-functions-note">Systems sort</p>
                      <div className="launcher-functions-subgroup" role="group" aria-label="Systems sort mode">
                        <button
                          type="button"
                          className={systemsGridSortMode === 'title-asc' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                          onClick={() => activateSystemsGridSortMode('title-asc')}
                        >
                          A-Z
                        </button>
                        <button
                          type="button"
                          className={systemsGridSortMode === 'game-count' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                          onClick={() => activateSystemsGridSortMode('game-count')}
                        >
                          Most Games
                        </button>
                        <button
                          type="button"
                          className={systemsGridSortMode === 'recently-played' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                          onClick={() => activateSystemsGridSortMode('recently-played')}
                        >
                          Recent
                        </button>
                      </div>

                    </>
                  ) : (
                    <>
                      <SearchBar
                        search={search}
                        hasSearchQuery={hasSearchQuery}
                        searchResultCount={searchResultCount}
                        isSearchFocused={isSearchFocused}
                        isGridView={isGridView}
                        showBackButton={false}
                        focusedGameIndex={focusedGameIndex}
                        scrollVisibleGamesLength={scrollVisibleGamesLength}
                        onSearchChange={onSearchChange}
                        onSearchFocusChange={onSearchFocusChange}
                        onBackToSystems={onBackToSystems}
                        onStopGameStackMomentum={onStopGameStackMomentum}
                        onStepFocusedGame={onStepFocusedGame}
                        onFocusGameByIndex={onFocusGameByIndex}
                        onJumpToTopGame={onJumpToTopGame}
                        onJumpToBottomGame={onJumpToBottomGame}
                        onPlayUiHoverSound={onPlayUiHoverSound}
                        onPlayUiSelectSound={onPlayUiSelectSound}
                      />

                      <p className="launcher-functions-note">Sort games</p>
                      <div className="launcher-functions-chip-grid" role="listbox" aria-label="Sort games">
                        {gridSortOptions.map((option) => {
                          const isActive = gridSortMode === option.mode
                          const isDisabled = Boolean(option.disabled)
                          const className = isActive
                            ? 'game-filter-chip launcher-functions-chip active'
                            : 'game-filter-chip launcher-functions-chip'

                          return (
                            <button
                              key={`functions-sort-${option.mode}`}
                              type="button"
                              className={className}
                              aria-selected={isActive}
                              disabled={isDisabled}
                              title={option.label}
                              onClick={() => activateSortMode(option.mode)}
                            >
                              <span className="launcher-functions-chip-glyph" aria-hidden="true">{option.icon}</span>
                              <span>{option.label}</span>
                            </button>
                          )
                        })}
                      </div>

                      <p className="launcher-functions-note">Quick jump</p>
                      <div className="launcher-functions-subgroup" role="group" aria-label="Jump controls">
                        <button
                          type="button"
                          className={focusedGameIndex > 0 ? 'game-jump-chip launcher-functions-chip' : 'game-jump-chip launcher-functions-chip is-disabled'}
                          onClick={triggerJumpToTop}
                          disabled={focusedGameIndex <= 0}
                          title="Jump to first game"
                        >
                          Top
                        </button>

                        <button
                          type="button"
                          className={hasVisibleFavoriteGame ? 'game-jump-chip launcher-functions-chip' : 'game-jump-chip launcher-functions-chip is-disabled'}
                          onClick={triggerJumpToFavorite}
                          disabled={!hasVisibleFavoriteGame}
                          title="Jump to first favorite"
                        >
                          Favorites
                        </button>

                        <button
                          type="button"
                          className={scrollVisibleGamesLength > 0 ? 'game-jump-chip launcher-functions-chip' : 'game-jump-chip launcher-functions-chip is-disabled'}
                          onClick={triggerJumpToBottom}
                          disabled={scrollVisibleGamesLength <= 0}
                          title="Jump to last game"
                        >
                          End
                        </button>
                      </div>

                      {letterJumpTargets.length > 0 && (
                        <div className="launcher-functions-letter-row" role="group" aria-label="Jump by letter">
                          {letterJumpTargets.map((target) => {
                            const isActive = focusedGameIndex >= target.index
                            return (
                              <button
                                key={`functions-jump-letter-${target.letter}`}
                                type="button"
                                className={isActive ? 'game-jump-chip launcher-functions-chip jump-letter active' : 'game-jump-chip launcher-functions-chip jump-letter'}
                                title={`Jump to ${target.letter}`}
                                onClick={() => triggerJumpToLetter(target.letter)}
                              >
                                {target.letter}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                  </div>
                </>
              )}

              {activePanel === 'view' && (
                <>
                  {showGamepadPrompts && (
                    <div className="launcher-functions-gamepad-nav" aria-label="View">
                      <p className="launcher-functions-gamepad-label">{activeSystemLabel}</p>
                      <button
                        type="button"
                        data-controller-focusable=""
                        className="launcher-functions-gamepad-item"
                        onClick={togglePrimaryViewMode}
                      >
                        {primaryViewModeLabel}
                      </button>
                    </div>
                  )}

                  <div className={showGamepadPrompts ? 'launcher-functions-section launcher-functions-mouse-only' : 'launcher-functions-section'}>
                  <p className="launcher-functions-note">{isSystemsView ? 'Focus system' : 'Filter by system'}</p>
                  <div className="launcher-functions-chip-grid" role="tablist" aria-label={isSystemsView ? 'Focus system' : 'Filter by system'}>
                    {systemCategories.map((category) => {
                      const isActive = activeCategory === category.key
                      return (
                        <button
                          key={`functions-filter-${category.key}`}
                          type="button"
                          className={isActive ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                          role="tab"
                          aria-selected={isActive}
                          title={isSystemsView ? `Focus ${category.label}` : `Filter by ${category.label}`}
                          onClick={() => activateCategory(category.key)}
                        >
                          <span>{category.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {isSystemsView && systemsHasSearchQuery && (
                    <p className="launcher-functions-note">
                      Search is currently matching {systemsSearchResultCount} {systemsSearchResultCount === 1 ? 'system' : 'systems'}.
                    </p>
                  )}

                  {!isSystemsView && hasFavoriteSortMode && (
                    <div className="launcher-functions-row">
                      <button
                        type="button"
                        className={gridSortMode === 'favorites' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                        onClick={() => activateSortMode('favorites')}
                      >
                        <span>Favorites First</span>
                      </button>
                    </div>
                  )}

                  {isSystemsView ? (
                    !isSystemsGridView ? (
                      <>
                        <p className="launcher-functions-note">Systems grid controls are available in systems grid mode.</p>
                        <div className="launcher-functions-row">
                          <button
                            type="button"
                            className="game-filter-chip launcher-functions-chip"
                            onClick={togglePrimaryViewMode}
                          >
                            Switch to Grid Mode
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="launcher-functions-note">Systems tile size</p>
                        <div className="launcher-functions-subgroup" role="group" aria-label="Systems tile size">
                          <button
                            type="button"
                            className={systemsGridSizeMode === 'compact' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateSystemsGridSizeMode('compact')}
                          >
                            Compact
                          </button>
                          <button
                            type="button"
                            className={systemsGridSizeMode === 'medium' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateSystemsGridSizeMode('medium')}
                          >
                            Medium
                          </button>
                          <button
                            type="button"
                            className={systemsGridSizeMode === 'large' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateSystemsGridSizeMode('large')}
                          >
                            Large
                          </button>
                        </div>
                      </>
                    )
                  ) : (
                    !isGridView ? (
                      <>
                        <p className="launcher-functions-note">Grid layout controls are available when grid mode is active.</p>
                        <div className="launcher-functions-row">
                          <button
                            type="button"
                            className="game-filter-chip launcher-functions-chip"
                            onClick={togglePrimaryViewMode}
                          >
                            Switch to Grid Mode
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="launcher-functions-note">Grouping</p>
                        <div className="launcher-functions-subgroup" role="group" aria-label="Grouping">
                          <button
                            type="button"
                            className={gridGroupMode === 'platform' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateGridGroupMode('platform')}
                          >
                            Grouped
                          </button>
                          <button
                            type="button"
                            className={gridGroupMode === 'none' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateGridGroupMode('none')}
                          >
                            Flat
                          </button>
                        </div>

                        <p className="launcher-functions-note">Tile size</p>
                        <div className="launcher-functions-subgroup" role="group" aria-label="Tile size">
                          <button
                            type="button"
                            className={gridSizeMode === 'compact' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateGridSizeMode('compact')}
                          >
                            Compact
                          </button>
                          <button
                            type="button"
                            className={gridSizeMode === 'medium' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateGridSizeMode('medium')}
                          >
                            Medium
                          </button>
                          <button
                            type="button"
                            className={gridSizeMode === 'large' ? 'game-filter-chip launcher-functions-chip active' : 'game-filter-chip launcher-functions-chip'}
                            onClick={() => activateGridSizeMode('large')}
                          >
                            Large
                          </button>
                        </div>
                      </>
                    )
                  )}
                  </div>
                </>
              )}

            </div>
          </>
        )}
      </aside>
    </div>
  )
}

export default LauncherFunctionsBar
