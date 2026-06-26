import type { CategoryMeta, GameEntry, LauncherKind } from '../types'

export const labels: Record<LauncherKind, string> = {
  steam: 'Steam',
  epic: 'Epic',
  battle_net: 'Battle.net',
  xbox: 'Xbox',
  emulator: 'Emulator',
  executable: 'Executable',
  uri: 'Custom URI',
}

export const DEFAULT_CATEGORY: CategoryMeta = {
  key: 'all',
  label: 'All',
  short: 'ALL',
  logoPath: '/platforms/all.svg',
}

function sourceFromArgs(args: string[] | undefined): string {
  if (!args || args.length === 0) {
    return ''
  }

  for (const raw of args) {
    const value = raw.trim()
    if (!value.startsWith('--tm-source=')) {
      continue
    }

    const source = value.slice('--tm-source='.length).trim().toLowerCase()
    if (!source) {
      continue
    }

    if (source === 'battle-net') {
      return 'battle_net'
    }

    if (source === 'xbox' || source === 'xbox_app') {
      return 'xbox_app'
    }

    return source
  }

  return ''
}

export function getGameSource(entry: Pick<GameEntry, 'kind' | 'target' | 'args'>): string {
  const kind = entry.kind.trim().toLowerCase()
  if (kind === 'steam' || kind === 'epic' || kind === 'battle_net' || kind === 'xbox') {
    if (kind === 'xbox') {
      return 'xbox_app'
    }

    return kind
  }

  if (kind === 'emulator') {
    return 'rom'
  }

  const source = sourceFromArgs(entry.args)
  if (source) {
    return source
  }

  const target = entry.target.trim().toLowerCase()
  if (target.startsWith('steam://')) {
    return 'steam'
  }

  if (
    target.includes('\\steamapps\\')
    || target.includes('/steamapps/')
    || target.includes('\\steam\\')
    || target.includes('/steam/')
  ) {
    return 'steam'
  }

  if (target.startsWith('com.epicgames.launcher://') || target === '__epic_launcher__') {
    return 'epic'
  }

  if (target.startsWith('battlenet://') || target === '__battle_net__') {
    return 'battle_net'
  }

  return ''
}

export function isLikelySteamEntry(entry: Pick<GameEntry, 'kind' | 'target' | 'args'>): boolean {
  if (getGameSource(entry) === 'steam') {
    return true
  }

  const target = entry.target.trim().toLowerCase()
  if (
    target.startsWith('steam://')
    || target.includes('\\steamapps\\')
    || target.includes('/steamapps/')
    || target.includes('appmanifest_')
  ) {
    return true
  }

  const args = entry.args ?? []
  return args.some((raw) => {
    const value = raw.trim().toLowerCase()
    if (!value || value.startsWith('--tm-')) {
      return false
    }

    return (
      value.startsWith('steam://')
      || value.includes('\\steamapps\\')
      || value.includes('/steamapps/')
      || value === '-applaunch'
      || value.startsWith('-applaunch=')
      || value.includes('steam_appid')
      || value.includes('appmanifest_')
    )
  })
}

function parseSteamAppIdFromText(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  const uriMatch = trimmed.match(/steam:\/\/(?:rungameid|run|launch|install)\/(\d+)/i)
  if (uriMatch?.[1]) {
    return Number(uriMatch[1])
  }

  const genericUriMatch = trimmed.match(/steam:\/\/[\w-]+\/(\d+)/i)
  if (genericUriMatch?.[1]) {
    return Number(genericUriMatch[1])
  }

  const appLaunchMatch = trimmed.match(/(?:^|\s)-applaunch(?:=|\s+)(\d+)/i)
  if (appLaunchMatch?.[1]) {
    return Number(appLaunchMatch[1])
  }

  const manifestMatch = trimmed.match(/appmanifest_(\d+)\.acf/i)
  if (manifestMatch?.[1]) {
    return Number(manifestMatch[1])
  }

  const appIdFlagMatch = trimmed.match(/(?:^|\s)--?(?:steam[_-]?)?app(?:lication)?[_-]?id(?:=|\s+)(\d+)/i)
  if (appIdFlagMatch?.[1]) {
    return Number(appIdFlagMatch[1])
  }

  return null
}

