export type RungoCollectionFilter = 'all' | 'unlocked' | 'locked' | 'rare+'

export type RungoHubTab = 'collection' | 'garden'

/** @deprecated Use RungoHubTab */
export type RungoFullMenuMode = RungoHubTab

export type RungoRangeActivityEntry = {
  id: string
  level: 'visitor' | 'event' | 'status'
  message: string
  createdAt: number
}

export type RungoRangeItemTrayEntry = {
  id: 'food' | 'toy' | 'bed'
  dragId: string
  glyph: string
  label: string
  description: string
  count: number
}