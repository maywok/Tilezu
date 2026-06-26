import { SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY } from '../constants'
import type { GameEntry } from '../types'
import { getGameCategory } from './category'
import { getPlatformPeripheralOptionsForSystem } from './platformPeripherals'

export function resolveControllerSystemKeyForLaunch(
  entry: GameEntry,
  activeCategoryKey: string | null | undefined,
): string | null {
  const trimmedActiveCategory = typeof activeCategoryKey === 'string' ? activeCategoryKey.trim() : ''
  if (trimmedActiveCategory) {
    const activeMapped = SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY[trimmedActiveCategory]
    if (activeMapped) {
      return activeMapped
    }
  }

  const categoryMapped = SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY[getGameCategory(entry).key] ?? null
  if (categoryMapped) {
    return categoryMapped
  }

  const manualSystemKey = entry.manualSystemKey?.trim()
  if (manualSystemKey && getPlatformPeripheralOptionsForSystem(manualSystemKey).length > 0) {
    return manualSystemKey
  }

  return null
}