const EMULATOR_CATEGORY_MAP: Array<{ exts: string[]; key: string; label: string; short: string; logoPath: string }> = [
  { exts: ['nds', 'dsi', 'srl'], key: 'ds', label: 'Nintendo DS', short: 'D', logoPath: '/platforms/DS.svg' },
  { exts: ['3ds', 'cia', '3dsx', 'cci', 'cxi', 'app'], key: '3ds', label: 'Nintendo 3DS', short: '3DS', logoPath: '/platforms/3DS.svg' },
  { exts: ['n64', 'z64', 'v64'], key: 'n64', label: 'Nintendo 64', short: 'N64', logoPath: '/platforms/n64.svg' },
  { exts: ['nes', 'fds'], key: 'nes', label: 'NES', short: 'NES', logoPath: '/platforms/nes.svg' },
  { exts: ['sfc', 'smc', 'fig'], key: 'snes', label: 'SNES', short: 'SNES', logoPath: '/platforms/snes.svg' },
  { exts: ['gba', 'agb'], key: 'gba', label: 'Game Boy Advance', short: 'GBA', logoPath: '/platforms/gameboyadvance.svg' },
  { exts: ['gb', 'gbc', 'dmg'], key: 'gameboy', label: 'Game Boy', short: 'GB', logoPath: '/platforms/gameboy.svg' },
  { exts: ['gcm', 'gcz', 'dol'], key: 'gamecube', label: 'GameCube', short: 'GC', logoPath: '/platforms/gamecube.svg' },
  { exts: ['wbfs', 'rvz', 'wia', 'wad'], key: 'wii', label: 'Wii', short: 'WII', logoPath: '/platforms/wii.svg' },
  { exts: ['wud', 'wux', 'rpx'], key: 'wiiu', label: 'Wii U', short: 'WiiU', logoPath: '/platforms/wiiu.svg' },
  { exts: ['nsp', 'xci', 'nsz', 'nca'], key: 'switch', label: 'Nintendo Switch', short: 'NSW', logoPath: '/platforms/switch.svg' },
  { exts: ['md', 'gen', 'smd'], key: 'genesis', label: 'Sega Genesis', short: 'GEN', logoPath: '/platforms/genesis.svg' },
  { exts: ['gdi', 'cdi'], key: 'dreamcast', label: 'Sega Dreamcast', short: 'DC', logoPath: '/platforms/dreamcast.svg' },
  { exts: ['ps3', 'pkg', 'rap'], key: 'ps3', label: 'PlayStation 3', short: 'PS3', logoPath: '/platforms/ps3.svg' },
  { exts: ['iso', 'bin', 'mdf', 'nrg'], key: 'ps2', label: 'PlayStation 2', short: 'PS2', logoPath: '/platforms/ps2.svg' },
  { exts: ['cso', 'prx'], key: 'psp', label: 'PSP', short: 'PSP', logoPath: '/platforms/psp.svg' },
  { exts: ['cue', 'pbp', 'img'], key: 'ps1', label: 'PlayStation', short: 'PS1', logoPath: '/platforms/ps1.svg' },
]

function categoryByKey(key: string): CategoryMeta {
  const match = EMULATOR_CATEGORY_MAP.find((entry) => entry.key === key)
  if (match) {
    return {
      key: match.key,
      label: match.label,
      short: match.short,
      logoPath: match.logoPath,
    }
  }

  return { key: 'emulator', label: 'Emulator', short: 'EMU', logoPath: '/platforms/emulator.svg' }
}

function profileFromArgs(args: string[] | undefined): string {
  if (!args || args.length === 0) {
    return ''
  }

  for (const raw of args) {
    const value = raw.trim().toLowerCase()
    if (!value.startsWith('--tm-profile=')) {
      continue
    }

    return value.slice('--tm-profile='.length).trim()
  }

  return ''
}

