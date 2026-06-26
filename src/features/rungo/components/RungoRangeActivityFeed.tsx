import type { FC } from 'react'

import type { RungoRangeActivityEntry } from '../types'

function formatTerminalClockLabel(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}

type RungoRangeActivityFeedProps = {
  entries: RungoRangeActivityEntry[]
  maxVisible?: number
  className?: string
}

export const RungoRangeActivityFeed: FC<RungoRangeActivityFeedProps> = ({
  entries,
  maxVisible = 8,
  className,
}) => {
  const visibleEntries = entries.slice(-maxVisible)

  return (
    <section
      className={['rungo-range-activity-feed', className].filter(Boolean).join(' ')}
      aria-live="polite"
      aria-label="Range activity"
    >
      <header className="rungo-range-activity-feed-head">
        <strong>Activity</strong>
      </header>
      <div className="rungo-range-activity-feed-list" role="log">
        {visibleEntries.length > 0 ? visibleEntries.map((entry) => (
          <div key={entry.id} className={`rungo-range-activity-entry level-${entry.level}`}>
            <span className="rungo-range-activity-time">[{formatTerminalClockLabel(entry.createdAt)}]</span>
            <span>{entry.message}</span>
          </div>
        )) : (
          <div className="rungo-range-activity-entry is-empty">
            <span className="rungo-range-activity-time">[--:--:--]</span>
            <span>Range events and notifications appear here.</span>
          </div>
        )}
      </div>
    </section>
  )
}
