import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { listen } from '@tauri-apps/api/event'
import { isTauri } from '@tauri-apps/api/core'

import { openDialog } from '../../../services/dialogService'
import { resolveDialogDefaultDirectory, resolveDialogDefaultDirectoryFromCandidates } from '../../../utils/dialogDefaultPath'
import {
  autoImportGamesOrchestrated,
  cacheCoverThumbnail,
  cacheCoverThumbnailTiers,
  getConnectorHealth,
  getProcessRunningStatus,
  getBattleNetCoverArt,
  getCachedCoverThumbnail,
  getCachedCoverThumbnailTier,
  getEpicCoverArt,
  getXboxCoverArt,
  getRomMetadataArt,
  getSteamAchievements,
  getSteamCoverArt,
  getSteamCoverArtForEntry,
  getSteamPlaytime,
  extractExeIconDataUrl,
  ensureRetroArchCore,
  launchGame as launchGameCommand,
  readLocalImageAsDataUrl,
  steamBrowserLoginPoll,
  steamBrowserLoginStart,
  testSteamConnection as testSteamConnectionCommand,
} from '../../../services/launcherService'
import { SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY } from '../constants'
import type {
  AchievementFilter,
  AppTab,
  ConnectorHealth,
  CoverAspectBucket,
  CoverArtMetadata,
  CustomCoverCropRequest,
  CustomCoverCropSelection,
  CoverSourceProvenance,
  CoverSourceTier,
  CoverArtStatus,
  CoverFitMode,
  CoverResolutionTier,
  EmulatorKey,
  GameEntry,
  GameLibraryMeta,
  ImportSettings,
  LauncherControllerBindsBySystem,
  SteamControllerCoexistenceMode,
  SteamAchievementsResponse,
} from '../types'
import { buildControllerLaunchArgsForSystem } from '../utils/controllerBindings'
import { buildPlatformPeripheralLaunchArgs } from '../utils/platformPeripherals'
import { resolveControllerSystemKeyForLaunch } from '../utils/resolveControllerSystemKeyForLaunch'
import type { PlatformPeripheralsBySystem } from '../utils/platformPeripherals'
import { decodeLaunchError } from '../utils/launchErrors'
import { getGameCategory, getGameSource, isLikelySteamEntry, parseSteamAppId } from '../utils/category'
import { cleanRomTitleMetadata, normalizeGameTitle } from '../utils/search'
import { emitSignatureRungoReaction } from '../utils/signatureRungoReaction'

const LEGACY_MANAGED_TITLES = new Set([
  'Minecraft Bedrock',
  'Minecraft Java',
  'Minecraft Launcher',
  'Battle.net',
  'Riot Client',
  'VALORANT',
  'League of Legends',
  'Roblox',
  'Roblox Studio',
  'Epic Games Launcher',
  'EA App',
  'Ubisoft Connect',
  'Xbox App',
])

function managedArgValue(args: string[] | undefined, key: string): string | null {
  if (!args || args.length === 0) {
    return null
  }

  const prefix = `--tm-${key.toLowerCase()}=`
  for (const rawArg of args) {
    const value = rawArg.trim()
    if (!value.toLowerCase().startsWith(prefix)) {
      continue
    }

    const parsed = value.slice(prefix.length).trim()
    if (parsed.length > 0) {
      return parsed
    }
  }

  return null
}

function sourceFromArgs(args: string[] | undefined): string | null {
  const source = managedArgValue(args, 'source')
  return source ? source.toLowerCase() : null
}

function profileFromArgs(args: string[] | undefined): string | null {
  const profile = managedArgValue(args, 'profile')
  return profile ? profile.toLowerCase() : null
}

function inferRomProfileFromPath(romPath: string, explicitProfile: string | null): string | null {
  const normalizedPath = romPath.trim().toLowerCase()
  const normalizedExplicitProfile = explicitProfile?.trim().toLowerCase() ?? null

  if (normalizedExplicitProfile && normalizedExplicitProfile !== 'retroarch') {
    return normalizedExplicitProfile
  }

  if (!normalizedPath) {
    return normalizedExplicitProfile
  }

  const extension = normalizedPath.includes('.')
    ? normalizedPath.slice(normalizedPath.lastIndexOf('.') + 1)
    : ''

  switch (extension) {
    case 'nds':
    case 'dsi':
    case 'srl':
      return 'ds'
    case '3ds':
    case '3dsx':
    case 'cia':
    case 'cci':
    case 'cxi':
    case 'app':
    case 'smdh':
      return '3ds'
    case 'wbfs':
    case 'rvz':
    case 'rvs':
    case 'wia':
    case 'gcm':
    case 'gcz':
    case 'dol':
      return 'dolphin'
    case 'wud':
    case 'wux':
    case 'rpx':
    case 'wua':
      return 'cemu'
    case 'ps3':
    case 'pkg':
      return 'rpcs3'
    case 'cso':
    case 'prx':
      return 'psp'
    case 'nsp':
    case 'xci':
    case 'nsz':
    case 'nca':
      return 'switch'
    case 'gdi':
    case 'cdi':
      return 'dreamcast'
    default:
      break
  }

  if (
    normalizedPath.includes('sega dreamcast')
    || normalizedPath.includes('dream cast')
    || normalizedPath.includes('/dreamcast/')
    || normalizedPath.includes('\\dreamcast\\')
    || normalizedPath.includes('/dc/')
    || normalizedPath.includes('\\dc\\')
  ) {
    return 'dreamcast'
  }

  if (normalizedPath.includes('nintendo 3ds') || normalizedPath.includes('/3ds/') || normalizedPath.includes('\\3ds\\')) {
    return '3ds'
  }

  if (normalizedPath.includes('nintendo ds') || normalizedPath.includes('/nds/') || normalizedPath.includes('\\nds\\')) {
    return 'ds'
  }

  if (normalizedPath.includes('gamecube') || normalizedPath.includes('wii') || normalizedPath.includes('/dolphin/')) {
    return 'dolphin'
  }

  return normalizedExplicitProfile
}

function firstLaunchArgRaw(args: string[] | undefined): string {
  if (!args || args.length === 0) {
    return ''
  }

  for (const raw of args) {
    const value = raw.trim()
    if (!value || value.startsWith('--tm-')) {
      continue
    }

    return value
  }

  return ''
}

function isManagedEntry(entry: Pick<GameEntry, 'title' | 'args'>): boolean {
  const args = entry.args || []
  return args.includes('--tm-managed=1') || sourceFromArgs(args) !== null || LEGACY_MANAGED_TITLES.has(entry.title)
}

function firstLaunchArg(args: string[] | undefined): string {
  return firstLaunchArgRaw(args).toLowerCase()
}

function managedIdentityKey(entry: Pick<GameEntry, 'title' | 'kind' | 'target' | 'args'>): string {
  const source = sourceFromArgs(entry.args || []) || ''
  const kind = entry.kind.trim().toLowerCase()
  const target = entry.target.trim().toLowerCase()
  const title = normalizeGameTitle(entry.title).trim().toLowerCase()

  if (kind === 'steam' || source === 'steam') {
    return `steam::${target || title}`
  }

  if (kind === 'battle_net' || source === 'battle_net') {
    return `battle_net::${target || title}`
  }

  if (kind === 'emulator' || source === 'rom') {
    const rom = firstLaunchArg(entry.args)
    return `emulator::${rom || target || title}`
  }

  if (source) {
    return `${source}::${target || title}`
  }

  return `${kind}::${target || title}`
}

function normalizedImportedTitle(entry: Pick<GameEntry, 'title' | 'args'>, romTitleCleanupEnabled: boolean): string {
  const normalizedTitle = normalizeGameTitle(entry.title)
  if (!romTitleCleanupEnabled) {
    return normalizedTitle
  }

  if (sourceFromArgs(entry.args) !== 'rom') {
    return normalizedTitle
  }

  return cleanRomTitleMetadata(normalizedTitle)
}

function isRedundantLauncherLink(entry: Pick<GameEntry, 'target'>): boolean {
  const target = entry.target.trim().toLowerCase()
  return [
    '__battle_net__',
    '__epic_launcher__',
    '__ea_app__',
    '__ubisoft_connect__',
    '__xbox_app__',
    '__riot_client__',
    '__minecraft_launcher__',
  ].includes(target)
}

function inferEmulatorKeyFromExecutablePath(pathValue: string): EmulatorKey | null {
  const normalized = pathValue.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized.includes('azahar') || normalized.includes('citra')) {
    return '3ds'
  }
  if (normalized.includes('retroarch')) {
    return 'retroarch'
  }
  if (normalized.includes('dolphin')) {
    return 'dolphin'
  }
  if (normalized.includes('pcsx2')) {
    return 'pcsx2'
  }
  if (normalized.includes('ppsspp')) {
    return 'ppsspp'
  }
  if (normalized.includes('cemu')) {
    return 'cemu'
  }
  if (normalized.includes('rpcs3')) {
    return 'rpcs3'
  }
  if (normalized.includes('melonds') || normalized.includes('desmume')) {
    return 'ds'
  }

  return null
}

function normalizeEmulatorKey(value: unknown): EmulatorKey | null {
  switch (value) {
    case '3ds':
    case 'retroarch':
    case 'dolphin':
    case 'pcsx2':
    case 'ppsspp':
    case 'cemu':
    case 'rpcs3':
    case 'ds':
      return value
    default:
      return null
  }
}

function emulatorKeyFromProfileArg(args: string[] | undefined): EmulatorKey | null {
  const profile = profileFromArgs(args)
  if (!profile) {
    return null
  }

  switch (profile) {
    case '3ds':
      return '3ds'
    case 'dreamcast':
    case 'retroarch':
    case 'switch':
      return 'retroarch'
    case 'dolphin':
      return 'dolphin'
    case 'ps2':
    case 'pcsx2':
      return 'pcsx2'
    case 'psp':
    case 'ppsspp':
      return 'ppsspp'
    case 'cemu':
      return 'cemu'
    case 'rpcs3':
      return 'rpcs3'
    case 'ds':
      return 'ds'
    default:
      return null
  }
}

function mappedSystemEmulatorKey(entry: GameEntry, systemEmulatorMap: Record<string, EmulatorKey>): EmulatorKey | null {
  const categoryKey = getGameCategory(entry).key
  const mappingKey = SYSTEM_CATEGORY_TO_IMPORT_MAP_KEY[categoryKey]
  if (!mappingKey) {
    return null
  }

  return normalizeEmulatorKey(systemEmulatorMap[mappingKey])
}

function isSpecialLauncherTarget(target: string): boolean {
  const trimmed = target.trim()
  return trimmed.startsWith('__') && trimmed.endsWith('__')
}

function withPlatformLaunchArgs(existingArgs: string[], extraArgs: string[]): string[] {
  if (extraArgs.length === 0) {
    return [...existingArgs]
  }

  const normalized = existingArgs.filter((rawArg) => {
    const candidate = rawArg.trim().toLowerCase()
    return !candidate.startsWith('--tm-controller-layout=')
      && !candidate.startsWith('--tm-controller-map=')
      && !candidate.startsWith('--tm-peripheral=')
  })

  normalized.push(...extraArgs)
  return normalized
}

function emulatorLabelForKey(emulatorKey: EmulatorKey): string {
  switch (emulatorKey) {
    case '3ds':
      return 'Nintendo 3DS (Azahar / Citra)'
    case 'retroarch':
      return 'RetroArch'
    case 'dolphin':
      return 'Dolphin'
    case 'pcsx2':
      return 'PCSX2'
    case 'ppsspp':
      return 'PPSSPP'
    case 'cemu':
      return 'Cemu'
    case 'rpcs3':
      return 'RPCS3'
    case 'ds':
      return 'Nintendo DS (melonDS / DeSmuME)'
    default:
      return emulatorKey
  }
}

const COVER_CACHE_TARGET_WIDTH = 420
const COVER_CACHE_TARGET_HEIGHT = 630
const COVER_CACHE_FAST_WIDTH = 320
const COVER_CACHE_FAST_HEIGHT = 480
const ROM_COVER_CACHE_KEY_VERSION = 'v3'
const COVER_MAX_RETRY_ATTEMPTS = 3
const COVER_RETRY_BASE_DELAY_MS = 900
const COVER_GRID_PRIMARY_TIER = 'grid-xs' as const
const COVER_DETAIL_TIER = 'detail' as const
const COVER_LOOKUP_CONCURRENCY = 3
const ROM_EMBEDDED_ART_PROFILES = new Set(['ds', '3ds'])
const ENABLE_ROM_ONLINE_COVER_FALLBACK = true
const PROCESS_PLAYTIME_POLL_MS = 12000
const PROCESS_PLAYTIME_POLL_ACTIVE_MS = 2500
const MIN_TRACKABLE_PLAY_SESSION_MS = 15000
const PROCESS_HANDOFF_GRACE_MS = 18000
const PROCESS_NOT_RUNNING_CONFIRM_POLLS = 2
const PROCESS_UNKNOWN_CONFIRM_POLLS = 4
const EXTERNAL_WAKE_COOLDOWN_MS = 250
const URI_EXTERNAL_LOCK_MIN_MS = 6000
const URI_EXTERNAL_LOCK_MAX_MS = 60000
const STEAM_URI_EXTERNAL_LOCK_MIN_MS = 14000
const STEAM_URI_EXTERNAL_RETURN_STABLE_MS = 1300
const STEAM_URI_EXTERNAL_LOCK_MAX_MS = 180000
const ACTIVE_PLAYTIME_SESSIONS_STORAGE_KEY = 'tile-manager-active-playtime-sessions-v1'
const ACTIVE_PLAYTIME_SESSIONS_STORAGE_VERSION = 2
const CUSTOM_COVER_CROP_VIEW_SIZE = 232
const CUSTOM_COVER_CROP_MIN_ZOOM = 1
const CUSTOM_COVER_CROP_MAX_ZOOM = 3
const CUSTOM_COVER_CROP_MIN_FRAME_RATIO = 0.36
const CUSTOM_COVER_CROP_MAX_FRAME_RATIO = 1
const CUSTOM_COVER_MAX_DATA_URL_LENGTH = 360000
const CUSTOM_COVER_EDGE_STEPS_CROPPED = [768, 640, 512, 448, 384, 320]
const CUSTOM_COVER_EDGE_STEPS_FULL = [1024, 900, 768, 640, 512, 448, 384, 320]