function romPathFromArgs(args: string[] | undefined): string {
  if (!args || args.length === 0) {
    return ''
  }

  for (const raw of args) {
    const value = raw.trim()
    if (!value || value.toLowerCase().startsWith('--tm-')) {
      continue
    }

    return value
  }

  return ''
}

function categoryKeyFromRomPathHint(path: string): string | null {
  const lowered = path.trim().toLowerCase()
  if (!lowered) {
    return null
  }

  if (isDsRomPathHint(lowered)) return 'ds'
  if (lowered.includes('\\nintendo 3ds\\') || lowered.includes('/nintendo 3ds/') || lowered.includes('\\3ds\\') || lowered.includes('/3ds/')) return '3ds'
  if (lowered.includes('\\game boy advance\\') || lowered.includes('/game boy advance/') || lowered.includes('\\gba\\') || lowered.includes('/gba/')) return 'gba'
  if (lowered.includes('\\game boy\\') || lowered.includes('/game boy/') || lowered.includes('\\gb\\') || lowered.includes('/gb/') || lowered.includes('\\gbc\\') || lowered.includes('/gbc/')) return 'gameboy'
  if (lowered.includes('\\n64\\') || lowered.includes('/n64/') || lowered.includes('nintendo 64')) return 'n64'
  if (lowered.includes('\\nes\\') || lowered.includes('/nes/')) return 'nes'
  if (lowered.includes('\\snes\\') || lowered.includes('/snes/')) return 'snes'
  if (lowered.includes('\\gamecube\\') || lowered.includes('/gamecube/') || lowered.includes('game cube')) return 'gamecube'
  if (lowered.includes('\\wii u\\') || lowered.includes('/wii u/') || lowered.includes('\\wiiu\\') || lowered.includes('/wiiu/')) return 'wiiu'
  if (lowered.includes('\\wii\\') || lowered.includes('/wii/')) return 'wii'
  if (lowered.includes('\\switch\\') || lowered.includes('/switch/')) return 'switch'
  if (lowered.includes('\\sega genesis\\') || lowered.includes('/sega genesis/') || lowered.includes('genesis') || lowered.includes('mega drive')) return 'genesis'
  if (
    lowered.includes('\\dreamcast\\')
    || lowered.includes('/dreamcast/')
    || lowered.includes('sega dreamcast')
    || lowered.includes('dream cast')
  ) return 'dreamcast'
  if (lowered.includes('\\ps1\\') || lowered.includes('/ps1/') || lowered.includes('playstation 1')) return 'ps1'
  if (lowered.includes('\\ps2\\') || lowered.includes('/ps2/')) return 'ps2'
  if (lowered.includes('\\ps3\\') || lowered.includes('/ps3/')) return 'ps3'
  if (lowered.includes('\\psp\\') || lowered.includes('/psp/')) return 'psp'

  return null
}

function categoryKeyFromProfile(profile: string, extension: string, romPath: string): string | null {
  switch (profile) {
    case 'ds':
      return 'ds'
    case '3ds':
      return '3ds'
    case 'switch':
      return 'switch'
    case 'ps2':
      return 'ps2'
    case 'psp':
      return 'psp'
    case 'rpcs3':
      return 'ps3'
    case 'cemu':
      return 'wiiu'
    case 'dolphin': {
      if (extension === 'wbfs' || extension === 'rvz' || extension === 'wia' || extension === 'wad') {
        return 'wii'
      }

      if (extension === 'iso') {
        const lowered = romPath.toLowerCase()
        if (lowered.includes('\\wii\\') || lowered.includes('/wii/')) {
          return 'wii'
        }
      }

      return 'gamecube'
    }
    default:
      return null
  }
}

export function isDsRomPathHint(romPath: string): boolean {
  const lowered = romPath.trim().toLowerCase()
  if (!lowered) {
    return false
  }

  return (
    lowered.includes('\\ds\\') ||
    lowered.includes('/ds/') ||
    lowered.includes('\\nds\\') ||
    lowered.includes('/nds/') ||
    lowered.includes('nintendo ds') ||
    lowered.includes('nintendods') ||
    lowered.includes('melonds') ||
    lowered.includes('desmume') ||
    lowered.includes('(nds') ||
    lowered.includes(' nds') ||
    lowered.includes('ndsi')
  )
}

