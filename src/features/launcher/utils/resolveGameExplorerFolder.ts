import type { GameEntry } from '../types'

function isSpecialLauncherTarget(target: string): boolean {
  const trimmed = target.trim()
  return trimmed.startsWith('__') && trimmed.endsWith('__')
}

function looksLikeFilesystemPath(target: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(target)) {
    return true
  }

  return target.includes('\\') || target.includes('/')
}

function parentDirectoryPath(target: string): string {
  const normalized = target.replace(/\//g, '\\')
  const lastSeparator = normalized.lastIndexOf('\\')
  if (lastSeparator <= 0) {
    return normalized
  }

  return normalized.slice(0, lastSeparator)
}

export function resolveGameExplorerFolder(entry: GameEntry): string | null {
  const target = entry.target.trim()
  if (!target || isSpecialLauncherTarget(target)) {
    return null
  }

  if (!looksLikeFilesystemPath(target)) {
    return null
  }

  if (/\.[a-z0-9]{1,8}$/i.test(target)) {
    return parentDirectoryPath(target)
  }

  return target
}