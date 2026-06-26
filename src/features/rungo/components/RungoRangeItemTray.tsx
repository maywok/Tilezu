import type { FC, PointerEvent as ReactPointerEvent } from 'react'

import type { RungoRangeItemTrayEntry } from '../types'

type RungoRangeItemTrayProps = {
  entries: RungoRangeItemTrayEntry[]
  onItemPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, entry: RungoRangeItemTrayEntry) => void
}

export const RungoRangeItemTray: FC<RungoRangeItemTrayProps> = ({
  entries,
  onItemPointerDown,
}) => {
  return (
    <div className="rungo-range-item-tray" role="group" aria-label="Range items">
      <span className="rungo-range-item-tray-label">Items</span>
      <div className="rungo-range-item-tray-grid">
        {entries.length > 0 ? entries.map((entry) => {
          const className = entry.count > 0
            ? 'rungo-range-item-chip'
            : 'rungo-range-item-chip is-empty'

          return (
            <button
              key={entry.id}
              type="button"
              className={className}
              data-pointer-drag-source={entry.count > 0 ? 'true' : undefined}
              onPointerDown={(event) => onItemPointerDown(event, entry)}
              title={entry.description}
              aria-label={`${entry.description}, ${entry.count} remaining`}
            >
              <span className="rungo-range-item-chip-glyph" aria-hidden="true">{entry.glyph}</span>
              <span className="rungo-range-item-chip-label">{entry.label}</span>
              <span className="rungo-range-item-chip-count">{entry.count}</span>
            </button>
          )
        }) : (
          <p className="settings-note rungo-range-item-tray-empty">No range items unlocked yet.</p>
        )}
      </div>
    </div>
  )
}
