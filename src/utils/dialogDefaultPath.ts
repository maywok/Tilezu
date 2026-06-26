import { isTauri } from '@tauri-apps/api/core'
import { homeDir, join } from '@tauri-apps/api/path'

const PLACEHOLDER_PATH_MARKERS = ['/path/to/', '\\path\\to\\']

function isPlaceholderPath(path: string): boolean {
  const normalized = path.trim().toLowerCase().replace(/\\/g, '/')
  if (!normalized) {
    return true
  }

  return PLACEHOLDER_PATH_MARKERS.some((marker) => normalized.includes(marker))
}

async function expandHomeInPath(path: string): Promise<string> {
  const trimmed = path.trim()
  if (!trimmed.startsWith('~')) {
    return trimmed
  }

  if (!isTauri()) {
    return trimmed
  }

  try {
    const home = await homeDir()
    if (trimmed === '~') {
      return home
    }

    const rest = trimmed.replace(/^~[/\\]/, '')
    const segments = rest.split(/[/\\]/).filter(Boolean)
    if (segments.length === 0) {
      return home
    }

    return join(home, ...segments)
  } catch {
    return trimmed
  }
}

function directoryFromPath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) {
    return trimmed
  }

  const normalized = trimmed.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash <= 0) {
    return trimmed
  }

  const basename = normalized.slice(lastSlash + 1)
  const looksLikeFile = /\.[a-z0-9]{1,8}$/i.test(basename)
  if (looksLikeFile) {
    return trimmed.slice(0, trimmed.length - basename.length).replace(/[/\\]+$/, '')
  }

  return trimmed
}

export async function resolveDialogDefaultDirectory(
  path: string | null | undefined,
): Promise<string | undefined> {
  if (!path || isPlaceholderPath(path)) {
    return undefined
  }

  const expanded = await expandHomeInPath(path)
  const directory = directoryFromPath(expanded).trim()
  return directory.length > 0 ? directory : undefined
}

export async function resolveDialogDefaultDirectoryFromCandidates(
  candidates: string[],
): Promise<string | undefined> {
  for (const candidate of candidates) {
    const resolved = await resolveDialogDefaultDirectory(candidate)
    if (resolved) {
      return resolved
    }
  }

  return undefined
}