function getSteamUriLockTimings(mode: SteamControllerCoexistenceMode): {
  minMs: number
  maxMs: number
  returnStableMs: number
} {
  switch (mode) {
    case 'prefer_steam':
      return {
        minMs: Math.max(STEAM_URI_EXTERNAL_LOCK_MIN_MS, 18000),
        maxMs: Math.max(STEAM_URI_EXTERNAL_LOCK_MAX_MS, 240000),
        returnStableMs: Math.max(STEAM_URI_EXTERNAL_RETURN_STABLE_MS, 1800),
      }
    case 'prefer_tilezu':
      return {
        minMs: 3000,
        maxMs: 30000,
        returnStableMs: 700,
      }
    case 'balanced':
    default:
      return {
        minMs: STEAM_URI_EXTERNAL_LOCK_MIN_MS,
        maxMs: STEAM_URI_EXTERNAL_LOCK_MAX_MS,
        returnStableMs: STEAM_URI_EXTERNAL_RETURN_STABLE_MS,
      }
  }
}

type CustomCoverCropMetrics = {
  displayScale: number
  displayWidth: number
  displayHeight: number
  frameWidth: number
  frameHeight: number
  maxOffsetX: number
  maxOffsetY: number
}

function isLikelyTinyCoverDataUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }

  const source = value.trim()
  return source.startsWith('data:image/') && source.length < 2600
}

function pickGridCoverVariant(...candidates: Array<string | null | undefined>): string | null {
  const existing = candidates.filter((candidate): candidate is string => Boolean(candidate && candidate.trim()))
  if (existing.length === 0) {
    return null
  }

  for (const candidate of existing) {
    if (!isLikelyTinyCoverDataUrl(candidate)) {
      return candidate
    }
  }

  return existing[0]
}

function resolveCoverSourceTierFromCandidates(
  selected: string | null | undefined,
  candidates: Record<CoverSourceTier, string | null | undefined>,
): CoverSourceTier {
  if (!selected) {
    return 'unknown'
  }

  const orderedTiers: CoverSourceTier[] = ['grid-xs', 'grid-md', 'detail', 'legacy', 'source', 'custom', 'unknown']
  for (const tier of orderedTiers) {
    const candidate = candidates[tier]
    if (candidate && candidate === selected) {
      return tier
    }
  }

  return 'unknown'
}

async function runTasksWithConcurrency<T>(
  items: T[],
  concurrency: number,
  isCancelled: () => boolean,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  let nextIndex = 0

  const runWorker = async () => {
    while (!isCancelled()) {
      const index = nextIndex
      nextIndex += 1
      if (index >= items.length) {
        return
      }

      await worker(items[index])
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
}

function buildCoverCacheKey(entry: Pick<GameEntry, 'kind' | 'target' | 'title' | 'args'>): string {
  const normalizedTitle = normalizeGameTitle(entry.title).trim().toLowerCase()
  const normalizedTarget = entry.target.trim().toLowerCase()
  const source = sourceFromArgs(entry.args)

  if (entry.kind === 'emulator' || source === 'rom') {
    const romPath = firstLaunchArgRaw(entry.args).trim().toLowerCase()
    const profile = inferRomProfileFromPath(romPath, profileFromArgs(entry.args)) ?? ''
    return `rom::${ROM_COVER_CACHE_KEY_VERSION}::${profile}::${romPath || normalizedTarget}::${normalizedTitle}`
  }

  return `${entry.kind}::${normalizedTarget}::${normalizedTitle}`
}

function fileStemFromPath(pathValue: string): string {
  const normalized = pathValue.trim()
  if (!normalized) {
    return ''
  }

  const fileName = normalized.split(/[\\/]/).pop() ?? normalized
  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex <= 0) {
    return fileName.trim()
  }

  return fileName.slice(0, extensionIndex).trim()
}

function shouldAdoptRomMetadataTitle(entry: Pick<GameEntry, 'title'>, romPath: string, metadataTitle: string): boolean {
  const normalizedMetadataTitle = normalizeGameTitle(metadataTitle).trim().toLowerCase()
  if (!normalizedMetadataTitle) {
    return false
  }

  const normalizedCurrentTitle = normalizeGameTitle(entry.title).trim().toLowerCase()
  if (!normalizedCurrentTitle || normalizedCurrentTitle === normalizedMetadataTitle) {
    return false
  }

  const normalizedFileStem = normalizeGameTitle(fileStemFromPath(romPath)).trim().toLowerCase()
  if (!normalizedFileStem) {
    return true
  }

  return normalizedCurrentTitle === normalizedFileStem
}

function getRetryDelayMs(attempt: number): number {
  return COVER_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt)
}

function loadImageElementFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image decode failed'))
    image.src = dataUrl
  })
}

function clampCustomCoverFrameRatio(value: number): number {
  return Math.max(CUSTOM_COVER_CROP_MIN_FRAME_RATIO, Math.min(CUSTOM_COVER_CROP_MAX_FRAME_RATIO, value))
}

function getCustomCoverCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  selection: Pick<CustomCoverCropSelection, 'zoom' | 'frameWidthRatio' | 'frameHeightRatio'>,
): CustomCoverCropMetrics {
  const boundedZoom = Math.max(CUSTOM_COVER_CROP_MIN_ZOOM, Math.min(CUSTOM_COVER_CROP_MAX_ZOOM, selection.zoom))
  const frameWidth = CUSTOM_COVER_CROP_VIEW_SIZE * clampCustomCoverFrameRatio(selection.frameWidthRatio)
  const frameHeight = CUSTOM_COVER_CROP_VIEW_SIZE * clampCustomCoverFrameRatio(selection.frameHeightRatio)
  const baseScale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight)
  const displayScale = baseScale * boundedZoom
  const displayWidth = naturalWidth * displayScale
  const displayHeight = naturalHeight * displayScale
  const maxOffsetX = Math.max(0, (displayWidth - frameWidth) / 2)
  const maxOffsetY = Math.max(0, (displayHeight - frameHeight) / 2)

  return {
    displayScale,
    displayWidth,
    displayHeight,
    frameWidth,
    frameHeight,
    maxOffsetX,
    maxOffsetY,
  }
}

function clampCustomCoverCropSelection(
  request: CustomCoverCropRequest,
  selection: CustomCoverCropSelection,
): CustomCoverCropSelection {
  const zoom = Math.max(CUSTOM_COVER_CROP_MIN_ZOOM, Math.min(CUSTOM_COVER_CROP_MAX_ZOOM, selection.zoom))
  const frameWidthRatio = clampCustomCoverFrameRatio(selection.frameWidthRatio)
  const frameHeightRatio = clampCustomCoverFrameRatio(selection.frameHeightRatio)
  const metrics = getCustomCoverCropMetrics(request.naturalWidth, request.naturalHeight, {
    zoom,
    frameWidthRatio,
    frameHeightRatio,
  })

  return {
    zoom,
    offsetX: Math.max(-metrics.maxOffsetX, Math.min(metrics.maxOffsetX, selection.offsetX)),
    offsetY: Math.max(-metrics.maxOffsetY, Math.min(metrics.maxOffsetY, selection.offsetY)),
    frameWidthRatio,
    frameHeightRatio,
  }
}

async function drawCustomCoverCropCanvas(
  request: CustomCoverCropRequest,
  selection: CustomCoverCropSelection,
): Promise<HTMLCanvasElement> {
  const image = await loadImageElementFromDataUrl(request.sourceDataUrl)
  const normalized = clampCustomCoverCropSelection(request, selection)
  const metrics = getCustomCoverCropMetrics(request.naturalWidth, request.naturalHeight, normalized)
  const imageLeft = (CUSTOM_COVER_CROP_VIEW_SIZE - metrics.displayWidth) / 2 + normalized.offsetX
  const imageTop = (CUSTOM_COVER_CROP_VIEW_SIZE - metrics.displayHeight) / 2 + normalized.offsetY
  const frameLeft = (CUSTOM_COVER_CROP_VIEW_SIZE - metrics.frameWidth) / 2
  const frameTop = (CUSTOM_COVER_CROP_VIEW_SIZE - metrics.frameHeight) / 2

  const sourceX = Math.max(0, (frameLeft - imageLeft) / metrics.displayScale)
  const sourceY = Math.max(0, (frameTop - imageTop) / metrics.displayScale)
  const sourceWidth = Math.min(request.naturalWidth - sourceX, metrics.frameWidth / metrics.displayScale)
  const sourceHeight = Math.min(request.naturalHeight - sourceY, metrics.frameHeight / metrics.displayScale)

  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Crop region is invalid. Adjust zoom or crop size and try again.')
  }

  const outputWidth = Math.max(1, Math.round(sourceWidth))
  const outputHeight = Math.max(1, Math.round(sourceHeight))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Crop rendering context unavailable')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  )

  return canvas
}

function scaleCanvasToMaxEdge(source: HTMLCanvasElement, maxEdge: number): HTMLCanvasElement {
  const normalizedMaxEdge = Math.max(1, Math.floor(maxEdge))
  const currentMaxEdge = Math.max(source.width, source.height)
  if (currentMaxEdge <= normalizedMaxEdge) {
    return source
  }

  const scale = normalizedMaxEdge / currentMaxEdge
  const outputWidth = Math.max(1, Math.round(source.width * scale))
  const outputHeight = Math.max(1, Math.round(source.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight
  const context = canvas.getContext('2d')
  if (!context) {
    return source
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, outputWidth, outputHeight)
  return canvas
}

function tryEncodeCanvasDataUrl(canvas: HTMLCanvasElement, mimeType: string, quality: number): string | null {
  try {
    return canvas.toDataURL(mimeType, quality)
  } catch {
    return null
  }
}

function encodeCanvasToManagedDataUrl(
  source: HTMLCanvasElement,
  edgeSteps: readonly number[],
  fallbackErrorMessage: string,
): string {
  const qualitySteps = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52]
  let smallestCandidate: string | null = null

  for (const edge of edgeSteps) {
    const workingCanvas = scaleCanvasToMaxEdge(source, edge)

    for (const mimeType of ['image/webp', 'image/jpeg']) {
      for (const quality of qualitySteps) {
        const candidate = tryEncodeCanvasDataUrl(workingCanvas, mimeType, quality)
        if (!candidate) {
          continue
        }

        if (!smallestCandidate || candidate.length < smallestCandidate.length) {
          smallestCandidate = candidate
        }

        if (candidate.length <= CUSTOM_COVER_MAX_DATA_URL_LENGTH) {
          return candidate
        }
      }
    }
  }

  if (smallestCandidate && smallestCandidate.length <= CUSTOM_COVER_MAX_DATA_URL_LENGTH) {
    return smallestCandidate
  }

  throw new Error(fallbackErrorMessage)
}

async function cropCustomCoverToOptimizedDataUrl(
  request: CustomCoverCropRequest,
  selection: CustomCoverCropSelection,
): Promise<string> {
  const croppedCanvas = await drawCustomCoverCropCanvas(request, selection)
  return encodeCanvasToManagedDataUrl(
    croppedCanvas,
    CUSTOM_COVER_EDGE_STEPS_CROPPED,
    'Cropped cover is still too large to store. Try a tighter crop or use full-art compression.',
  )
}

async function compressCustomCoverFullArtToOptimizedDataUrl(request: CustomCoverCropRequest): Promise<string> {
  const image = await loadImageElementFromDataUrl(request.sourceDataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(request.naturalWidth))
  canvas.height = Math.max(1, Math.round(request.naturalHeight))

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Cover compression context unavailable')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return encodeCanvasToManagedDataUrl(
    canvas,
    CUSTOM_COVER_EDGE_STEPS_FULL,
    'Full-size cover is still too large to store. Try cropping it before saving.',
  )
}

function classifyCoverFailure(error: unknown): CoverArtStatus {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  if (
    message.includes('timeout')
    || message.includes('timed out')
    || message.includes('network')
    || message.includes('temporar')
    || message.includes('too many requests')
    || message.includes('429')
    || message.includes('503')
    || message.includes('502')
  ) {
    return 'failed-transient'
  }

  return 'failed-permanent'
}

function classifyAspectBucket(aspectRatio: number): CoverAspectBucket {
  if (aspectRatio > 1.8) {
    return 'ultra-wide'
  }

  if (aspectRatio > 1.22) {
    return 'landscape'
  }

  if (aspectRatio < 0.78) {
    return 'portrait'
  }

  return 'near-square'
}

function classifyFitMode(aspectRatio: number): { fitMode: CoverFitMode; objectPositionY?: string } {
  if (aspectRatio > 1.8) {
    return { fitMode: 'contain' }
  }

  if (aspectRatio > 1.22) {
    return { fitMode: 'contain', objectPositionY: '50%' }
  }

  if (aspectRatio < 0.78) {
    return { fitMode: 'contain' }
  }

  return { fitMode: 'cover', objectPositionY: '50%' }
}

function classifyResolutionTier(width: number, height: number): CoverResolutionTier {
  const minSide = Math.min(width, height)
  if (minSide < 180) {
    return 'low'
  }

  if (minSide < 420) {
    return 'medium'
  }

  return 'high'
}

async function measureCoverMetadata(coverSource: string): Promise<CoverArtMetadata | null> {
  if (typeof window === 'undefined' || !coverSource) {
    return null
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.decoding = 'async'

    image.onload = () => {
      const width = image.naturalWidth || 0
      const height = image.naturalHeight || 0
      if (width <= 0 || height <= 0) {
        resolve(null)
        return
      }

      const aspectRatio = width / height
      const aspectBucket = classifyAspectBucket(aspectRatio)
      const { fitMode, objectPositionY } = classifyFitMode(aspectRatio)
      const resolutionTier = classifyResolutionTier(width, height)
      let dominantColor = 'rgba(74, 110, 154, 0.44)'

      try {
        const canvas = document.createElement('canvas')
        canvas.width = 10
        canvas.height = 10
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
          let red = 0
          let green = 0
          let blue = 0
          let count = 0

          for (let index = 0; index < data.length; index += 4) {
            const alpha = data[index + 3]
            if (alpha <= 0) {
              continue
            }

            red += data[index]
            green += data[index + 1]
            blue += data[index + 2]
            count += 1
          }

          if (count > 0) {
            dominantColor = `rgba(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)}, 0.46)`
          }
        }
      } catch {
      }

      resolve({
        width,
        height,
        aspectRatio,
        aspectBucket,
        fitMode,
        resolutionTier,
        dominantColor,
        measuredAt: Date.now(),
        objectPositionY,
      })
    }

    image.onerror = () => {
      resolve(null)
    }

    image.src = coverSource
  })
}