export function parseSteamAppId(entry: GameEntry): number | null {
  const targetAppId = parseSteamAppIdFromText(entry.target)
  if (targetAppId !== null) {
    return targetAppId
  }

  const launchArgs = entry.args ?? []

  for (const raw of launchArgs) {
    const value = raw.trim()
    if (!value || value.startsWith('--tm-')) {
      continue
    }

    const parsed = parseSteamAppIdFromText(value)
    if (parsed !== null) {
      return parsed
    }
  }

  for (let index = 0; index < launchArgs.length; index += 1) {
    const value = launchArgs[index]?.trim().toLowerCase()
    if (value !== '-applaunch') {
      continue
    }

    const next = launchArgs[index + 1]?.trim() ?? ''
    if (/^\d+$/.test(next)) {
      return Number(next)
    }
  }

  const source = getGameSource(entry)
  if (entry.kind !== 'steam' && source !== 'steam') {
    return null
  }

  return null
}

const RIOT_TITLE_HINTS = [
  'riot games',
  'league of legends',
  'valorant',
  'teamfight tactics',
  'legends of runeterra',
]

const RIOT_TARGET_HINTS = [
  'riotclient://',
  'riot client',
  'riotclientservices.exe',
  'leagueclient.exe',
  'valorant.exe',
  'valorant-win64-shipping.exe',
  '\\riot games\\',
  '/riot games/',
  '__riot_client__',
  '__riot_valorant__',
  '__riot_league__',
]

const RIOT_ARG_HINTS = [
  '--launch-product=',
  'league_of_legends',
  'valorant',
]

function isRiotGameEntry(entry: GameEntry, titleLower: string, targetLower: string): boolean {
  if (RIOT_TITLE_HINTS.some((hint) => titleLower.includes(hint))) {
    return true
  }

  if (RIOT_TARGET_HINTS.some((hint) => targetLower.includes(hint))) {
    return true
  }

  if (entry.kind === 'uri' && targetLower.startsWith('riotclient://')) {
    return true
  }

  return entry.args.some((arg) => {
    const lowered = arg.trim().toLowerCase()
    if (!lowered) {
      return false
    }

    return RIOT_ARG_HINTS.some((hint) => lowered.includes(hint))
  })
}

