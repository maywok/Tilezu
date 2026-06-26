type LaunchErrorCode =
  | 'INVALID_TARGET'
  | 'INVALID_URI'
  | 'INVALID_EMULATOR_ARGS'
  | 'MISSING_EMULATOR'
  | 'MISSING_ROM'
  | 'INVALID_RETROARCH_PATH'
  | 'CORE_DOWNLOAD_FAILED'
  | 'CORE_INSTALL_FAILED'
  | 'EXECUTABLE_NOT_FOUND'
  | 'EXECUTABLE_NOT_FILE'
  | 'URI_OPEN_FAILED'
  | 'SHELL_OPEN_FAILED'
  | 'LAUNCH_SPAWN_FAILED'
  | 'UNSUPPORTED_KIND'

const LAUNCH_ERROR_CODE_REGEX = /^\[([A-Z0-9_]+)\]\s*(.*)$/s

const FRIENDLY_MESSAGE_BY_CODE: Partial<Record<LaunchErrorCode, string>> = {
  INVALID_TARGET: 'Launch target is invalid. Please rescan your libraries.',
  INVALID_URI: 'Launch URI is invalid. Please rescan your libraries.',
  INVALID_EMULATOR_ARGS: 'Emulator launch arguments are invalid. Re-import this ROM and try again.',
  MISSING_EMULATOR: 'Emulator is not configured. Set emulator paths in Settings and try again.',
  MISSING_ROM: 'ROM file is missing or moved. Rescan ROM folders and try again.',
  INVALID_RETROARCH_PATH: 'RetroArch path is invalid. Set RetroArch in Settings and try again.',
  CORE_DOWNLOAD_FAILED: 'Could not download the required RetroArch core automatically. Check internet connection or install the core manually.',
  CORE_INSTALL_FAILED: 'RetroArch core download completed but could not be installed. Check write permissions and try again.',
  EXECUTABLE_NOT_FOUND: 'Launcher executable was not found. Verify installation path and rescan.',
  EXECUTABLE_NOT_FILE: 'Launch target is not an executable file. Verify path and rescan.',
  URI_OPEN_FAILED: 'Could not open launcher URI. Ensure the launcher is installed.',
  SHELL_OPEN_FAILED: 'Could not open shell launcher. Ensure the app is installed.',
  LAUNCH_SPAWN_FAILED: 'Failed to start launcher process. Check permissions and try again.',
  UNSUPPORTED_KIND: 'This launcher type is not supported yet.',
}

export type DecodedLaunchError = {
  code: string | null
  detail: string
  userMessage: string
}

function normalizeLaunchError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error ?? 'Unknown launch error')
}

export function decodeLaunchError(error: unknown): DecodedLaunchError {
  const raw = normalizeLaunchError(error)
  const match = raw.match(LAUNCH_ERROR_CODE_REGEX)

  if (!match) {
    return {
      code: null,
      detail: raw,
      userMessage: raw,
    }
  }

  const code = match[1]
  const detail = match[2] || raw
  const userMessage = FRIENDLY_MESSAGE_BY_CODE[code as LaunchErrorCode] ?? detail

  return {
    code,
    detail,
    userMessage,
  }
}
