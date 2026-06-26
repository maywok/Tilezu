import type { FC, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

type SearchBarProps = {
  search: string
  hasSearchQuery: boolean
  searchResultCount: number
  isSearchFocused: boolean
  isGridView: boolean
  showBackButton?: boolean
  focusedGameIndex: number
  scrollVisibleGamesLength: number
  onSearchChange: (value: string) => void
  onSearchFocusChange: (isFocused: boolean) => void
  onBackToSystems: () => void
  onStopGameStackMomentum: () => void
  onStepFocusedGame: (direction: -1 | 1) => void
  onFocusGameByIndex: (index: number) => void
  onJumpToTopGame: () => void
  onJumpToBottomGame: () => void
  onPlayUiHoverSound?: () => void
  onPlayUiSelectSound?: () => void
}

export const SearchBar: FC<SearchBarProps> = ({
  search,
  hasSearchQuery,
  searchResultCount,
  isSearchFocused,
  isGridView,
  showBackButton = true,
  focusedGameIndex,
  scrollVisibleGamesLength,
  onSearchChange,
  onSearchFocusChange,
  onBackToSystems,
  onStopGameStackMomentum,
  onStepFocusedGame,
  onFocusGameByIndex,
  onJumpToTopGame,
  onJumpToBottomGame,
  onPlayUiHoverSound,
  onPlayUiSelectSound,
}) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && search.trim().length > 0) {
      event.preventDefault()
      onSearchChange('')
      return
    }

    if (isGridView) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      onStopGameStackMomentum()
      onStepFocusedGame(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      onStopGameStackMomentum()
      onStepFocusedGame(-1)
      return
    }

    if (event.key === 'PageDown') {
      event.preventDefault()
      onStopGameStackMomentum()
      onFocusGameByIndex(Math.min(scrollVisibleGamesLength - 1, focusedGameIndex + 5))
      return
    }

    if (event.key === 'PageUp') {
      event.preventDefault()
      onStopGameStackMomentum()
      onFocusGameByIndex(Math.max(0, focusedGameIndex - 5))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      onJumpToTopGame()
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      onJumpToBottomGame()
      return
    }

    if (event.key === 'Enter' && hasSearchQuery && scrollVisibleGamesLength > 0) {
      event.preventDefault()
      onStopGameStackMomentum()
      onFocusGameByIndex(0)
    }
  }

  const wrapperClassName = isSearchFocused
    ? hasSearchQuery
      ? 'wii-search-wrap games-search-wrap is-search-focused has-query'
      : 'wii-search-wrap games-search-wrap is-search-focused'
    : hasSearchQuery
      ? 'wii-search-wrap games-search-wrap has-query'
      : 'wii-search-wrap games-search-wrap'

  const handleInputPointerEnter = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (event.pointerType === 'touch') {
      return
    }

    onPlayUiHoverSound?.()
  }

  const handleBackToSystemsClick = () => {
    onPlayUiSelectSound?.()
    onBackToSystems()
  }

  return (
    <div className={wrapperClassName}>
      {showBackButton && (
        <button type="button" className="ghost" onClick={handleBackToSystemsClick}>
          Back to Systems
        </button>
      )}
      <span className="search-leading-icon" aria-hidden="true">
        {'\u2315'}
      </span>
      <input
        className="search-input games-search-input"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        onPointerEnter={handleInputPointerEnter}
        onFocus={() => {
          onPlayUiSelectSound?.()
          onSearchFocusChange(true)
        }}
        onBlur={() => onSearchFocusChange(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search your library"
        aria-label="Search library with fuzzy matching"
      />
      {hasSearchQuery && (
        <span className="search-results-pill" aria-live="polite">
          {searchResultCount} {searchResultCount === 1 ? 'match' : 'matches'}
        </span>
      )}
    </div>
  )
}
