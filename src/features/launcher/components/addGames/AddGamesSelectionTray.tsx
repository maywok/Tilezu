import type { FC, PointerEvent } from 'react'

import { normalizeGameTitle } from '../../utils/search'
import type { AddGamesDragPreviewItem } from './types'

type AddGamesSelectionTrayProps = {
  items: AddGamesDragPreviewItem[]
  selectedCount: number
  dragStackItems: AddGamesDragPreviewItem[]
  onToggleSelection: (gameId: string, checked: boolean) => void
  onItemPointerDown: (
    event: PointerEvent<HTMLElement>,
    gameId: string,
    previewItems: AddGamesDragPreviewItem[],
    onClick?: () => void,
  ) => void
}

export const AddGamesSelectionTray: FC<AddGamesSelectionTrayProps> = ({
  items,
  selectedCount,
  dragStackItems,
  onToggleSelection,
  onItemPointerDown,
}) => {
  return (
    <section
      className="tm-add-games-selection-tray"
      aria-label="Selected games"
    >
      <header className="tm-add-games-selection-tray-head">
        <span className="tm-add-games-selection-tray-count">
          {selectedCount > 0 ? `${selectedCount} selected` : 'No games selected'}
        </span>
      </header>

      <div className="tm-add-games-selection-tray-grid tm-ui-scrollbar" role="list">
        {items.length === 0 ? (
          <p className="tm-add-games-selection-tray-empty settings-note">
            Selected games appear here
          </p>
        ) : (
          items.map((item) => {
            const previewItems = selectedCount > 1 ? dragStackItems : [item]

            return (
              <div
                key={`selected-tray-${item.id}`}
                className="tm-add-games-selection-tray-tile"
                role="listitem"
                title={item.title}
                onPointerDown={(event) => {
                  onItemPointerDown(event, item.id, previewItems)
                }}
              >
                {item.cover ? (
                  <img src={item.cover} alt="" className="tm-add-games-selection-tray-cover" draggable={false} />
                ) : (
                  <span className="tm-add-games-selection-tray-fallback" aria-hidden="true">
                    {normalizeGameTitle(item.title).slice(0, 2).toUpperCase()}
                  </span>
                )}
                <button
                  type="button"
                  className="tm-add-games-selection-tray-remove"
                  aria-label={`Remove ${item.title} from selection`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleSelection(item.id, false)
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