export function getGameCategory(entry: GameEntry): CategoryMeta {
  const titleLower = entry.title.trim().toLowerCase()
  const targetLower = entry.target.trim().toLowerCase()
  const source = getGameSource(entry)

  // Only executable user-assigned entries should use manual custom system keys.
  // ROM/emulator entries must keep platform categories (ds, gamecube, wii, etc.) for proper brand styling.
  if (entry.kind === 'executable' && entry.manualSystemKey && entry.manualSystemKey.startsWith('custom-')) {
    // Use the custom system key as the category
    return {
      key: entry.manualSystemKey,
      label: entry.manualSystemKey.replace('custom-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      short: entry.manualSystemKey.slice(7, 11).toUpperCase(),
      logoPath: '/platforms/emulator.svg', // Optionally customize per custom system
    }
  }

  if (source === 'steam') {
    return { key: 'steam', label: 'Steam', short: 'S', logoPath: '/platforms/steam.svg' }
  }

  if (source === 'epic') {
    return { key: 'epic', label: 'Epic', short: 'E', logoPath: '/platforms/epic.svg' }
  }

  if (source === 'battle_net') {
    return { key: 'battle-net', label: 'Battle.net', short: 'B', logoPath: '/platforms/battlenet.svg' }
  }

  if (source === 'xbox_app') {
    return { key: 'xbox', label: 'Xbox', short: 'X', logoPath: '/platforms/xbox.svg' }
  }

  if (entry.kind === 'emulator' || source === 'rom') {
    const romPath = romPathFromArgs(entry.args)
    const extension = romPath.includes('.') ? romPath.split('.').pop()?.toLowerCase() ?? '' : ''
    const profile = profileFromArgs(entry.args)
    const hintedCategoryKey = categoryKeyFromRomPathHint(romPath)

    if (
      isDsRomPathHint(romPath) ||
      targetLower.includes('melonds') ||
      targetLower.includes('desmume') ||
      titleLower.includes('nintendo ds') ||
      titleLower.includes('(ds)')
    ) {
      return { key: 'ds', label: 'Nintendo DS', short: 'D', logoPath: '/platforms/DS.svg' }
    }

    if (hintedCategoryKey) {
      return categoryByKey(hintedCategoryKey)
    }

    const profileCategoryKey = categoryKeyFromProfile(profile, extension, romPath)
    if (profileCategoryKey) {
      return categoryByKey(profileCategoryKey)
    }

    const match = EMULATOR_CATEGORY_MAP.find((item) => item.exts.includes(extension))
    if (match) {
      return {
        key: match.key,
        label: match.label,
        short: match.short,
        logoPath: match.logoPath,
      }
    }

    return { key: 'emulator', label: 'Emulator', short: 'EMU', logoPath: '/platforms/emulator.svg' }
  }

  if (
    titleLower.includes('battle.net') ||
    titleLower.includes('battle net') ||
    targetLower.startsWith('battlenet://') ||
    targetLower.includes('battle.net launcher.exe') ||
    targetLower.includes('battle.net.exe') ||
    targetLower === '__battle_net__'
  ) {
    return { key: 'battle-net', label: 'Battle.net', short: 'B', logoPath: '/platforms/battlenet.svg' }
  }

  if (
    titleLower.includes('minecraft') ||
    targetLower.startsWith('minecraft://') ||
    targetLower.startsWith('minecraft-launcher://') ||
    targetLower.includes('minecraftlauncher.exe') ||
    targetLower === '__minecraft_launcher__' ||
    targetLower === '__minecraft_java__'
  ) {
    return { key: 'minecraft', label: 'Minecraft', short: 'M', logoPath: '/platforms/minecraft.svg' }
  }

  if (
    titleLower.includes('roblox') ||
    targetLower.startsWith('roblox://') ||
    targetLower.includes('robloxplayerbeta.exe') ||
    targetLower.includes('robloxstudiobeta.exe') ||
    targetLower === '__roblox_player__' ||
    targetLower === '__roblox_studio__'
  ) {
    return { key: 'roblox', label: 'Roblox', short: 'R', logoPath: '/platforms/roblox.svg' }
  }

  if (isRiotGameEntry(entry, titleLower, targetLower)) {
    return { key: 'riot', label: 'Riot Games', short: 'R', logoPath: '/platforms/riot.svg' }
  }

  return { key: 'links', label: 'Links', short: 'URL', logoPath: '/platforms/uri.svg' }
}

export function formatPlaytimeMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(safeMinutes / 60)
  const remainingMinutes = safeMinutes % 60

  if (hours <= 0) {
    return `${remainingMinutes}m`
  }

  if (remainingMinutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainingMinutes}m`
}

export function formatLastPlayedShort(timestampMs: number, nowMs = Date.now()): string {
  const safeTimestamp = Number.isFinite(timestampMs) ? Math.floor(timestampMs) : 0
  const safeNow = Number.isFinite(nowMs) ? Math.floor(nowMs) : Date.now()

  if (safeTimestamp <= 0) {
    return 'Never'
  }

  const diffMs = Math.max(0, safeNow - safeTimestamp)
  const hourMs = 60 * 60 * 1000
  const dayMs = 24 * hourMs

  if (diffMs < hourMs) {
    return 'Now'
  }

  if (diffMs < dayMs) {
    return 'Today'
  }

  const days = Math.floor(diffMs / dayMs)
  if (days < 7) {
    return `${days}d ago`
  }

  const weeks = Math.floor(days / 7)
  if (weeks < 8) {
    return `${weeks}w ago`
  }

  const months = Math.floor(days / 30)
  if (months < 24) {
    return `${months}mo ago`
  }

  const years = Math.floor(days / 365)
  return `${years}y ago`
}
