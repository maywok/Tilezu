import { useId, type FC, type ReactNode } from 'react'

type AddGamesLibrarySearchProps = {
  search: string
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  trailingActions?: ReactNode
}

export const AddGamesLibrarySearch: FC<AddGamesLibrarySearchProps> = ({
  search,
  onSearchChange,
  onSearchFocus,
  trailingActions,
}) => {
  const inputId = useId()

  return (
    <div className="tm-add-games-library-search-row">
      <div className="tm-add-games-library-search is-open is-expanded">
        <label className="tm-add-games-library-search-field" htmlFor={inputId}>
          <span className="tm-add-games-library-search-tab-icon" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path
                d="M8.75 3.5a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5Zm0 1.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm6.53 11.03-2.84-2.84 1.06-1.06 2.84 2.84-1.06 1.06Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <input
            id={inputId}
            className="tm-add-games-library-search-input"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={onSearchFocus}
            placeholder="Search"
            aria-label="Search library"
          />
        </label>
      </div>
      {trailingActions ? (
        <div className="tm-add-games-library-search-actions">{trailingActions}</div>
      ) : null}
    </div>
  )
}
