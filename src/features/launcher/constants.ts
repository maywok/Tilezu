import type { EmulatorKey, GameEntry } from './types'

export const STORAGE_KEY = 'tile-manager-library'
export const SETTINGS_KEY = 'tile-manager-import-settings'
export const CUSTOM_SYSTEMS_STORAGE_KEY = 'tile-manager-custom-systems'
export const SCREENSHOT_DATA_URL_CACHE_LIMIT = 56
export const TILE_MOTION_STYLE_CACHE_LIMIT = 800
export const STACK_WHEEL_STEP_DELTA = 64
export const STACK_WHEEL_GLIDE_STEP_MS = 84
export const STACK_WHEEL_MOMENTUM_SETTLE_MS = 180
export const STACK_WHEEL_INPUT_CLAMP = 72
export const STACK_WHEEL_ACCUMULATOR_CAP = 192
export const STARTUP_DEFERRED_WORK_DELAY_MS = 260

export const CLOCK_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: '2-digit',
  day: '2-digit',
})

export const DEFAULT_ROM_DIRS = ['~/Documents/ROMs', '~/Downloads/ROMs', '~/Games/ROMs', 'D:/ROMs', 'E:/ROMs', 'F:/ROMs']

// Maps each pre-installed ROM system subfolder to its default emulator profile
export const ROM_SYSTEM_FOLDERS: { folder: string; profile: string; defaultEmulatorKey: EmulatorKey; label: string }[] = [
  { folder: 'Nintendo DS',  profile: 'ds',        defaultEmulatorKey: 'ds',        label: 'Nintendo DS' },
  { folder: 'Nintendo 3DS', profile: '3ds',       defaultEmulatorKey: '3ds',       label: 'Nintendo 3DS' },
  { folder: 'Game Boy Advance', profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'Game Boy Advance' },
  { folder: 'Game Boy',     profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'Game Boy / Color' },
  { folder: 'NES',          profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'NES' },
  { folder: 'SNES',         profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'SNES' },
  { folder: 'N64',          profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'Nintendo 64' },
  { folder: 'GameCube',     profile: 'dolphin',   defaultEmulatorKey: 'dolphin',   label: 'GameCube' },
  { folder: 'Wii',          profile: 'dolphin',   defaultEmulatorKey: 'dolphin',   label: 'Wii' },
  { folder: 'Wii U',        profile: 'cemu',      defaultEmulatorKey: 'cemu',      label: 'Wii U' },
  { folder: 'Switch',       profile: 'retroarch', defaultEmulatorKey: 'eden',      label: 'Nintendo Switch' },
  { folder: 'PS1',          profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'PlayStation 1' },
  { folder: 'PS2',          profile: 'ps2',       defaultEmulatorKey: 'pcsx2',     label: 'PlayStation 2' },
  { folder: 'PS3',          profile: 'rpcs3',     defaultEmulatorKey: 'rpcs3',     label: 'PlayStation 3' },
  { folder: 'PSP',          profile: 'psp',       defaultEmulatorKey: 'ppsspp',    label: 'PlayStation Portable' },
  { folder: 'Sega Genesis', profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'Sega Genesis' },
  { folder: 'Dreamcast',    profile: 'retroarch', defaultEmulatorKey: 'retroarch', label: 'Sega Dreamcast' },
]

// Default system → emulator key map derived from ROM_SYSTEM_FOLDERS
export const DEFAULT_SYSTEM_EMULATOR_MAP: Record<string, EmulatorKey> = Object.fromEntries(
  ROM_SYSTEM_FOLDERS.map(({ folder, defaultEmulatorKey }) => [folder, defaultEmulatorKey])
) as Record<string, EmulatorKey>

// Maps launcher category keys to ROM import folder keys used by emulator settings.
export const SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY: Record<string, string> = {
  ds: 'Nintendo DS',
  '3ds': 'Nintendo 3DS',
  gba: 'Game Boy Advance',
  gameboy: 'Game Boy',
  nes: 'NES',
  snes: 'SNES',
  n64: 'N64',
  gamecube: 'GameCube',
  wii: 'Wii',
  wiiu: 'Wii U',
  switch: 'Switch',
  ps1: 'PS1',
  ps2: 'PS2',
  ps3: 'PS3',
  psp: 'PSP',
  genesis: 'Sega Genesis',
  dreamcast: 'Dreamcast',
}

export const CONTROLLER_BIND_SYSTEM_KEYS = ROM_SYSTEM_FOLDERS.map(({ folder }) => folder)

export const EMULATOR_FIELDS: { key: EmulatorKey; label: string; placeholder: string }[] = [
  { key: 'retroarch', label: 'RetroArch', placeholder: 'C:/Path/To/retroarch.exe' },
  { key: 'eden', label: 'Eden', placeholder: 'C:/Path/To/Eden.exe' },
  { key: '3ds', label: 'Nintendo 3DS (Azahar / Citra)', placeholder: 'C:/Path/To/azahar.exe' },
  { key: 'dolphin', label: 'Dolphin', placeholder: 'C:/Path/To/Dolphin.exe' },
  { key: 'pcsx2', label: 'PCSX2', placeholder: 'C:/Path/To/pcsx2-qt.exe' },
  { key: 'ppsspp', label: 'PPSSPP', placeholder: 'C:/Path/To/PPSSPPWindows64.exe' },
  { key: 'cemu', label: 'Cemu', placeholder: 'C:/Path/To/cemu.exe' },
  { key: 'rpcs3', label: 'RPCS3', placeholder: 'C:/Path/To/rpcs3.exe' },
  { key: 'ds', label: 'Nintendo DS (melonDS / DeSmuME)', placeholder: 'C:/Path/To/melonDS.exe' },
]

export const EMPTY_EMULATOR_PATHS: Record<EmulatorKey, string> = {
  retroarch: '',
  eden: '',
  '3ds': '',
  dolphin: '',
  pcsx2: '',
  ppsspp: '',
  cemu: '',
  rpcs3: '',
  ds: '',
}

export const STARTER_GAMES: GameEntry[] = [
  {
    id: crypto.randomUUID(),
    title: 'Counter-Strike 2',
    kind: 'steam',
    target: '730',
    args: [],
  },
  {
    id: crypto.randomUUID(),
    title: 'Fortnite',
    kind: 'epic',
    target: 'Fortnite',
    args: [],
  },
]
