import React from 'react'

type Achievement = {
  key: string
  name: string
  achieved: boolean
  unlockTime: number
  globalPercent?: number
  hidden: boolean
  description?: string
}

interface AchievementModalProps {
  selectedAchievementGame: {
    game: { title: string }
    data: { unlocked: number; total: number; completionPercent: number }
    achievements: Achievement[]
  } | null
  achievementSearch: string
  setAchievementSearch: (v: string) => void
  achievementFilter: 'all' | 'unlocked' | 'locked'
  setAchievementFilter: (v: 'all' | 'unlocked' | 'locked') => void
  onClose: () => void
}

export const AchievementModal: React.FC<AchievementModalProps> = ({
  selectedAchievementGame,
  achievementSearch,
  setAchievementSearch,
  achievementFilter,
  setAchievementFilter,
  onClose,
}) => {
  if (!selectedAchievementGame) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <section className="modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="panel-title-row">
          <h2>
            {selectedAchievementGame.game.title} · {selectedAchievementGame.data.unlocked}/
            {selectedAchievementGame.data.total} ({selectedAchievementGame.data.completionPercent.toFixed(1)}%)
          </h2>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <input
          className="search-input"
          value={achievementSearch}
          onChange={(event) => setAchievementSearch(event.target.value)}
          placeholder="Search achievements"
        />

        <div className="filter-row">
          <button type="button" className={achievementFilter === 'all' ? 'tab-btn active' : 'tab-btn'} onClick={() => setAchievementFilter('all')}>
            All
          </button>
          <button type="button" className={achievementFilter === 'unlocked' ? 'tab-btn active' : 'tab-btn'} onClick={() => setAchievementFilter('unlocked')}>
            Unlocked
          </button>
          <button type="button" className={achievementFilter === 'locked' ? 'tab-btn active' : 'tab-btn'} onClick={() => setAchievementFilter('locked')}>
            Locked
          </button>
        </div>

        <div className="modal-list">
          {selectedAchievementGame.achievements.map((item) => (
            <article key={item.key} className="modal-item">
              <div>
                <strong>{item.achieved ? '✅' : '⬜'} {item.name}</strong>
                {item.description && <p>{item.description}</p>}
              </div>
              <span>
                {typeof item.globalPercent === 'number' ? `${item.globalPercent.toFixed(1)}% global` : 'No rarity data'}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