type UseLauncherLibraryActionsParams = {
  isDeferredStartupReady: boolean
  lowPowerModeEnabled: boolean
  steamControllerCoexistenceMode: SteamControllerCoexistenceMode
  steamApiKey: string
  steamId: string
  library: GameEntry[]
  playtimeMinutesByGame: Record<string, number>
  playtimeLookupDone: Record<string, boolean>
  coverArtByGame: Record<string, string>
  coverArtThumbByGame: Record<string, string>
  coverArtStatusByGame: Record<string, CoverArtStatus>
  customCoverByGame: Record<string, string>
  achievementByGame: Record<string, SteamAchievementsResponse>
  achievementModalGameId: string | null
  achievementSearch: string
  achievementFilter: AchievementFilter
  emulatorPaths: Record<EmulatorKey, string>
  systemEmulatorMap: Record<string, EmulatorKey>
  controllerBindsBySystem: LauncherControllerBindsBySystem
  platformPeripheralsBySystem: PlatformPeripheralsBySystem
  romTitleCleanupEnabled: boolean
  titleOverridesByManagedKey: Record<string, string>
  romDirsText: string
  setRomDirsText: Dispatch<SetStateAction<string>>
  launcherView: 'systems' | 'games'
  gamesViewMode: 'list' | 'grid'
  isPerformanceFirstMode: boolean
  launchWipeTimerRef: MutableRefObject<number | null>
  setPlaytimeMinutesByGame: Dispatch<SetStateAction<Record<string, number>>>
  setPlaytimeLookupDone: Dispatch<SetStateAction<Record<string, boolean>>>
  setCoverArtByGame: Dispatch<SetStateAction<Record<string, string>>>
  setCoverArtThumbByGame: Dispatch<SetStateAction<Record<string, string>>>
  setCoverArtStatusByGame: Dispatch<SetStateAction<Record<string, CoverArtStatus>>>
  setCoverArtMetaByGame: Dispatch<SetStateAction<Record<string, CoverArtMetadata>>>
  setCoverSourceByGame: Dispatch<SetStateAction<Record<string, CoverSourceProvenance>>>
  setLibrary: Dispatch<SetStateAction<GameEntry[]>>
  setGameMetaById: Dispatch<SetStateAction<Record<string, GameLibraryMeta>>>
  setAchievementByGame: Dispatch<SetStateAction<Record<string, SteamAchievementsResponse>>>
  setCustomCoverByGame: Dispatch<SetStateAction<Record<string, string>>>
  setIsImporting: Dispatch<SetStateAction<boolean>>
  setStatus: Dispatch<SetStateAction<string>>
  setLoadingAchievements: Dispatch<SetStateAction<Record<string, boolean>>>
  setAchievementModalGameId: Dispatch<SetStateAction<string | null>>
  setAchievementSearch: Dispatch<SetStateAction<string>>
  setAchievementFilter: Dispatch<SetStateAction<AchievementFilter>>
  setEmulatorPaths: Dispatch<SetStateAction<Record<EmulatorKey, string>>>
  setTitleOverridesByManagedKey: Dispatch<SetStateAction<Record<string, string>>>
  setIsSteamLoginBusy: Dispatch<SetStateAction<boolean>>
  setSteamId: Dispatch<SetStateAction<string>>
  setIsSteamTestBusy: Dispatch<SetStateAction<boolean>>
  setIsLaunchWipeActive: Dispatch<SetStateAction<boolean>>
  setFocusedGameId: Dispatch<SetStateAction<string | null>>
  setActiveTab: Dispatch<SetStateAction<AppTab>>
  removeGameScreenshots: (gameId: string) => void
  playFavoriteToggleSound: (wasFavorite: boolean) => void
  gameKey: (entry: { title: string; kind: string; target: string; args?: string[] }) => string
  activeCategory: string
  enterAppLowPowerMode: () => Promise<void>
  wakeAppFromLowPowerMode: () => Promise<void>
}

type ActiveProcessLaunchSession = {
  sessionId: string
  pid: number | null
  gameId: string
  mode: 'process' | 'uri' | 'shell'
  isSteamUriSession: boolean
  startedAtMs: number
  checkpointAtMs: number
  pendingNotRunningPolls: number
  pendingUnknownPolls: number
  handoffGraceUntilMs: number
  releaseEarliestAtMs: number
  releaseLatestAtMs: number
}

type SteamUriExternalLockToken = {
  sessionId: string
  armedAtMs: number
  releaseEarliestAtMs: number
  releaseLatestAtMs: number
}

type AddExecutableResult = {
  gameId: string
  title: string
  iconExtracted: boolean
  warning?: string
}

