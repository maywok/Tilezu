import type { GameEntry } from '../../types'

export function isUserAddedExecutable(entry: GameEntry): boolean {
  return (
    entry.kind === 'executable'
    && (entry.args ?? []).some((arg) => arg.trim().toLowerCase() === '--tm-user-added=1')
  )
}

export function entryNeedsHome(entry: GameEntry): boolean {
  return isUserAddedExecutable(entry) && !(entry.manualSystemKey ?? '').trim()
}