export function useLauncherLibraryActions(params: UseLauncherLibraryActionsParams) {
  const {
    isDeferredStartupReady,
    lowPowerModeEnabled,
    steamControllerCoexistenceMode,
    steamApiKey,
    steamId,
    library,
    playtimeMinutesByGame,
    playtimeLookupDone,
    coverArtByGame,
    coverArtThumbByGame,
    coverArtStatusByGame,
    customCoverByGame,
    achievementByGame,
    achievementModalGameId,
    achievementSearch,
    achievementFilter,
    emulatorPaths,
    systemEmulatorMap,
    controllerBindsBySystem,
    platformPeripheralsBySystem,
    romTitleCleanupEnabled,
    titleOverridesByManagedKey,
    romDirsText,
    setRomDirsText,
    launcherView,
    gamesViewMode,
    isPerformanceFirstMode,
    launchWipeTimerRef,
    setPlaytimeMinutesByGame,
    setPlaytimeLookupDone,
    setCoverArtByGame,
    setCoverArtThumbByGame,
    setCoverArtStatusByGame,
    setCoverArtMetaByGame,
    setCoverSourceByGame,
    setLibrary,
    setGameMetaById,
    setAchievementByGame,
    setCustomCoverByGame,
    setIsImporting,
    setStatus,
    setLoadingAchievements,
    setAchievementModalGameId,
    setAchievementSearch,
    setAchievementFilter,
    setEmulatorPaths,
    setTitleOverridesByManagedKey,
    setIsSteamLoginBusy,
    setSteamId,
    setIsSteamTestBusy,
    setIsLaunchWipeActive,
    setFocusedGameId,
    setActiveTab,
    removeGameScreenshots,
    playFavoriteToggleSound,
    activeCategory,
    enterAppLowPowerMode,
    wakeAppFromLowPowerMode,
  } = params

  const [connectorHealth, setConnectorHealth] = useState<ConnectorHealth[]>([])
  const [coverLookupRefreshKey, setCoverLookupRefreshKey] = useState(0)
  const [customCoverCropRequest, setCustomCoverCropRequest] = useState<CustomCoverCropRequest | null>(null)
  const [isApplyingCustomCoverCrop, setIsApplyingCustomCoverCrop] = useState(false)
  const coverArtByGameRef = useRef(coverArtByGame)
  const coverArtThumbByGameRef = useRef(coverArtThumbByGame)
  const customCoverByGameRef = useRef(customCoverByGame)
  const coverArtStatusByGameRef = useRef(coverArtStatusByGame)
  const activeProcessLaunchesRef = useRef<Record<string, ActiveProcessLaunchSession>>({})
  const playtimeLookupCredentialSignatureRef = useRef('')
  const [activeExternalSessionCount, setActiveExternalSessionCount] = useState(0)
  const [steamUriExternalLockToken, setSteamUriExternalLockToken] = useState<SteamUriExternalLockToken | null>(null)
  const steamUriExternalLockActive = steamUriExternalLockToken !== null
  const pendingLowPowerWakeOnDrainRef = useRef(false)
  const steamUriExternalLockActiveRef = useRef(false)
  const steamUriExternalLockTimerRef = useRef<number | null>(null)
  const steamUriExternalLockForegroundTimerRef = useRef<number | null>(null)
  const steamUriExternalLockSawBackgroundRef = useRef(false)
  const externalWakeCooldownTimerRef = useRef<number | null>(null)

  const syncActiveExternalSessionCount = useCallback((sessionsById: Record<string, ActiveProcessLaunchSession>) => {
    const nextCount = Object.keys(sessionsById).length
    setActiveExternalSessionCount((previous) => (previous === nextCount ? previous : nextCount))
  }, [])

  useEffect(() => {
    steamUriExternalLockActiveRef.current = steamUriExternalLockActive
  }, [steamUriExternalLockActive])

  const wakeFromLowPowerAfterSessionEnd = useCallback(() => {
    if (!pendingLowPowerWakeOnDrainRef.current || !lowPowerModeEnabled) {
      return
    }

    if (Object.keys(activeProcessLaunchesRef.current).length > 0 || steamUriExternalLockActiveRef.current) {
      return
    }

    pendingLowPowerWakeOnDrainRef.current = false
    setActiveTab('launcher')
    void wakeAppFromLowPowerMode().catch(() => {
    })
  }, [lowPowerModeEnabled, setActiveTab, wakeAppFromLowPowerMode])

  const persistActiveProcessLaunches = useCallback((sessionsById: Record<string, ActiveProcessLaunchSession>) => {
    if (typeof window === 'undefined') {
      return
    }

    const sessions = Object.values(sessionsById)
      .map((session) => {
        const sessionId = typeof session.sessionId === 'string' ? session.sessionId.trim() : ''
        const gameId = typeof session.gameId === 'string' ? session.gameId : ''
        const mode = session.mode === 'uri' || session.mode === 'shell' ? session.mode : 'process'
        const rawPid = session.pid
        const pid = rawPid === null || rawPid === undefined ? null : Math.floor(Number(rawPid))
        const startedAtMs = Math.max(0, Math.floor(Number(session.startedAtMs ?? 0)))
        const checkpointAtMs = Math.max(startedAtMs, Math.floor(Number(session.checkpointAtMs ?? startedAtMs)))
        const handoffGraceUntilMs = Math.max(startedAtMs, Math.floor(Number(session.handoffGraceUntilMs ?? startedAtMs)))
        const releaseEarliestAtMs = Math.max(startedAtMs, Math.floor(Number(session.releaseEarliestAtMs ?? startedAtMs)))
        const releaseLatestAtMs = Math.max(releaseEarliestAtMs, Math.floor(Number(session.releaseLatestAtMs ?? releaseEarliestAtMs)))
        const pendingNotRunningPolls = Math.max(0, Math.floor(Number(session.pendingNotRunningPolls ?? 0)))
        const isSteamUriSession = Boolean(session.isSteamUriSession)

        if (!sessionId || !gameId) {
          return null
        }

        if (mode === 'process' && (!Number.isFinite(pid) || (pid ?? 0) <= 0)) {
          return null
        }

        return {
          sessionId,
          pid: mode === 'process' ? pid : null,
          gameId,
          mode,
          isSteamUriSession,
          startedAtMs,
          checkpointAtMs,
          pendingNotRunningPolls,
          handoffGraceUntilMs,
          releaseEarliestAtMs,
          releaseLatestAtMs,
        }
      })
      .filter((session): session is ActiveProcessLaunchSession => Boolean(session))

    if (sessions.length === 0) {
      window.localStorage.removeItem(ACTIVE_PLAYTIME_SESSIONS_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      ACTIVE_PLAYTIME_SESSIONS_STORAGE_KEY,
      JSON.stringify({
        version: ACTIVE_PLAYTIME_SESSIONS_STORAGE_VERSION,
        sessions,
      }),
    )
  }, [])

  const readPersistedActiveProcessLaunches = useCallback((): ActiveProcessLaunchSession[] => {
    if (typeof window === 'undefined') {
      return []
    }

    const raw = window.localStorage.getItem(ACTIVE_PLAYTIME_SESSIONS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    try {
      const parsed = JSON.parse(raw) as
        | Array<Partial<ActiveProcessLaunchSession>>
        | {
            version?: number
            sessions?: Array<Partial<ActiveProcessLaunchSession>>
          }

      const candidates = Array.isArray(parsed) ? parsed : parsed.sessions
      if (!Array.isArray(candidates)) {
        return []
      }

      return candidates
        .map((session) => {
          const sessionId = typeof session?.sessionId === 'string' && session.sessionId.trim().length > 0
            ? session.sessionId.trim()
            : (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `launch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)

          const pidCandidate = session?.pid === null || session?.pid === undefined
            ? null
            : Math.floor(Number(session.pid))

          const mode: 'process' | 'uri' | 'shell' =
            session?.mode === 'uri' || session?.mode === 'shell'
              ? session.mode
              : (Number.isFinite(pidCandidate) && (pidCandidate ?? 0) > 0 ? 'process' : 'uri')

          const gameId = typeof session?.gameId === 'string' ? session.gameId : ''
          const startedAtMs = Math.max(0, Math.floor(Number(session?.startedAtMs ?? 0)))
          const checkpointAtMs = Math.max(startedAtMs, Math.floor(Number(session?.checkpointAtMs ?? startedAtMs)))
          const pendingNotRunningPolls = Math.max(0, Math.floor(Number(session?.pendingNotRunningPolls ?? 0)))
          const pendingUnknownPolls = Math.max(0, Math.floor(Number(session?.pendingUnknownPolls ?? 0)))

          if (!gameId) {
            return null
          }

          if (mode === 'process' && (!Number.isFinite(pidCandidate) || (pidCandidate ?? 0) <= 0)) {
            return null
          }

          const defaultReleaseLatestAtMs = mode === 'process'
            ? Number.MAX_SAFE_INTEGER
            : startedAtMs + (Boolean(session?.isSteamUriSession) ? STEAM_URI_EXTERNAL_LOCK_MAX_MS : URI_EXTERNAL_LOCK_MAX_MS)

          const releaseEarliestAtMs = Math.max(startedAtMs, Math.floor(Number(session?.releaseEarliestAtMs ?? startedAtMs)))
          const releaseLatestAtMs = Math.max(releaseEarliestAtMs, Math.floor(Number(session?.releaseLatestAtMs ?? defaultReleaseLatestAtMs)))
          const handoffGraceUntilMs = Math.max(
            startedAtMs,
            Math.floor(Number(session?.handoffGraceUntilMs ?? (mode === 'process' ? startedAtMs + PROCESS_HANDOFF_GRACE_MS : startedAtMs))),
          )

          return {
            sessionId,
            pid: mode === 'process' ? pidCandidate : null,
            gameId,
            mode,
            isSteamUriSession: mode === 'uri' ? Boolean(session?.isSteamUriSession) : false,
            startedAtMs,
            checkpointAtMs,
            pendingNotRunningPolls,
            pendingUnknownPolls,
            handoffGraceUntilMs,
            releaseEarliestAtMs,
            releaseLatestAtMs,
          }
        })
        .filter((session): session is ActiveProcessLaunchSession => Boolean(session))
    } catch {
      return []
    }
  }, [])

  const checkpointAndPersistActiveLaunches = useCallback((checkpointAtMs = Date.now()) => {
    const sessionsById = activeProcessLaunchesRef.current
    for (const session of Object.values(sessionsById)) {
      if (checkpointAtMs > session.checkpointAtMs) {
        session.checkpointAtMs = checkpointAtMs
      }
    }

    persistActiveProcessLaunches(sessionsById)
  }, [persistActiveProcessLaunches])

  const applyTrackedPlaytimeMinutes = useCallback((gameId: string, minutesToAdd: number) => {
    const safeMinutes = Math.max(0, Math.floor(minutesToAdd))
    if (safeMinutes <= 0) {
      return
    }

    setGameMetaById((previous) => {
      const existing = previous[gameId]
      if (!existing) {
        return previous
      }

      const trackedMinutes = Math.max(0, Math.floor(existing.trackedPlaytimeMinutes ?? 0))
      return {
        ...previous,
        [gameId]: {
          ...existing,
          trackedPlaytimeMinutes: trackedMinutes + safeMinutes,
        },
      }
    })
  }, [setGameMetaById])

  const finalizeProcessLaunchSession = useCallback((
    session: ActiveProcessLaunchSession,
    endedAtMs = session.checkpointAtMs,
  ) => {
    if (session.mode !== 'process') {
      return
    }

    const safeEndedAtMs = Math.max(session.startedAtMs, session.checkpointAtMs, endedAtMs)
    const durationMs = Math.max(0, safeEndedAtMs - session.startedAtMs)
    if (durationMs < MIN_TRACKABLE_PLAY_SESSION_MS) {
      return
    }

    const roundedMinutes = Math.max(1, Math.floor((durationMs + 30000) / 60000))
    applyTrackedPlaytimeMinutes(session.gameId, roundedMinutes)
  }, [applyTrackedPlaytimeMinutes])

  const registerLaunchSession = useCallback((
    gameId: string,
    mode: 'process' | 'uri' | 'shell',
    options: {
      pid?: number | null
      startedAtMs?: number
      isSteamUriSession?: boolean
      releaseEarliestAtMs?: number
      releaseLatestAtMs?: number
    } = {},
  ): string | null => {
    const startedAtMs = Math.max(0, Math.floor(options.startedAtMs ?? Date.now()))
    const pid = options.pid === null || options.pid === undefined ? null : Math.floor(Number(options.pid))
    if (mode === 'process' && (!Number.isFinite(pid) || (pid ?? 0) <= 0)) {
      return null
    }

    const sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `launch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const defaultReleaseLatestAtMs = mode === 'process'
      ? Number.MAX_SAFE_INTEGER
      : startedAtMs + (options.isSteamUriSession ? STEAM_URI_EXTERNAL_LOCK_MAX_MS : URI_EXTERNAL_LOCK_MAX_MS)

    const releaseEarliestAtMs = Math.max(
      startedAtMs,
      Math.floor(options.releaseEarliestAtMs ?? (mode === 'process' ? startedAtMs : startedAtMs + URI_EXTERNAL_LOCK_MIN_MS)),
    )
    const releaseLatestAtMs = Math.max(releaseEarliestAtMs, Math.floor(options.releaseLatestAtMs ?? defaultReleaseLatestAtMs))

    activeProcessLaunchesRef.current[sessionId] = {
      sessionId,
      pid: mode === 'process' ? pid : null,
      gameId,
      mode,
      isSteamUriSession: mode === 'uri' ? Boolean(options.isSteamUriSession) : false,
      startedAtMs,
      checkpointAtMs: startedAtMs,
      pendingNotRunningPolls: 0,
      pendingUnknownPolls: 0,
      handoffGraceUntilMs: mode === 'process' ? startedAtMs + PROCESS_HANDOFF_GRACE_MS : startedAtMs,
      releaseEarliestAtMs,
      releaseLatestAtMs,
    }

    persistActiveProcessLaunches(activeProcessLaunchesRef.current)
    syncActiveExternalSessionCount(activeProcessLaunchesRef.current)
    return sessionId
  }, [persistActiveProcessLaunches, syncActiveExternalSessionCount])

  const clearSteamUriExternalLock = useCallback(() => {
    if (steamUriExternalLockTimerRef.current !== null) {
      window.clearTimeout(steamUriExternalLockTimerRef.current)
      steamUriExternalLockTimerRef.current = null
    }

    if (steamUriExternalLockForegroundTimerRef.current !== null) {
      window.clearTimeout(steamUriExternalLockForegroundTimerRef.current)
      steamUriExternalLockForegroundTimerRef.current = null
    }

    steamUriExternalLockSawBackgroundRef.current = false
    setSteamUriExternalLockToken(null)
  }, [])

  const armSteamUriExternalLock = useCallback((sessionId: string, startedAtMs = Date.now()) => {
    if (steamUriExternalLockTimerRef.current !== null) {
      window.clearTimeout(steamUriExternalLockTimerRef.current)
      steamUriExternalLockTimerRef.current = null
    }

    const { minMs, maxMs } = getSteamUriLockTimings(steamControllerCoexistenceMode)

    const releaseEarliestAtMs = Math.max(startedAtMs + minMs, Date.now())
    const releaseLatestAtMs = Math.max(releaseEarliestAtMs, startedAtMs + maxMs)

    steamUriExternalLockSawBackgroundRef.current = false
    setSteamUriExternalLockToken({
      sessionId,
      armedAtMs: Date.now(),
      releaseEarliestAtMs,
      releaseLatestAtMs,
    })

    const timeoutMs = Math.max(0, releaseLatestAtMs - Date.now())
    steamUriExternalLockTimerRef.current = window.setTimeout(() => {
      steamUriExternalLockTimerRef.current = null
      const sessionsById = activeProcessLaunchesRef.current
      if (sessionsById[sessionId]) {
        delete sessionsById[sessionId]
        persistActiveProcessLaunches(sessionsById)
        syncActiveExternalSessionCount(sessionsById)
      }
      clearSteamUriExternalLock()
      wakeFromLowPowerAfterSessionEnd()
    }, timeoutMs)
  }, [clearSteamUriExternalLock, persistActiveProcessLaunches, steamControllerCoexistenceMode, syncActiveExternalSessionCount, wakeFromLowPowerAfterSessionEnd])

  useEffect(() => {
    return () => {
      if (steamUriExternalLockTimerRef.current !== null) {
        window.clearTimeout(steamUriExternalLockTimerRef.current)
      }
      if (steamUriExternalLockForegroundTimerRef.current !== null) {
        window.clearTimeout(steamUriExternalLockForegroundTimerRef.current)
      }
      if (externalWakeCooldownTimerRef.current !== null) {
        window.clearTimeout(externalWakeCooldownTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!steamUriExternalLockToken) {
      return
    }

    const { returnStableMs } = getSteamUriLockTimings(steamControllerCoexistenceMode)

    const clearForegroundReleaseTimer = () => {
      if (steamUriExternalLockForegroundTimerRef.current !== null) {
        window.clearTimeout(steamUriExternalLockForegroundTimerRef.current)
        steamUriExternalLockForegroundTimerRef.current = null
      }
    }

    const releaseLockSession = () => {
      const sessionsById = activeProcessLaunchesRef.current
      if (sessionsById[steamUriExternalLockToken.sessionId]) {
        delete sessionsById[steamUriExternalLockToken.sessionId]
        persistActiveProcessLaunches(sessionsById)
        syncActiveExternalSessionCount(sessionsById)
      }
      clearSteamUriExternalLock()
      wakeFromLowPowerAfterSessionEnd()
    }

    const canRelease = () => {
      if (!steamUriExternalLockSawBackgroundRef.current) {
        return false
      }

      const inTrayLowPower = document.body.dataset.tmLowPower === 'true'
      if (!inTrayLowPower && (document.visibilityState !== 'visible' || !document.hasFocus())) {
        return false
      }

      const now = Date.now()
      if (now < steamUriExternalLockToken.releaseEarliestAtMs) {
        return false
      }

      const sessionsById = activeProcessLaunchesRef.current
      const currentSession = sessionsById[steamUriExternalLockToken.sessionId]
      if (!currentSession) {
        return true
      }

      const hasProcessSessions = Object.values(sessionsById).some((session) => session.mode === 'process')
      if (hasProcessSessions) {
        return false
      }

      return now >= currentSession.releaseEarliestAtMs
    }

    const scheduleMaybeRelease = () => {
      if (!canRelease()) {
        return
      }

      clearForegroundReleaseTimer()
      steamUriExternalLockForegroundTimerRef.current = window.setTimeout(() => {
        steamUriExternalLockForegroundTimerRef.current = null
        if (canRelease()) {
          releaseLockSession()
        }
      }, returnStableMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleMaybeRelease()
        return
      }

      steamUriExternalLockSawBackgroundRef.current = true
      clearForegroundReleaseTimer()
    }

    const handleBlur = () => {
      steamUriExternalLockSawBackgroundRef.current = true
      clearForegroundReleaseTimer()
    }

    const handleFocus = () => {
      scheduleMaybeRelease()
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    scheduleMaybeRelease()

    const trayPollTimer = window.setInterval(() => {
      if (document.body.dataset.tmLowPower === 'true') {
        scheduleMaybeRelease()
      }
    }, 1500)

    return () => {
      clearForegroundReleaseTimer()
      window.clearInterval(trayPollTimer)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    clearSteamUriExternalLock,
    persistActiveProcessLaunches,
    steamControllerCoexistenceMode,
    steamUriExternalLockToken,
    syncActiveExternalSessionCount,
    wakeFromLowPowerAfterSessionEnd,
  ])

  useEffect(() => {
    const canWakeFromDrain =
      pendingLowPowerWakeOnDrainRef.current
      && lowPowerModeEnabled
      && activeExternalSessionCount === 0
      && !steamUriExternalLockActive

    if (!canWakeFromDrain) {
      return
    }

    if (externalWakeCooldownTimerRef.current !== null) {
      window.clearTimeout(externalWakeCooldownTimerRef.current)
      externalWakeCooldownTimerRef.current = null
    }

    externalWakeCooldownTimerRef.current = window.setTimeout(() => {
      externalWakeCooldownTimerRef.current = null
      wakeFromLowPowerAfterSessionEnd()
    }, EXTERNAL_WAKE_COOLDOWN_MS)
  }, [activeExternalSessionCount, lowPowerModeEnabled, steamUriExternalLockActive, wakeFromLowPowerAfterSessionEnd])

  const handleTrackedProcessExited = useCallback((pid: number) => {
    const normalizedPid = Math.floor(Number(pid))
    if (!Number.isFinite(normalizedPid) || normalizedPid <= 0) {
      return
    }

    const sessionsById = activeProcessLaunchesRef.current
    const now = Date.now()
    let removedAny = false

    for (const [sessionId, session] of Object.entries(sessionsById)) {
      if (session.mode !== 'process' || session.pid !== normalizedPid) {
        continue
      }

      finalizeProcessLaunchSession(session, now)
      delete sessionsById[sessionId]
      removedAny = true
    }

    if (!removedAny) {
      return
    }

    persistActiveProcessLaunches(sessionsById)
    syncActiveExternalSessionCount(sessionsById)
    wakeFromLowPowerAfterSessionEnd()
  }, [finalizeProcessLaunchSession, persistActiveProcessLaunches, syncActiveExternalSessionCount, wakeFromLowPowerAfterSessionEnd])

  const pollSessions = useCallback(async () => {
    const sessionsById = activeProcessLaunchesRef.current
    const now = Date.now()

    let removedLockSession = false
    for (const [sessionId, session] of Object.entries(sessionsById)) {
      if (session.mode === 'process') {
        continue
      }

      if (now < session.releaseLatestAtMs) {
        continue
      }

      delete sessionsById[sessionId]
      if (steamUriExternalLockToken?.sessionId === sessionId) {
        removedLockSession = true
      }
    }

    if (removedLockSession) {
      clearSteamUriExternalLock()
    }

    const processSessions = Object.values(sessionsById)
      .filter((session) => session.mode === 'process' && Number.isFinite(session.pid) && (session.pid ?? 0) > 0)

    if (processSessions.length === 0) {
      persistActiveProcessLaunches(sessionsById)
      syncActiveExternalSessionCount(sessionsById)
      return
    }

    const pids = Array.from(new Set(processSessions.map((session) => session.pid as number)))
    try {
      const statuses = await getProcessRunningStatus({ pids })

      const statusByPid = new Map<number, 'running' | 'not_running' | 'unknown'>()
      for (const item of statuses) {
        const normalizedStatus: 'running' | 'not_running' | 'unknown' =
          item.status === 'running' || item.status === 'not_running' || item.status === 'unknown'
            ? item.status
            : (item.running ? 'running' : 'not_running')
        statusByPid.set(item.pid, normalizedStatus)
      }

      for (const [sessionId, session] of Object.entries(sessionsById)) {
        if (session.mode !== 'process' || !Number.isFinite(session.pid) || (session.pid ?? 0) <= 0) {
          continue
        }

        const status = statusByPid.get(session.pid as number) ?? 'unknown'
        if (status === 'running') {
          session.pendingNotRunningPolls = 0
          session.pendingUnknownPolls = 0
          session.checkpointAtMs = Math.max(session.checkpointAtMs, now)
          continue
        }

        if (status === 'unknown') {
          session.pendingUnknownPolls += 1
          session.checkpointAtMs = Math.max(session.checkpointAtMs, now)

          const stillInHandoffGrace = now < session.handoffGraceUntilMs
          const hasConfirmedStop = session.pendingUnknownPolls >= PROCESS_UNKNOWN_CONFIRM_POLLS

          if (!stillInHandoffGrace && hasConfirmedStop) {
            delete sessionsById[sessionId]
            finalizeProcessLaunchSession(session, session.checkpointAtMs)
          }
          continue
        }

        session.pendingNotRunningPolls += 1
        session.pendingUnknownPolls = 0
        session.checkpointAtMs = Math.max(session.checkpointAtMs, now)

        const stillInHandoffGrace = now < session.handoffGraceUntilMs
        const hasConfirmedStop = session.pendingNotRunningPolls >= PROCESS_NOT_RUNNING_CONFIRM_POLLS

        if (stillInHandoffGrace || !hasConfirmedStop) {
          continue
        }

        delete sessionsById[sessionId]
        finalizeProcessLaunchSession(session, session.checkpointAtMs)
      }
    } catch {
      for (const session of processSessions) {
        const current = sessionsById[session.sessionId]
        if (!current) {
          continue
        }

        current.pendingNotRunningPolls = 0
        current.pendingUnknownPolls = 0
        current.checkpointAtMs = Math.max(current.checkpointAtMs, now)
      }
    }

    persistActiveProcessLaunches(sessionsById)
    syncActiveExternalSessionCount(sessionsById)
    wakeFromLowPowerAfterSessionEnd()
  }, [clearSteamUriExternalLock, finalizeProcessLaunchSession, persistActiveProcessLaunches, steamUriExternalLockToken?.sessionId, syncActiveExternalSessionCount, wakeFromLowPowerAfterSessionEnd])

  const recheckExternalSessions = useCallback(() => {
    void pollSessions()
  }, [pollSessions])

  const registerProcessLaunchSession = useCallback((gameId: string, pid: number, startedAtMs = Date.now()): string | null => {
    return registerLaunchSession(gameId, 'process', {
      pid,
      startedAtMs,
      releaseEarliestAtMs: startedAtMs,
      releaseLatestAtMs: Number.MAX_SAFE_INTEGER,
    })
  }, [registerLaunchSession])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    let cancelled = false

    const recover = async () => {
      const persisted = readPersistedActiveProcessLaunches()
      const now = Date.now()
      const restored: Record<string, ActiveProcessLaunchSession> = {}

      for (const session of persisted) {
        if (session.mode !== 'process' && now >= session.releaseLatestAtMs) {
          continue
        }

        restored[session.sessionId] = session
      }

      activeProcessLaunchesRef.current = restored
      persistActiveProcessLaunches(restored)
      syncActiveExternalSessionCount(restored)

      const restoredSteamSession = Object.values(restored).find((session) => session.isSteamUriSession)
      if (restoredSteamSession) {
        armSteamUriExternalLock(restoredSteamSession.sessionId, restoredSteamSession.startedAtMs)
      } else {
        clearSteamUriExternalLock()
      }

      await pollSessions()
      if (cancelled) {
        return
      }
    }

    void recover()

    return () => {
      cancelled = true
    }
  }, [armSteamUriExternalLock, clearSteamUriExternalLock, isDeferredStartupReady, persistActiveProcessLaunches, pollSessions, readPersistedActiveProcessLaunches, syncActiveExternalSessionCount])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    let timer: number | null = null

    const scheduleNextPoll = () => {
      const hasTrackedSessions = Object.keys(activeProcessLaunchesRef.current).length > 0
      const delayMs = hasTrackedSessions ? PROCESS_PLAYTIME_POLL_ACTIVE_MS : PROCESS_PLAYTIME_POLL_MS
      timer = window.setTimeout(() => {
        void pollSessions().finally(() => {
          scheduleNextPoll()
        })
      }, delayMs)
    }

    void pollSessions().finally(() => {
      scheduleNextPoll()
    })

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer)
      }
    }
  }, [isDeferredStartupReady, pollSessions])

  useEffect(() => {
    if (!isDeferredStartupReady || !isTauri()) {
      return
    }

    let disposed = false
    let unlisten: (() => void) | undefined

    void listen<{ pid?: number }>('tilezu:tracked-process-exited', (event) => {
      if (disposed) {
        return
      }

      const pid = Math.floor(Number(event.payload?.pid ?? 0))
      if (pid <= 0) {
        return
      }

      handleTrackedProcessExited(pid)
    }).then((stopListening) => {
      if (disposed) {
        stopListening()
        return
      }

      unlisten = stopListening
    }).catch(() => {
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [handleTrackedProcessExited, isDeferredStartupReady])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const handleSnapshotPersist = () => {
      checkpointAndPersistActiveLaunches(Date.now())
    }

    window.addEventListener('beforeunload', handleSnapshotPersist)
    window.addEventListener('pagehide', handleSnapshotPersist)

    return () => {
      window.removeEventListener('beforeunload', handleSnapshotPersist)
      window.removeEventListener('pagehide', handleSnapshotPersist)
    }
  }, [checkpointAndPersistActiveLaunches, isDeferredStartupReady])

  useEffect(() => {
    coverArtByGameRef.current = coverArtByGame
  }, [coverArtByGame])

  useEffect(() => {
    coverArtThumbByGameRef.current = coverArtThumbByGame
  }, [coverArtThumbByGame])

  useEffect(() => {
    customCoverByGameRef.current = customCoverByGame
  }, [customCoverByGame])

  useEffect(() => {
    coverArtStatusByGameRef.current = coverArtStatusByGame
  }, [coverArtStatusByGame])

  useEffect(() => {
    setCoverArtStatusByGame((previous) => {
      let next: Record<string, CoverArtStatus> | null = null

      for (const entry of library) {
        const hasArt = Boolean(
          customCoverByGame[entry.id]
          || coverArtThumbByGame[entry.id]
          || coverArtByGame[entry.id],
        )

        if (!hasArt || previous[entry.id] === 'success') {
          continue
        }

        if (!next) {
          next = { ...previous }
        }

        next[entry.id] = 'success'
      }

      return next ?? previous
    })
  }, [coverArtByGame, coverArtThumbByGame, customCoverByGame, library, setCoverArtStatusByGame])

  const buildImportSettings = useCallback((): ImportSettings => {
    const romDirs = romDirsText
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)

    const customEmulatorPaths = Object.fromEntries(
      Object.entries(emulatorPaths)
        .map(([entryKey, value]) => [entryKey, value.trim()])
        .filter(([, value]) => value.length > 0),
    )

    const customSystemEmulatorMap = Object.fromEntries(
      Object.entries(systemEmulatorMap)
        .map(([systemKey, emulatorKey]) => [systemKey.trim(), emulatorKey])
        .filter(([systemKey]) => systemKey.length > 0),
    ) as Record<string, EmulatorKey>

    return {
      romDirs,
      emulatorPaths: customEmulatorPaths,
      systemEmulatorMap: customSystemEmulatorMap,
    }
  }, [emulatorPaths, romDirsText, systemEmulatorMap])

  const applyConnectorFixAction = useCallback((fixAction: string | undefined) => {
    switch (fixAction) {
      case 'install_steam':
        void window.open('https://store.steampowered.com/about/', '_blank', 'noopener,noreferrer')
        setStatus('Opened Steam download page in your browser.')
        return
      case 'install_epic':
        void window.open('https://store.epicgames.com/en-US/download', '_blank', 'noopener,noreferrer')
        setStatus('Opened Epic Games Launcher download page.')
        return
      case 'install_battle_net':
        void window.open('https://www.blizzard.com/apps/battle.net/desktop', '_blank', 'noopener,noreferrer')
        setStatus('Opened Battle.net desktop app download page.')
        return
      case 'install_ea_app':
        void window.open('https://www.ea.com/ea-app', '_blank', 'noopener,noreferrer')
        setStatus('Opened EA App download page.')
        return
      case 'install_ubisoft_connect':
        void window.open('https://ubisoftconnect.com/', '_blank', 'noopener,noreferrer')
        setStatus('Opened Ubisoft Connect download page.')
        return
      case 'install_xbox_app':
        void window.open('https://www.xbox.com/apps/xbox-app-for-pc', '_blank', 'noopener,noreferrer')
        setStatus('Opened Xbox app download page.')
        return
      case 'configure_emulator_paths':
      case 'review_rom_dirs':
      case 'open_import_settings':
        setActiveTab('settings')
        setStatus('Open Import Settings and add emulator paths/ROM folders, then run Bring My Libraries again.')
        return
      default:
        return
    }
  }, [setActiveTab, setStatus])

  const selectedAchievementGame = useMemo(() => {
    if (!achievementModalGameId) {
      return null
    }

    const game = library.find((entry) => entry.id === achievementModalGameId)
    const data = achievementByGame[achievementModalGameId]
    if (!game || !data) {
      return null
    }

    const query = achievementSearch.trim().toLowerCase()
    const achievements = data.achievements.filter((item) => {
      if (achievementFilter === 'unlocked' && !item.achieved) {
        return false
      }

      if (achievementFilter === 'locked' && item.achieved) {
        return false
      }

      if (!query) {
        return true
      }

      const description = item.description?.toLowerCase() ?? ''
      return item.name.toLowerCase().includes(query) || description.includes(query)
    })

    return {
      game,
      data,
      achievements,
    }
  }, [achievementModalGameId, achievementByGame, library, achievementSearch, achievementFilter])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    let cancelled = false

    const refresh = async () => {
      try {
        const next = await getConnectorHealth(buildImportSettings())
        if (!cancelled) {
          setConnectorHealth(next)
        }
      } catch {
        if (!cancelled) {
          setConnectorHealth([])
        }
      }
    }

    void refresh()
    const interval = window.setInterval(() => {
      void refresh()
    }, 120000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [buildImportSettings, isDeferredStartupReady])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const nextSignature = `${steamId.trim()}|${steamApiKey.trim()}`
    if (nextSignature === playtimeLookupCredentialSignatureRef.current) {
      return
    }

    playtimeLookupCredentialSignatureRef.current = nextSignature

    setPlaytimeLookupDone((previous) => {
      let changed = false
      const next = { ...previous }

      for (const entry of library) {
        if (parseSteamAppId(entry) === null) {
          continue
        }

        if (!Object.prototype.hasOwnProperty.call(next, entry.id)) {
          continue
        }

        delete next[entry.id]
        changed = true
      }

      return changed ? next : previous
    })
  }, [isDeferredStartupReady, library, setPlaytimeLookupDone, steamApiKey, steamId])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const id = steamId.trim()
    const key = steamApiKey.trim()

    const steamWithoutPlaytime = library
      .map((entry) => ({
        entry,
        appId: parseSteamAppId(entry),
      }))
      .filter((item) => item.appId !== null)
      .filter((item) => {
        const lookupCompleted = Boolean(playtimeLookupDone[item.entry.id])
        const hasOfficialValue = Object.prototype.hasOwnProperty.call(playtimeMinutesByGame, item.entry.id)
        return !lookupCompleted || !hasOfficialValue
      })

    if (steamWithoutPlaytime.length === 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      for (const item of steamWithoutPlaytime) {
        if (cancelled || item.appId === null) {
          return
        }

        try {
          const response = await getSteamPlaytime({
            apiKey: key,
            steamId: id,
            appId: item.appId,
          })

          if (cancelled) {
            return
          }

          setPlaytimeMinutesByGame((previous) => ({
            ...previous,
            [item.entry.id]: Math.max(
              Math.max(0, Math.floor(response.minutesTotal ?? 0)),
              Math.max(0, Math.floor(previous[item.entry.id] ?? 0)),
            ),
          }))

          setPlaytimeLookupDone((previous) => ({
            ...previous,
            [item.entry.id]: true,
          }))
        } catch {
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [library, playtimeLookupDone, playtimeMinutesByGame, steamApiKey, steamId, isDeferredStartupReady, setPlaytimeLookupDone, setPlaytimeMinutesByGame])

  const setCoverProvenance = useCallback((entryId: string, gridTier: CoverSourceTier, detailTier: CoverSourceTier) => {
    setCoverSourceByGame((previous) => {
      const existing = previous[entryId]
      if (existing && existing.gridTier === gridTier && existing.detailTier === detailTier) {
        return previous
      }

      return {
        ...previous,
        [entryId]: {
          gridTier,
          detailTier,
          updatedAt: Date.now(),
        },
      }
    })
  }, [setCoverSourceByGame])

  const resolveCoverArtEntry = useCallback(async (
    entry: GameEntry,
    resolveSource: () => Promise<string | null>,
    isCancelled: () => boolean,
  ) => {
    const cacheKey = buildCoverCacheKey(entry)

    setCoverArtStatusByGame((previous) => {
      if (previous[entry.id] === 'success') {
        return previous
      }

      return {
        ...previous,
        [entry.id]: 'loading',
      }
    })

    try {
      const [cachedGrid, cachedDetail, cachedLegacy] = isPerformanceFirstMode
        ? await Promise.all([
            getCachedCoverThumbnailTier({ cacheKey, tier: COVER_GRID_PRIMARY_TIER }).catch(() => null),
            Promise.resolve<string | null>(null),
            getCachedCoverThumbnail({ cacheKey }).catch(() => null),
          ])
        : await Promise.all([
            getCachedCoverThumbnailTier({ cacheKey, tier: COVER_GRID_PRIMARY_TIER }).catch(() => null),
            getCachedCoverThumbnailTier({ cacheKey, tier: COVER_DETAIL_TIER }).catch(() => null),
            getCachedCoverThumbnail({ cacheKey }).catch(() => null),
          ])
      if (isCancelled()) {
        return
      }

      const gridCover = pickGridCoverVariant(cachedGrid, cachedLegacy, cachedDetail)
      const detailCover = cachedDetail ?? cachedLegacy ?? cachedGrid
      const cachedTierCandidates: Record<CoverSourceTier, string | null | undefined> = {
        'grid-xs': cachedGrid,
        'grid-md': null,
        detail: cachedDetail,
        legacy: cachedLegacy,
        source: null,
        custom: null,
        unknown: null,
      }

      if (gridCover) {
        setCoverArtThumbByGame((previous) => ({
          ...previous,
          [entry.id]: gridCover,
        }))
      }

      if (detailCover) {
        setCoverArtByGame((previous) => ({
          ...previous,
          [entry.id]: detailCover,
        }))
      }

      const metadataSource = detailCover ?? gridCover
      if (metadataSource && !isPerformanceFirstMode) {
        const metadata = await measureCoverMetadata(metadataSource)
        if (!isCancelled() && metadata) {
          setCoverArtMetaByGame((previous) => ({
            ...previous,
            [entry.id]: metadata,
          }))
        }
      }

      if (gridCover || detailCover) {
        if (!isCancelled()) {
          setCoverProvenance(
            entry.id,
            resolveCoverSourceTierFromCandidates(gridCover, cachedTierCandidates),
            resolveCoverSourceTierFromCandidates(detailCover, cachedTierCandidates),
          )

          setCoverArtStatusByGame((previous) => ({
            ...previous,
            [entry.id]: 'success',
          }))
        }
        return
      }
    } catch {
      // Cache lookup failures fall through to source resolution.
    }

    for (let attempt = 0; attempt < COVER_MAX_RETRY_ATTEMPTS; attempt += 1) {
      if (isCancelled()) {
        return
      }

      try {
        const sourceArt = await resolveSource()
        if (isCancelled()) {
          return
        }

        if (!sourceArt) {
          setCoverArtStatusByGame((previous) => ({
            ...previous,
            [entry.id]: 'failed-permanent',
          }))
          return
        }

        let gridCover = sourceArt
        let detailCover = sourceArt
        const gridTierCandidates: Record<CoverSourceTier, string | null | undefined> = {
          'grid-xs': null,
          'grid-md': null,
          detail: null,
          legacy: null,
          source: sourceArt,
          custom: null,
          unknown: null,
        }
        const detailTierCandidates: Record<CoverSourceTier, string | null | undefined> = {
          'grid-xs': null,
          'grid-md': null,
          detail: null,
          legacy: null,
          source: sourceArt,
          custom: null,
          unknown: null,
        }

        if (isPerformanceFirstMode) {
          try {
            const normalized = await cacheCoverThumbnail({
              cacheKey,
              source: sourceArt,
              width: COVER_CACHE_FAST_WIDTH,
              height: COVER_CACHE_FAST_HEIGHT,
            })
            if (normalized) {
              gridCover = normalized
              detailCover = normalized
              gridTierCandidates.legacy = normalized
              detailTierCandidates.legacy = normalized
            }
          } catch {
            // Fast-path normalization failures should not block usable source art.
          }
        } else {
          try {
            const tiers = await cacheCoverThumbnailTiers({
              cacheKey,
              source: sourceArt,
            })

            gridTierCandidates['grid-xs'] = tiers.gridXs
            gridTierCandidates['grid-md'] = tiers.gridMd
            gridTierCandidates.detail = tiers.detail
            detailTierCandidates['grid-xs'] = tiers.gridXs
            detailTierCandidates['grid-md'] = tiers.gridMd
            detailTierCandidates.detail = tiers.detail

            gridCover = pickGridCoverVariant(tiers.gridXs, tiers.gridMd, tiers.detail) ?? sourceArt
            detailCover = tiers.detail ?? tiers.gridMd ?? tiers.gridXs ?? sourceArt
          } catch {
            // Backward-compatible fallback if tier command fails at runtime.
            try {
              const normalized = await cacheCoverThumbnail({
                cacheKey,
                source: sourceArt,
                width: COVER_CACHE_TARGET_WIDTH,
                height: COVER_CACHE_TARGET_HEIGHT,
              })
              if (normalized) {
                gridCover = normalized
                detailCover = normalized
                gridTierCandidates.legacy = normalized
                detailTierCandidates.legacy = normalized
              }
            } catch {
              // Normalization failures should not block usable source art.
            }
          }
        }

        if (isCancelled()) {
          return
        }

        setCoverArtThumbByGame((previous) => ({
          ...previous,
          [entry.id]: gridCover,
        }))

        setCoverArtByGame((previous) => ({
          ...previous,
          [entry.id]: detailCover,
        }))

        if (!isPerformanceFirstMode) {
          const metadata = await measureCoverMetadata(detailCover || gridCover)
          if (!isCancelled() && metadata) {
            setCoverArtMetaByGame((previous) => ({
              ...previous,
              [entry.id]: metadata,
            }))
          }
        }

        if (!isCancelled()) {
          setCoverProvenance(
            entry.id,
            resolveCoverSourceTierFromCandidates(gridCover, gridTierCandidates),
            resolveCoverSourceTierFromCandidates(detailCover, detailTierCandidates),
          )

          setCoverArtStatusByGame((previous) => ({
            ...previous,
            [entry.id]: 'success',
          }))
        }

        return
      } catch (error) {
        if (isCancelled()) {
          return
        }

        const failureStatus = classifyCoverFailure(error)
        const isTransient = failureStatus === 'failed-transient'

        if (!isTransient || attempt >= COVER_MAX_RETRY_ATTEMPTS - 1) {
          setCoverArtStatusByGame((previous) => ({
            ...previous,
            [entry.id]: failureStatus,
          }))
          return
        }

        setCoverArtStatusByGame((previous) => ({
          ...previous,
          [entry.id]: 'retrying',
        }))

        await new Promise((resolve) => {
          window.setTimeout(resolve, getRetryDelayMs(attempt))
        })
      }
    }
  }, [isPerformanceFirstMode, setCoverArtByGame, setCoverArtMetaByGame, setCoverArtStatusByGame, setCoverArtThumbByGame, setCoverProvenance])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const coverArtByGameSnapshot = coverArtByGameRef.current
    const customCoverByGameSnapshot = customCoverByGameRef.current
    const coverArtStatusByGameSnapshot = coverArtStatusByGameRef.current

    const steamWithoutArt = library
      .map((entry) => ({
        entry,
        source: getGameSource(entry),
        appId: parseSteamAppId(entry),
      }))
      .filter((item) => {
        if (item.appId !== null || item.source === 'steam' || isLikelySteamEntry(item.entry)) {
          return true
        }

        // Legacy libraries may store Steam games as executable/URI entries with title-only targets.
        return (
          item.source.length === 0
          && (item.entry.kind === 'executable' || item.entry.kind === 'uri')
          && !item.entry.target.trim().startsWith('__')
        )
      })
      .filter((item) => !customCoverByGameSnapshot[item.entry.id])
      .filter((item) => !coverArtByGameSnapshot[item.entry.id])
      .filter((item) => {
        const status = coverArtStatusByGameSnapshot[item.entry.id] ?? 'pending'
        return status === 'pending' || status === 'failed-transient' || status === 'failed-permanent'
      })

    if (steamWithoutArt.length === 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      await runTasksWithConcurrency(steamWithoutArt, COVER_LOOKUP_CONCURRENCY, () => cancelled, async (item) => {
        await resolveCoverArtEntry(
          item.entry,
          () => {
            if (item.appId !== null) {
              return getSteamCoverArt({ appId: item.appId })
            }

            return getSteamCoverArtForEntry({
              target: item.entry.target,
              title: item.entry.title,
              args: item.entry.args,
            })
          },
          () => cancelled,
        )
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [
    library,
    coverLookupRefreshKey,
    isDeferredStartupReady,
    resolveCoverArtEntry,
  ])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const coverArtByGameSnapshot = coverArtByGameRef.current
    const customCoverByGameSnapshot = customCoverByGameRef.current
    const coverArtStatusByGameSnapshot = coverArtStatusByGameRef.current

    const epicWithoutArt = library
      .filter((entry) => getGameSource(entry) === 'epic')
      .filter((entry) => !customCoverByGameSnapshot[entry.id])
      .filter((entry) => !coverArtByGameSnapshot[entry.id])
      .filter((entry) => {
        const status = coverArtStatusByGameSnapshot[entry.id] ?? 'pending'
        return status === 'pending' || status === 'failed-transient'
      })

    if (epicWithoutArt.length === 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      await runTasksWithConcurrency(epicWithoutArt, COVER_LOOKUP_CONCURRENCY, () => cancelled, async (entry) => {
        await resolveCoverArtEntry(
          entry,
          async () => {
            const primaryTarget = entry.target.trim() || entry.title
            const primaryResult = await getEpicCoverArt({ target: primaryTarget, title: entry.title })
            if (primaryResult) {
              return primaryResult
            }

            if (primaryTarget.trim().toLowerCase() === entry.title.trim().toLowerCase()) {
              return null
            }

            return getEpicCoverArt({ target: entry.title, title: entry.title })
          },
          () => cancelled,
        )
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [
    library,
    coverLookupRefreshKey,
    isDeferredStartupReady,
    resolveCoverArtEntry,
  ])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const coverArtByGameSnapshot = coverArtByGameRef.current
    const customCoverByGameSnapshot = customCoverByGameRef.current
    const coverArtStatusByGameSnapshot = coverArtStatusByGameRef.current

    const xboxWithoutArt = library
      .filter((entry) => getGameSource(entry) === 'xbox_app')
      .filter((entry) => !customCoverByGameSnapshot[entry.id])
      .filter((entry) => !coverArtByGameSnapshot[entry.id])
      .filter((entry) => {
        const status = coverArtStatusByGameSnapshot[entry.id] ?? 'pending'
        return status === 'pending' || status === 'failed-transient'
      })

    if (xboxWithoutArt.length === 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      await runTasksWithConcurrency(xboxWithoutArt, COVER_LOOKUP_CONCURRENCY, () => cancelled, async (entry) => {
        await resolveCoverArtEntry(
          entry,
          () =>
            getXboxCoverArt({
              target: entry.target,
              title: entry.title,
            }),
          () => cancelled,
        )
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [
    library,
    coverLookupRefreshKey,
    isDeferredStartupReady,
    resolveCoverArtEntry,
  ])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const coverArtByGameSnapshot = coverArtByGameRef.current
    const customCoverByGameSnapshot = customCoverByGameRef.current
    const coverArtStatusByGameSnapshot = coverArtStatusByGameRef.current

    const battleNetWithoutArt = library
      .filter((entry) => getGameSource(entry) === 'battle_net')
      .filter((entry) => !customCoverByGameSnapshot[entry.id])
      .filter((entry) => !coverArtByGameSnapshot[entry.id])
      .filter((entry) => {
        const status = coverArtStatusByGameSnapshot[entry.id] ?? 'pending'
        return status === 'pending' || status === 'failed-transient'
      })

    if (battleNetWithoutArt.length === 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      await runTasksWithConcurrency(battleNetWithoutArt, COVER_LOOKUP_CONCURRENCY, () => cancelled, async (entry) => {
        await resolveCoverArtEntry(
          entry,
          () =>
            getBattleNetCoverArt({
              target: entry.target,
              title: entry.title,
            }),
          () => cancelled,
        )
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [
    library,
    coverLookupRefreshKey,
    isDeferredStartupReady,
    resolveCoverArtEntry,
  ])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    const coverArtByGameSnapshot = coverArtByGameRef.current
    const customCoverByGameSnapshot = customCoverByGameRef.current
    const coverArtStatusByGameSnapshot = coverArtStatusByGameRef.current

    const romWithoutArt = library
      .map((entry) => {
        const source = getGameSource(entry)
        const romPath = firstLaunchArgRaw(entry.args)
        const profile = inferRomProfileFromPath(romPath, profileFromArgs(entry.args))
        return {
          entry,
          source,
          profile,
          romPath,
        }
      })
      .filter((item) => item.source === 'rom')
      .filter((item) => item.romPath.length > 0)
      .filter((item) => !customCoverByGameSnapshot[item.entry.id])
      .filter((item) => {
        const existingCover = coverArtByGameSnapshot[item.entry.id]
        if (!existingCover) {
          return true
        }

        // Force profile-specific refreshes for systems that previously had invalid cached ROM artwork.
        return item.profile === '3ds' || item.profile === 'dreamcast'
      })
      .filter((item) => {
        const status = coverArtStatusByGameSnapshot[item.entry.id] ?? 'pending'
        return (
          status === 'pending'
          || status === 'failed-transient'
          || status === 'failed-permanent'
          || ((item.profile === '3ds' || item.profile === 'dreamcast') && status === 'success')
        )
      })

    if (romWithoutArt.length === 0) {
      return
    }

    let cancelled = false

    const load = async () => {
      await runTasksWithConcurrency(romWithoutArt, COVER_LOOKUP_CONCURRENCY, () => cancelled, async (item) => {
        await resolveCoverArtEntry(
          item.entry,
          async () => {
            const metadata = await getRomMetadataArt({
              romPath: item.romPath,
              profile: item.profile ?? undefined,
              title: item.entry.title,
              allowOnlineFallback: ENABLE_ROM_ONLINE_COVER_FALLBACK
                && !ROM_EMBEDDED_ART_PROFILES.has(item.profile ?? ''),
            })

            if (!metadata) {
              return null
            }

            const metadataTitle = metadata.title?.trim()
            if (
              metadataTitle
              && shouldAdoptRomMetadataTitle(item.entry, item.romPath, metadataTitle)
            ) {
              setLibrary((previous) => previous.map((candidate) => {
                if (candidate.id !== item.entry.id) {
                  return candidate
                }

                if (normalizeGameTitle(candidate.title).trim().toLowerCase() === normalizeGameTitle(metadataTitle).trim().toLowerCase()) {
                  return candidate
                }

                return {
                  ...candidate,
                  title: metadataTitle,
                }
              }))
            }

            return metadata.iconDataUrl
          },
          () => cancelled,
        )
      })
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [
    library,
    coverLookupRefreshKey,
    isDeferredStartupReady,
    resolveCoverArtEntry,
    setLibrary,
  ])

  const removeGame = (id: string) => {
    const removedEntry = library.find((entry) => entry.id === id)
    const sessionsById = activeProcessLaunchesRef.current
    let removedSession = false
    for (const [sessionId, session] of Object.entries(sessionsById)) {
      if (session.gameId !== id) {
        continue
      }

      delete sessionsById[sessionId]
      if (steamUriExternalLockToken?.sessionId === sessionId) {
        clearSteamUriExternalLock()
      }
      removedSession = true
    }

    if (removedSession) {
      persistActiveProcessLaunches(sessionsById)
      syncActiveExternalSessionCount(sessionsById)
    }

    if (removedEntry && isManagedEntry(removedEntry)) {
      const managedKey = managedIdentityKey(removedEntry)
      setTitleOverridesByManagedKey((previous) => {
        if (!Object.prototype.hasOwnProperty.call(previous, managedKey)) {
          return previous
        }

        const next = { ...previous }
        delete next[managedKey]
        return next
      })
    }

    setLibrary((previous) => previous.filter((entry) => entry.id !== id))

    setGameMetaById((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setAchievementByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setCoverArtByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setCoverArtThumbByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setPlaytimeMinutesByGame((previous) => {
      if (!Object.prototype.hasOwnProperty.call(previous, id)) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setPlaytimeLookupDone((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setCoverArtStatusByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setCoverArtMetaByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setCoverSourceByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    setCustomCoverByGame((previous) => {
      if (!previous[id]) {
        return previous
      }

      const next = { ...previous }
      delete next[id]
      return next
    })

    removeGameScreenshots(id)
  }

  const renameGameTitle = (entry: GameEntry, nextTitleRaw: string) => {
    const nextTitle = normalizeGameTitle(nextTitleRaw).trim()
    if (!nextTitle) {
      setStatus('Game name cannot be empty.')
      return
    }

    if (normalizeGameTitle(entry.title).trim() === nextTitle) {
      setStatus('That game name is already in use for this entry.')
      return
    }

    setLibrary((previous) => previous.map((candidate) => {
      if (candidate.id !== entry.id) {
        return candidate
      }

      return {
        ...candidate,
        title: nextTitle,
      }
    }))

    if (isManagedEntry(entry)) {
      const managedKey = managedIdentityKey(entry)
      setTitleOverridesByManagedKey((previous) => ({
        ...previous,
        [managedKey]: nextTitle,
      }))
      setStatus(`Renamed to ${nextTitle}. This name is pinned for managed sync.`)
      return
    }

    setStatus(`Renamed to ${nextTitle}.`)
  }

  const isGameTitleOverridden = (entry: GameEntry): boolean => {
    if (!isManagedEntry(entry)) {
      return false
    }

    const managedKey = managedIdentityKey(entry)
    return typeof titleOverridesByManagedKey[managedKey] === 'string' && titleOverridesByManagedKey[managedKey].trim().length > 0
  }

  const resetGameTitleToAuto = async (entry: GameEntry) => {
    if (!isManagedEntry(entry)) {
      setStatus('Auto-name reset is only available for managed imports.')
      return
    }

    const managedKey = managedIdentityKey(entry)
    const nextTitleOverridesByManagedKey = { ...titleOverridesByManagedKey }
    const hadOverride = Object.prototype.hasOwnProperty.call(nextTitleOverridesByManagedKey, managedKey)
    if (hadOverride) {
      delete nextTitleOverridesByManagedKey[managedKey]
    }

    setTitleOverridesByManagedKey(nextTitleOverridesByManagedKey)

    if (hadOverride) {
      setStatus(`Reset ${entry.title} to its file-imported auto name. Resyncing managed imports...`)
    } else {
      setStatus(`Refreshing ${entry.title} from its file-imported auto name...`)
    }

    await autoImportGames(nextTitleOverridesByManagedKey)
  }

  const launchGame = async (entry: GameEntry) => {
    if (launchWipeTimerRef.current !== null) {
      window.clearTimeout(launchWipeTimerRef.current)
      launchWipeTimerRef.current = null
    }

    setIsLaunchWipeActive(false)
    window.requestAnimationFrame(() => {
      setIsLaunchWipeActive(true)
    })

    launchWipeTimerRef.current = window.setTimeout(() => {
      setIsLaunchWipeActive(false)
      launchWipeTimerRef.current = null
    }, 460)

    setStatus(`Launching ${entry.title}...`)

    try {
      const launchStartedAt = Date.now()
      const controllerSystemKey = resolveControllerSystemKeyForLaunch(entry, activeCategory)
      const controllerLaunchArgs = buildControllerLaunchArgsForSystem(controllerSystemKey, controllerBindsBySystem)
      const peripheralLaunchArgs = buildPlatformPeripheralLaunchArgs(controllerSystemKey, platformPeripheralsBySystem)
      const baseLaunchArgs = withPlatformLaunchArgs(entry.args, [...controllerLaunchArgs, ...peripheralLaunchArgs])
      
      let launchConfig = {
        kind: entry.kind,
        target: entry.target,
        args: baseLaunchArgs,
      }

      // For emulator games, resolve target from current configured emulator paths.
      if (entry.kind === 'emulator') {
        const settings = buildImportSettings()

        const candidateKeys = [
          mappedSystemEmulatorKey(entry, systemEmulatorMap),
          normalizeEmulatorKey(entry.emulatorKey),
          emulatorKeyFromProfileArg(entry.args),
          inferEmulatorKeyFromExecutablePath(entry.target),
        ].filter((key): key is EmulatorKey => key !== null)

        const seen = new Set<EmulatorKey>()
        const orderedCandidates = candidateKeys.filter((key) => {
          if (seen.has(key)) {
            return false
          }

          seen.add(key)
          return true
        })

        let resolvedKey: EmulatorKey | null = null
        let resolvedPath = ''

        for (const candidateKey of orderedCandidates) {
          const candidatePath = settings.emulatorPaths?.[candidateKey]?.trim() ?? ''
          if (!candidatePath) {
            continue
          }

          resolvedKey = candidateKey
          resolvedPath = candidatePath
          break
        }

        if (resolvedPath) {
          launchConfig = {
            kind: 'emulator',
            target: resolvedPath,
            args: [...baseLaunchArgs],
          }

          if (resolvedKey === 'retroarch') {
            const coreHint = managedArgValue(entry.args, 'core') ?? undefined
            const profile = profileFromArgs(entry.args) ?? undefined
            const romPath = firstLaunchArgRaw(entry.args) || undefined

            if (!coreHint) {
              setStatus(`Preparing RetroArch core for ${entry.title}...`)
            }

            const ensuredCore = await ensureRetroArchCore({
              retroarchPath: resolvedPath,
              profile,
              romPath,
              coreHint,
            })

            if (ensuredCore.downloaded) {
              const coreLabel = ensuredCore.coreKey ?? 'required core'
              setStatus(`Downloaded RetroArch core (${coreLabel}). Launching ${entry.title}...`)
            }

            if (!ensuredCore.corePath) {
              const profileLabel = profile ? profile.toUpperCase() : 'this ROM profile'
              throw new Error(
                `No compatible RetroArch core mapping is configured for ${profileLabel}. Set a dedicated emulator for this system in Settings.`,
              )
            }

            if (ensuredCore.corePath && !coreHint) {
              launchConfig.args = [
                ...launchConfig.args,
                `--tm-core=${ensuredCore.corePath}`,
              ]
            }
          }
        } else if (!isSpecialLauncherTarget(entry.target)) {
          launchConfig = {
            kind: 'emulator',
            target: entry.target,
            args: [...baseLaunchArgs],
          }
        } else {
          const fallbackKey = resolvedKey ?? orderedCandidates[0] ?? null
          if (fallbackKey) {
            throw new Error(`Emulator "${fallbackKey}" is not configured. Please set it up in Settings.`)
          }

          throw new Error('No configured emulator path was found for this ROM. Set an emulator path in Settings and try again.')
        }
      }

      const outcome = await launchGameCommand(launchConfig)
    const steamUriLockTimings = getSteamUriLockTimings(steamControllerCoexistenceMode)
    const shouldAutoEnterLowPower = lowPowerModeEnabled && steamControllerCoexistenceMode !== 'prefer_tilezu'
      const isSteamUriLaunch = outcome.mode === 'uri' && isLikelySteamEntry(entry)
      let launchSessionId: string | null = null

      if (outcome.mode === 'process' && outcome.pid) {
        launchSessionId = registerProcessLaunchSession(entry.id, outcome.pid, launchStartedAt)
      } else if (outcome.mode === 'uri') {
        const releaseEarliestAtMs = launchStartedAt + (isSteamUriLaunch ? steamUriLockTimings.minMs : URI_EXTERNAL_LOCK_MIN_MS)
        const releaseLatestAtMs = launchStartedAt + (isSteamUriLaunch ? steamUriLockTimings.maxMs : URI_EXTERNAL_LOCK_MAX_MS)
        launchSessionId = registerLaunchSession(entry.id, 'uri', {
          startedAtMs: launchStartedAt,
          isSteamUriSession: isSteamUriLaunch,
          releaseEarliestAtMs,
          releaseLatestAtMs,
        })

        if (isSteamUriLaunch && launchSessionId) {
          armSteamUriExternalLock(launchSessionId, launchStartedAt)
        }
      } else if (outcome.mode === 'shell') {
        launchSessionId = registerLaunchSession(entry.id, 'shell', {
          startedAtMs: launchStartedAt,
          releaseEarliestAtMs: launchStartedAt + URI_EXTERNAL_LOCK_MIN_MS,
          releaseLatestAtMs: launchStartedAt + URI_EXTERNAL_LOCK_MAX_MS,
        })
      }

      setGameMetaById((previous) => {
        const existing = previous[entry.id]
        if (!existing) {
          return {
            ...previous,
            [entry.id]: {
              addedAt: launchStartedAt,
              lastPlayedAt: launchStartedAt,
              playCount: 1,
              trackedPlaytimeMinutes: 0,
              isFavorite: false,
              favoritedAt: 0,
            },
          }
        }

        return {
          ...previous,
          [entry.id]: {
            ...existing,
            lastPlayedAt: launchStartedAt,
            playCount: (existing.playCount ?? 0) + 1,
            trackedPlaytimeMinutes: Math.max(0, Math.floor(existing.trackedPlaytimeMinutes ?? 0)),
          },
        }
      })

      if (outcome.mode === 'process') {
        setStatus(`Launch started for ${entry.title}${outcome.pid ? ` (pid ${outcome.pid})` : ''}.`)
      } else if (outcome.mode === 'uri') {
        setStatus(`Sent ${entry.title} launch request to system URI handler.`)
      } else {
        setStatus(`Launch request sent for ${entry.title}.`)
      }

      emitSignatureRungoReaction('launch-game', 'library-launch')

      if (shouldAutoEnterLowPower) {
        if (outcome.mode === 'uri') {
          steamUriExternalLockSawBackgroundRef.current = true
        }

        pendingLowPowerWakeOnDrainRef.current = true

        void enterAppLowPowerMode().catch(() => {
        })
      }
    } catch (error) {
      const decoded = decodeLaunchError(error)
      setStatus(`Launch failed: ${decoded.userMessage}`)
    }
  }

  const toggleFavoriteGame = (gameId: string) => {
    let becameFavorite = false

    setGameMetaById((previous) => {
      const existing = previous[gameId]
      if (!existing) {
        return previous
      }

      const nextIsFavorite = !existing.isFavorite
      becameFavorite = nextIsFavorite
      playFavoriteToggleSound(existing.isFavorite)

      return {
        ...previous,
        [gameId]: {
          ...existing,
          isFavorite: nextIsFavorite,
          favoritedAt: nextIsFavorite ? Date.now() : 0,
        },
      }
    })

    if (becameFavorite && launcherView === 'games' && gamesViewMode === 'list') {
      setFocusedGameId(gameId)
    }
  }

  const autoImportGames = async (titleOverrideSnapshot: Record<string, string> = titleOverridesByManagedKey) => {
    setIsImporting(true)
    setStatus('Scanning connectors and syncing managed library entries...')

    try {
      const settings = buildImportSettings()
      const result = await autoImportGamesOrchestrated(settings)
      const imported = result.imports
      setConnectorHealth(result.connectors)

      let addedCount = 0
      let removedCount = 0
      let updatedCount = 0
      let nextLibrarySnapshot: GameEntry[] = []
      setLibrary((previous) => {
        const normalizedImported: GameEntry[] = imported
          .map((item) => ({
            id: '',
            title: normalizedImportedTitle(item, romTitleCleanupEnabled),
            kind: item.kind,
            target: item.target,
            args: item.args,
            emulatorKey: item.emulatorKey,
            manualSystemKey: item.manualSystemKey,
          }))
          .filter((entry) => !isRedundantLauncherLink(entry))

        const importedByManagedKey = new Map<string, GameEntry>()
        for (const entry of normalizedImported) {
          const key = managedIdentityKey(entry)
          if (!importedByManagedKey.has(key)) {
            importedByManagedKey.set(key, entry)
          }
        }

        for (const [managedKey, overrideTitle] of Object.entries(titleOverrideSnapshot)) {
          const trimmedOverrideTitle = normalizeGameTitle(overrideTitle).trim()
          if (!trimmedOverrideTitle) {
            continue
          }

          const importedEntry = importedByManagedKey.get(managedKey)
          if (!importedEntry) {
            continue
          }

          if (normalizeGameTitle(importedEntry.title).trim() === trimmedOverrideTitle) {
            continue
          }

          importedByManagedKey.set(managedKey, {
            ...importedEntry,
            title: trimmedOverrideTitle,
          })
        }

        const importedByTitle = new Map<string, GameEntry>()
        for (const entry of importedByManagedKey.values()) {
          const titleKey = normalizeGameTitle(entry.title).trim().toLowerCase()
          if (!titleKey || importedByTitle.has(titleKey)) {
            continue
          }

          importedByTitle.set(titleKey, entry)
        }

        const importedManagedKeys = new Set(importedByManagedKey.keys())
        const keptManagedKeys = new Set<string>()
        let nextRemovedCount = 0
        let nextUpdatedCount = 0

        const mergedPrevious: GameEntry[] = []

        for (const entry of previous) {
          if (isRedundantLauncherLink(entry)) {
            nextRemovedCount += 1
            continue
          }

          if (!isManagedEntry(entry)) {
            const titleKey = normalizeGameTitle(entry.title).trim().toLowerCase()
            const importedByTitleEntry = titleKey ? importedByTitle.get(titleKey) : undefined

            if (importedByTitleEntry) {
              const importedKey = managedIdentityKey(importedByTitleEntry)
              if (!keptManagedKeys.has(importedKey)) {
                keptManagedKeys.add(importedKey)

                const titleChanged = normalizeGameTitle(entry.title) !== importedByTitleEntry.title
                const kindChanged = entry.kind !== importedByTitleEntry.kind
                const targetChanged = entry.target !== importedByTitleEntry.target
                const argsChanged = (entry.args ?? []).join('\u0000') !== (importedByTitleEntry.args ?? []).join('\u0000')
                const emulatorKeyChanged = (entry.emulatorKey ?? '') !== (importedByTitleEntry.emulatorKey ?? '')
                const manualSystemKeyChanged = (entry.manualSystemKey ?? '') !== (importedByTitleEntry.manualSystemKey ?? '')

                if (titleChanged || kindChanged || targetChanged || argsChanged || emulatorKeyChanged || manualSystemKeyChanged) {
                  nextUpdatedCount += 1
                }

                mergedPrevious.push({
                  ...entry,
                  title: importedByTitleEntry.title,
                  kind: importedByTitleEntry.kind,
                  target: importedByTitleEntry.target,
                  args: importedByTitleEntry.args,
                  emulatorKey: importedByTitleEntry.emulatorKey,
                  manualSystemKey: importedByTitleEntry.manualSystemKey,
                })
                continue
              }
            }

            mergedPrevious.push(entry)
            continue
          }

          const key = managedIdentityKey(entry)
          if (!importedManagedKeys.has(key)) {
            nextRemovedCount += 1
            continue
          }

          if (keptManagedKeys.has(key)) {
            nextRemovedCount += 1
            continue
          }

          keptManagedKeys.add(key)

          const importedEntry = importedByManagedKey.get(key)
          if (!importedEntry) {
            mergedPrevious.push(entry)
            continue
          }

          const titleChanged = normalizeGameTitle(entry.title) !== importedEntry.title
          const kindChanged = entry.kind !== importedEntry.kind
          const targetChanged = entry.target !== importedEntry.target
          const argsChanged = (entry.args ?? []).join('\u0000') !== (importedEntry.args ?? []).join('\u0000')
          const emulatorKeyChanged = (entry.emulatorKey ?? '') !== (importedEntry.emulatorKey ?? '')
          const manualSystemKeyChanged = (entry.manualSystemKey ?? '') !== (importedEntry.manualSystemKey ?? '')

          if (!titleChanged && !kindChanged && !targetChanged && !argsChanged && !emulatorKeyChanged && !manualSystemKeyChanged) {
            mergedPrevious.push(entry)
            continue
          }

          nextUpdatedCount += 1
          mergedPrevious.push({
            ...entry,
            title: importedEntry.title,
            kind: importedEntry.kind,
            target: importedEntry.target,
            args: importedEntry.args,
            emulatorKey: importedEntry.emulatorKey,
            manualSystemKey: importedEntry.manualSystemKey,
          })
        }

        removedCount = nextRemovedCount
        updatedCount = nextUpdatedCount
        const seenManaged = new Set(
          mergedPrevious
            .filter((entry) => isManagedEntry(entry))
            .map((entry) => managedIdentityKey(entry)),
        )
        const additions: GameEntry[] = []

        for (const [key, item] of importedByManagedKey.entries()) {
          if (seenManaged.has(key)) {
            continue
          }

          seenManaged.add(key)
          additions.push({
            id: crypto.randomUUID(),
            title: item.title,
            kind: item.kind,
            target: item.target,
            args: item.args,
            emulatorKey: item.emulatorKey,
            manualSystemKey: item.manualSystemKey,
          })
        }

        addedCount = additions.length
        const nextLibrary = [...additions, ...mergedPrevious]
        nextLibrarySnapshot = nextLibrary
        return nextLibrary
      })

      if (nextLibrarySnapshot.length > 0) {
        setCoverArtStatusByGame((previous) => {
          const next = { ...previous }
          let changed = false

          for (const entry of nextLibrarySnapshot) {
            if (customCoverByGame[entry.id] || coverArtByGame[entry.id] || coverArtThumbByGameRef.current[entry.id]) {
              continue
            }

            if (next[entry.id] === 'pending') {
              continue
            }

            next[entry.id] = 'pending'
            changed = true
          }

          return changed ? next : previous
        })

        setCoverLookupRefreshKey((previous) => previous + 1)
      }

      const setupConnector = result.connectors.find((connector) => connector.status !== 'ready')
      if (setupConnector && setupConnector.issues.length > 0 && imported.length === 0) {
        const issue = setupConnector.issues[0]
        setStatus(`Setup needed: ${setupConnector.label}. ${issue.message}`)
        if (
          issue.fixAction === 'configure_emulator_paths'
          || issue.fixAction === 'review_rom_dirs'
          || issue.fixAction === 'open_import_settings'
        ) {
          applyConnectorFixAction(issue.fixAction)
        }
        return
      }

      if (addedCount === 0 && removedCount === 0 && updatedCount === 0) {
        setStatus('Sync complete. Your managed library is already up to date.')
      } else {
        const parts: string[] = []
        if (addedCount > 0) {
          parts.push(`added ${addedCount}`)
        }
        if (updatedCount > 0) {
          parts.push(`updated ${updatedCount}`)
        }
        if (removedCount > 0) {
          parts.push(`removed ${removedCount} stale`)
        }
        setStatus(`Sync complete: ${parts.join(', ')} managed entries.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Auto import failed: ${message}`)
    } finally {
      setIsImporting(false)
    }
  }

  const fetchSteamAchievements = async (entry: GameEntry) => {
    const appId = parseSteamAppId(entry)
    if (!appId) {
      setStatus(`Steam app ID missing for ${entry.title}`)
      return
    }

    const key = steamApiKey.trim()
    const id = steamId.trim()

    if (!key || !id) {
      setStatus('Set Steam API key and SteamID64 in Settings first.')
      setActiveTab('settings')
      return
    }

    setLoadingAchievements((previous) => ({
      ...previous,
      [entry.id]: true,
    }))

    try {
      const response = await getSteamAchievements({
        apiKey: key,
        steamId: id,
        appId,
      })

      setAchievementByGame((previous) => ({
        ...previous,
        [entry.id]: response,
      }))

      setAchievementModalGameId(entry.id)
      setAchievementSearch('')
      setAchievementFilter('all')

      setStatus(`Loaded achievements for ${entry.title}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Achievement fetch failed: ${message}`)
    } finally {
      setLoadingAchievements((previous) => ({
        ...previous,
        [entry.id]: false,
      }))
    }
  }

  const addExecutable = async (): Promise<AddExecutableResult | null> => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Applications', extensions: ['exe', 'lnk', 'bat', 'cmd', 'ps1', 'url'] }],
      })

      if (!selected || Array.isArray(selected)) {
        return null
      }

      const filename = selected.split(/[\\/]/).pop() ?? selected
      const title = filename.replace(/\.[^.]+$/, '')

      const id = `exe_${Date.now()}`
      const entry: GameEntry = {
        id,
        title,
        kind: 'executable',
        target: selected,
        args: ['--tm-user-added=1'],
      }

      setLibrary((prev) => [...prev, entry])

      let iconExtracted = false
      let warning: string | undefined
      try {
        const dataUrl = await extractExeIconDataUrl(selected)
        if (dataUrl) {
          setCustomCoverByGame((previous) => ({
            ...previous,
            [id]: dataUrl,
          }))
          setCoverArtByGame((previous) => ({
            ...previous,
            [id]: dataUrl,
          }))
          setCoverArtThumbByGame((previous) => ({
            ...previous,
            [id]: dataUrl,
          }))
          setCoverArtStatusByGame((previous) => ({
            ...previous,
            [id]: 'success',
          }))
          setCoverProvenance(id, 'custom', 'custom')
          iconExtracted = true
        } else {
          warning = 'No badge icon metadata was available for this file.'
        }
      } catch {
        warning = 'Could not extract a badge icon from this file. You can add cover art manually.'
      }

      return {
        gameId: id,
        title,
        iconExtracted,
        warning,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`File picker failed: ${message}`)
      return null
    }
  }

  const addRomFolder = async () => {
    try {
      const configuredFolders = romDirsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      const defaultPath = await resolveDialogDefaultDirectoryFromCandidates(configuredFolders)

      const selected = await openDialog({
        directory: true,
        multiple: false,
        ...(defaultPath ? { defaultPath } : {}),
      })

      if (!selected || Array.isArray(selected)) {
        return
      }

      setRomDirsText((previous) => {
        const existing = previous
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)

        if (existing.some((entry) => entry.localeCompare(selected, undefined, { sensitivity: 'accent' }) === 0)) {
          return previous
        }

        return [...existing, selected].join('\n')
      })
      setStatus(`Added ROM folder: ${selected}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`ROM folder picker failed: ${message}`)
    }
  }

  const browseEmulatorPath = async (emulator?: EmulatorKey): Promise<EmulatorKey | null> => {
    try {
      const configuredPath = emulator ? (emulatorPaths[emulator] ?? '').trim() : ''
      const defaultPath = await resolveDialogDefaultDirectory(configuredPath)

      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Executable', extensions: ['exe'] }],
        ...(defaultPath ? { defaultPath } : {}),
      })

      if (!selected || Array.isArray(selected)) {
        return null
      }

      const resolvedEmulator = emulator ?? inferEmulatorKeyFromExecutablePath(selected)
      if (!resolvedEmulator) {
        setStatus('Could not detect emulator from executable name. Use per-emulator Browse buttons in Settings.')
        return null
      }

      setEmulatorPaths((previous) => ({
        ...previous,
        [resolvedEmulator]: selected,
      }))
      setStatus(`${emulatorLabelForKey(resolvedEmulator)} path updated.`)
      return resolvedEmulator
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`File picker failed: ${message}`)
      return null
    }
  }

  const steamBrowserLogin = async () => {
    setIsSteamLoginBusy(true)
    setStatus('Opening browser for Steam login...')

    try {
      const start = await steamBrowserLoginStart()

      const maxPolls = 180
      for (let attempt = 0; attempt < maxPolls; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const poll = await steamBrowserLoginPoll(start.sessionId)

        if (poll.status === 'pending') {
          continue
        }

        if (poll.status === 'success' && poll.steamId) {
          setSteamId(poll.steamId)
          setStatus('Steam login successful. SteamID64 has been saved in settings.')
          return
        }

        setStatus(`Steam browser login failed: ${poll.error ?? 'Unknown login error'}`)
        return
      }

      setStatus('Steam login timed out. Please try again and complete login in the opened browser tab.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Steam browser login failed: ${message}`)
    } finally {
      setIsSteamLoginBusy(false)
    }
  }

  const openSteamApiKeyPage = async () => {
    try {
      await launchGameCommand({
        kind: 'uri',
        target: 'https://steamcommunity.com/dev/apikey',
        args: [],
      })
      setStatus('Opened Steam API key page in your browser.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Failed to open API key page: ${message}`)
    }
  }

  const testSteamConnection = async (): Promise<boolean> => {
    const key = steamApiKey.trim()
    const id = steamId.trim()

    if (!key || !id) {
      setStatus('Enter Steam API key and SteamID64 first.')
      return false
    }

    setIsSteamTestBusy(true)
    setStatus('Testing Steam connection...')

    try {
      const result = await testSteamConnectionCommand({
        apiKey: key,
        steamId: id,
      })

      setStatus(`Steam connection OK: ${result.personaName} (${result.steamId})`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Steam connection failed: ${message}`)
      return false
    } finally {
      setIsSteamTestBusy(false)
    }
  }

  const logoutSteam = () => {
    setSteamId('')
    setStatus('Logged out of Steam in app settings. You can log in again anytime.')
  }

  const uploadCustomCover = async (entry: GameEntry) => {
    try {
      const selected = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      })

      if (!selected || Array.isArray(selected)) {
        return
      }

      const dataUrl = await readLocalImageAsDataUrl(selected)
      const decodedImage = await loadImageElementFromDataUrl(dataUrl)

      if (decodedImage.naturalWidth < 24 || decodedImage.naturalHeight < 24) {
        throw new Error('Image is too small. Use an image at least 24x24 pixels.')
      }

      setCustomCoverCropRequest({
        entryId: entry.id,
        title: entry.title,
        sourceDataUrl: dataUrl,
        naturalWidth: decodedImage.naturalWidth,
        naturalHeight: decodedImage.naturalHeight,
      })

      setStatus(`Choose how to save ${entry.title}: crop it or keep the full image with compression.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Custom cover upload failed: ${message}`)
    }
  }

  const cancelCustomCoverCrop = useCallback(() => {
    if (isApplyingCustomCoverCrop) {
      return
    }

    setCustomCoverCropRequest(null)
    setStatus('Custom cover selection canceled.')
  }, [isApplyingCustomCoverCrop, setStatus])

  const commitCustomCoverDataUrl = useCallback((request: CustomCoverCropRequest, dataUrl: string) => {
    setCustomCoverByGame((previous) => ({
      ...previous,
      [request.entryId]: dataUrl,
    }))

    setCoverArtStatusByGame((previous) => ({
      ...previous,
      [request.entryId]: 'success',
    }))

    setCoverProvenance(request.entryId, 'custom', 'custom')
    setCustomCoverCropRequest(null)
  }, [setCustomCoverByGame, setCoverArtStatusByGame, setCoverProvenance])

  const applyCustomCoverCrop = useCallback(async (selection: CustomCoverCropSelection) => {
    const request = customCoverCropRequest
    if (!request || isApplyingCustomCoverCrop) {
      return
    }

    setIsApplyingCustomCoverCrop(true)

    try {
      const croppedDataUrl = await cropCustomCoverToOptimizedDataUrl(request, selection)

      commitCustomCoverDataUrl(request, croppedDataUrl)
      setStatus(`Custom cover saved for ${request.title}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Custom cover upload failed: ${message}`)
    } finally {
      setIsApplyingCustomCoverCrop(false)
    }
  }, [commitCustomCoverDataUrl, customCoverCropRequest, isApplyingCustomCoverCrop, setStatus])

  const applyCustomCoverFullArt = useCallback(async () => {
    const request = customCoverCropRequest
    if (!request || isApplyingCustomCoverCrop) {
      return
    }

    setIsApplyingCustomCoverCrop(true)

    try {
      const compressedDataUrl = await compressCustomCoverFullArtToOptimizedDataUrl(request)
      commitCustomCoverDataUrl(request, compressedDataUrl)
      setStatus(`Full cover saved for ${request.title} (compressed).`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus(`Custom cover upload failed: ${message}`)
    } finally {
      setIsApplyingCustomCoverCrop(false)
    }
  }, [commitCustomCoverDataUrl, customCoverCropRequest, isApplyingCustomCoverCrop, setStatus])

  const openAchievementModal = (gameId: string) => {
    if (!achievementByGame[gameId]) {
      return
    }

    setAchievementSearch('')
    setAchievementFilter('all')
    setAchievementModalGameId(gameId)
  }

  const handleTileAchievementAction = (entry: GameEntry) => {
    if (achievementByGame[entry.id]) {
      openAchievementModal(entry.id)
      return
    }

    fetchSteamAchievements(entry)
  }

  const refreshCoverLookup = useCallback(() => {
    setCoverLookupRefreshKey((previous) => previous + 1)
  }, [])

  const hasActiveExternalSession = activeExternalSessionCount > 0 || steamUriExternalLockActive

  return {
    hasActiveExternalSession,
    activeExternalSessionCount,
    connectorHealth,
    applyConnectorFixAction,
    selectedAchievementGame,
    removeGame,
    launchGame,
    renameGameTitle,
    resetGameTitleToAuto,
    isGameTitleOverridden,
    toggleFavoriteGame,
    autoImportGames,
    fetchSteamAchievements,
    addRomFolder,
    addExecutable,
    browseEmulatorPath,
    steamBrowserLogin,
    openSteamApiKeyPage,
    testSteamConnection,
    logoutSteam,
    uploadCustomCover,
    customCoverCropRequest,
    isApplyingCustomCoverCrop,
    cancelCustomCoverCrop,
    applyCustomCoverCrop,
    applyCustomCoverFullArt,
    openAchievementModal,
    handleTileAchievementAction,
    refreshCoverLookup,
    recheckExternalSessions,
  }
}
