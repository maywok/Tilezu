import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import iconScrollSound from '../../../assets/sounds/iconScroll.wav'
import searchbarHoverSound from '../../../assets/sounds/searchbar/searchbarHover.wav'
import searchbarSelectSound from '../../../assets/sounds/searchbar/searchbarSelect.wav'
import favoriteDeselectSound from '../../../assets/sounds/favoriteDeselect.wav'
import favoriteSelectSound from '../../../assets/sounds/favoriteSelect.wav'
import selectedGameSound from '../../../assets/sounds/selectedGame.wav'
import selectedSystemSound from '../../../assets/sounds/selectedSystem.wav'
import {
  iconVineSound,
  settingsErrorSound,
  settingsHoverSound,
  settingsSelectTabSound,
  settingsSwitchOptionSound,
  settingsSliderSound,
  systemCollageSound,
} from '../../../assets/sounds/settings'
import { SETTINGS_KEY, STORAGE_KEY, ROM_SYSTEM_FOLDERS } from '../constants'
import type {
  AppTab,
  EmulatorKey,
  GameEntry,
  GameLibraryMeta,
  GraphicsFidelityMode,
  GridGroupMode,
  GridSizeMode,
  GridSortMode,
  LauncherControllerBindsBySystem,
  LauncherControllerSystemBinds,
  SteamControllerCoexistenceMode,
} from '../types'
import { createDefaultControllerSystemBinds, normalizeControllerBindsBySystem, normalizeLauncherControllerBinds } from '../utils/controllerBindings'
import { normalizePlatformPeripheralsBySystem } from '../utils/platformPeripherals'
import type { PlatformPeripheralsBySystem } from '../utils/platformPeripherals'
import { normalizeGameTitle } from '../utils/search'
import { createBootPerfSpan, timeBootSync } from '../../../utils/bootPerf'
import { LAUNCHER_UI_SOUND_BASE_VOLUMES, scaleUiSoundVolume } from '../../settings/uiSoundVolume'

type UseLauncherPersistenceAudioEffectsParams = {
  library: GameEntry[]
  setLibrary: Dispatch<SetStateAction<GameEntry[]>>
  setStatus: (value: string) => void
  selectedSystemAudioRef: MutableRefObject<HTMLAudioElement | null>
  selectedGameAudioRef: MutableRefObject<HTMLAudioElement | null>
  iconScrollAudioRef: MutableRefObject<HTMLAudioElement | null>
  functionsBarHoverAudioRef: MutableRefObject<HTMLAudioElement | null>
  functionsBarSelectAudioRef: MutableRefObject<HTMLAudioElement | null>
  favoriteSelectAudioRef: MutableRefObject<HTMLAudioElement | null>
  favoriteDeselectAudioRef: MutableRefObject<HTMLAudioElement | null>
  activeUiOneShotAudioRef: MutableRefObject<Set<HTMLAudioElement>>
  settingsSelectTabAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsSwitchOptionAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsHoverAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsIconVineAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsSystemCollageAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsErrorAudioRef: MutableRefObject<HTMLAudioElement | null>
  settingsSliderAudioRef: MutableRefObject<HTMLAudioElement | null>
  romDirsText: string
  setRomDirsText: (value: string) => void
  emulatorPaths: Record<EmulatorKey, string>
  setEmulatorPaths: Dispatch<SetStateAction<Record<EmulatorKey, string>>>
  systemEmulatorMap: Record<string, EmulatorKey>
  setSystemEmulatorMap: Dispatch<SetStateAction<Record<string, EmulatorKey>>>
  controllerBindsBySystem: LauncherControllerBindsBySystem
  setControllerBindsBySystem: Dispatch<SetStateAction<LauncherControllerBindsBySystem>>
  launcherControllerBinds: LauncherControllerSystemBinds
  setLauncherControllerBinds: Dispatch<SetStateAction<LauncherControllerSystemBinds>>
  platformPeripheralsBySystem: PlatformPeripheralsBySystem
  setPlatformPeripheralsBySystem: Dispatch<SetStateAction<PlatformPeripheralsBySystem>>
  romTitleCleanupEnabled: boolean
  setRomTitleCleanupEnabled: (value: boolean) => void
  titleOverridesByManagedKey: Record<string, string>
  setTitleOverridesByManagedKey: Dispatch<SetStateAction<Record<string, string>>>
  steamApiKey: string
  setSteamApiKey: (value: string) => void
  steamId: string
  setSteamId: (value: string) => void
  audioTextureEnabled: boolean
  setAudioTextureEnabled: (value: boolean) => void
  lowPowerModeEnabled: boolean
  setLowPowerModeEnabled: (value: boolean) => void
  steamControllerCoexistenceMode: SteamControllerCoexistenceMode
  setSteamControllerCoexistenceMode: (value: SteamControllerCoexistenceMode) => void
  graphicsFidelityMode: GraphicsFidelityMode
  setGraphicsFidelityMode: (mode: GraphicsFidelityMode) => void
  audioTextureLevel: number
  setAudioTextureLevel: (value: number) => void
  uiSoundVolume: number
  setUiSoundVolume: (value: number) => void
  menuMusicEnabled: boolean
  setMenuMusicEnabled: (value: boolean) => void
  menuMusicVolume: number
  setMenuMusicVolume: (value: number) => void
  preferExternalMedia: boolean
  setPreferExternalMedia: (value: boolean) => void
  customCoverByGame: Record<string, string>
  setCustomCoverByGame: (value: Record<string, string>) => void
  gameMetaById: Record<string, GameLibraryMeta>
  setGameMetaById: Dispatch<SetStateAction<Record<string, GameLibraryMeta>>>
  gridSortMode: GridSortMode
  setGridSortMode: (mode: GridSortMode) => void
  gridGroupMode: GridGroupMode
  setGridGroupMode: (mode: GridGroupMode) => void
  gridSizeMode: GridSizeMode
  setGridSizeMode: (mode: GridSizeMode) => void
  isDeferredStartupReady: boolean
  activeTab: AppTab
  appLowPowerActive: boolean
  plipAudioContextRef: MutableRefObject<AudioContext | null>
  rainBedSourceRef: MutableRefObject<AudioBufferSourceNode | null>
  rainBedGainRef: MutableRefObject<GainNode | null>
  rainBedFilterRef: MutableRefObject<BiquadFilterNode | null>
  achievementModalGameId: string | null
  setAchievementModalGameId: (value: string | null) => void
}

export function useLauncherPersistenceAudioEffects({
  library,
  setLibrary,
  setStatus,
  selectedSystemAudioRef,
  selectedGameAudioRef,
  iconScrollAudioRef,
  functionsBarHoverAudioRef,
  functionsBarSelectAudioRef,
  favoriteSelectAudioRef,
  favoriteDeselectAudioRef,
  activeUiOneShotAudioRef,
  settingsSelectTabAudioRef,
  settingsSwitchOptionAudioRef,
  settingsHoverAudioRef,
  settingsIconVineAudioRef,
  settingsSystemCollageAudioRef,
  settingsErrorAudioRef,
  settingsSliderAudioRef,
  romDirsText,
  setRomDirsText,
  emulatorPaths,
  setEmulatorPaths,
  systemEmulatorMap,
  setSystemEmulatorMap,
  controllerBindsBySystem,
  setControllerBindsBySystem,
  launcherControllerBinds,
  setLauncherControllerBinds,
  platformPeripheralsBySystem,
  setPlatformPeripheralsBySystem,
  romTitleCleanupEnabled,
  setRomTitleCleanupEnabled,
  titleOverridesByManagedKey,
  setTitleOverridesByManagedKey,
  steamApiKey,
  setSteamApiKey,
  steamId,
  setSteamId,
  audioTextureEnabled,
  setAudioTextureEnabled,
  lowPowerModeEnabled,
  setLowPowerModeEnabled,
  steamControllerCoexistenceMode,
  setSteamControllerCoexistenceMode,
  graphicsFidelityMode,
  setGraphicsFidelityMode,
  audioTextureLevel,
  setAudioTextureLevel,
  uiSoundVolume,
  setUiSoundVolume,
  menuMusicEnabled,
  setMenuMusicEnabled,
  menuMusicVolume,
  setMenuMusicVolume,
  preferExternalMedia,
  setPreferExternalMedia,
  customCoverByGame,
  setCustomCoverByGame,
  gameMetaById,
  setGameMetaById,
  gridSortMode,
  setGridSortMode,
  gridGroupMode,
  setGridGroupMode,
  gridSizeMode,
  setGridSizeMode,
  isDeferredStartupReady,
  activeTab,
  appLowPowerActive,
  plipAudioContextRef,
  rainBedSourceRef,
  rainBedGainRef,
  rainBedFilterRef,
  achievementModalGameId,
  setAchievementModalGameId,
}: UseLauncherPersistenceAudioEffectsParams) {
  const isEmulatorKey = (value: unknown): value is EmulatorKey => {
    return value === 'retroarch'
      || value === 'eden'
      || value === '3ds'
      || value === 'dolphin'
      || value === 'pcsx2'
      || value === 'ppsspp'
      || value === 'cemu'
      || value === 'rpcs3'
      || value === 'ds'
  }

  useEffect(() => {
    const span = createBootPerfSpan('launcher-persistence:library-load')
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      span.end({ hasStoredLibrary: false })
      return
    }

    try {
      const parsed = timeBootSync('launcher-persistence:library-parse-json', () => JSON.parse(raw) as GameEntry[])
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map((entry) => ({
          ...entry,
          title: normalizeGameTitle(entry.title),
        }))
        setLibrary(normalized)
        span.end({ hasStoredLibrary: true, loadedEntries: normalized.length })
        return
      }

      span.end({ hasStoredLibrary: true, loadedEntries: 0 })
    } catch {
      setStatus('Failed to load saved library. Using starter entries.')
      span.end({ hasStoredLibrary: true, parseFailed: true })
    }
  }, [setLibrary, setStatus])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('quota')) {
        setStatus('Could not save library changes because local storage is full.')
        return
      }

      setStatus(`Could not save library changes: ${message}`)
    }
  }, [library, setStatus])

  useEffect(() => {
    const selectedSystemAudio = new Audio(selectedSystemSound)
    selectedSystemAudio.preload = 'auto'
    selectedSystemAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.selectedSystem, uiSoundVolume)
    selectedSystemAudioRef.current = selectedSystemAudio

    const selectedGameAudio = new Audio(selectedGameSound)
    selectedGameAudio.preload = 'auto'
    selectedGameAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.selectedGame, uiSoundVolume)
    selectedGameAudioRef.current = selectedGameAudio

    const iconAudio = new Audio(iconScrollSound)
    iconAudio.preload = 'auto'
    iconAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.iconScroll, uiSoundVolume)
    iconScrollAudioRef.current = iconAudio

    const functionsBarHoverAudio = new Audio(searchbarHoverSound)
    functionsBarHoverAudio.preload = 'auto'
    functionsBarHoverAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.functionsBarHover, uiSoundVolume)
    functionsBarHoverAudioRef.current = functionsBarHoverAudio

    const functionsBarSelectAudio = new Audio(searchbarSelectSound)
    functionsBarSelectAudio.preload = 'auto'
    functionsBarSelectAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.functionsBarSelect, uiSoundVolume)
    functionsBarSelectAudioRef.current = functionsBarSelectAudio

    const favoriteSelectAudio = new Audio(favoriteSelectSound)
    favoriteSelectAudio.preload = 'auto'
    favoriteSelectAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.favoriteSelect, uiSoundVolume)
    favoriteSelectAudioRef.current = favoriteSelectAudio

    const favoriteDeselectAudio = new Audio(favoriteDeselectSound)
    favoriteDeselectAudio.preload = 'auto'
    favoriteDeselectAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.favoriteDeselect, uiSoundVolume)
    favoriteDeselectAudioRef.current = favoriteDeselectAudio

    const settingsSelectTabAudio = new Audio(settingsSelectTabSound)
    settingsSelectTabAudio.preload = 'auto'
    settingsSelectTabAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSelectTab, uiSoundVolume)
    settingsSelectTabAudioRef.current = settingsSelectTabAudio

    const settingsSwitchOptionAudio = new Audio(settingsSwitchOptionSound)
    settingsSwitchOptionAudio.preload = 'auto'
    settingsSwitchOptionAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSwitchOption, uiSoundVolume)
    settingsSwitchOptionAudioRef.current = settingsSwitchOptionAudio

    const settingsHoverAudio = new Audio(settingsHoverSound)
    settingsHoverAudio.preload = 'auto'
    settingsHoverAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsHover, uiSoundVolume)
    settingsHoverAudioRef.current = settingsHoverAudio

    const settingsIconVineAudio = new Audio(iconVineSound)
    settingsIconVineAudio.preload = 'auto'
    settingsIconVineAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsIconVine, uiSoundVolume)
    settingsIconVineAudioRef.current = settingsIconVineAudio

    const settingsSystemCollageAudio = new Audio(systemCollageSound)
    settingsSystemCollageAudio.preload = 'auto'
    settingsSystemCollageAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSystemCollage, uiSoundVolume)
    settingsSystemCollageAudioRef.current = settingsSystemCollageAudio

    const settingsErrorAudio = new Audio(settingsErrorSound)
    settingsErrorAudio.preload = 'auto'
    settingsErrorAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsError, uiSoundVolume)
    settingsErrorAudioRef.current = settingsErrorAudio

    const settingsSliderAudio = new Audio(settingsSliderSound)
    settingsSliderAudio.preload = 'auto'
    settingsSliderAudio.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSlider, uiSoundVolume)
    settingsSliderAudioRef.current = settingsSliderAudio

    return () => {
      if (selectedSystemAudioRef.current) {
        selectedSystemAudioRef.current.pause()
        selectedSystemAudioRef.current.src = ''
        selectedSystemAudioRef.current = null
      }

      if (selectedGameAudioRef.current) {
        selectedGameAudioRef.current.pause()
        selectedGameAudioRef.current.src = ''
        selectedGameAudioRef.current = null
      }

      if (iconScrollAudioRef.current) {
        iconScrollAudioRef.current.pause()
        iconScrollAudioRef.current.src = ''
        iconScrollAudioRef.current = null
      }

      if (functionsBarHoverAudioRef.current) {
        functionsBarHoverAudioRef.current.pause()
        functionsBarHoverAudioRef.current.src = ''
        functionsBarHoverAudioRef.current = null
      }

      if (functionsBarSelectAudioRef.current) {
        functionsBarSelectAudioRef.current.pause()
        functionsBarSelectAudioRef.current.src = ''
        functionsBarSelectAudioRef.current = null
      }

      if (favoriteSelectAudioRef.current) {
        favoriteSelectAudioRef.current.pause()
        favoriteSelectAudioRef.current.src = ''
        favoriteSelectAudioRef.current = null
      }

      if (favoriteDeselectAudioRef.current) {
        favoriteDeselectAudioRef.current.pause()
        favoriteDeselectAudioRef.current.src = ''
        favoriteDeselectAudioRef.current = null
      }

      const settingsAudioRefs = [
        settingsSelectTabAudioRef,
        settingsSwitchOptionAudioRef,
        settingsHoverAudioRef,
        settingsIconVineAudioRef,
        settingsSystemCollageAudioRef,
        settingsErrorAudioRef,
        settingsSliderAudioRef,
      ]

      for (const ref of settingsAudioRefs) {
        if (ref.current) {
          ref.current.pause()
          ref.current.src = ''
          ref.current = null
        }
      }

      for (const audio of activeUiOneShotAudioRef.current) {
        audio.pause()
        audio.src = ''
      }
      activeUiOneShotAudioRef.current.clear()
    }
  }, [
    activeUiOneShotAudioRef,
    favoriteDeselectAudioRef,
    favoriteSelectAudioRef,
    functionsBarHoverAudioRef,
    functionsBarSelectAudioRef,
    iconScrollAudioRef,
    selectedGameAudioRef,
    selectedSystemAudioRef,
    settingsErrorAudioRef,
    settingsHoverAudioRef,
    settingsIconVineAudioRef,
    settingsSelectTabAudioRef,
    settingsSwitchOptionAudioRef,
    settingsSystemCollageAudioRef,
    settingsSliderAudioRef,
    uiSoundVolume,
  ])

  useEffect(() => {
    if (selectedSystemAudioRef.current) {
      selectedSystemAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.selectedSystem, uiSoundVolume)
    }

    if (selectedGameAudioRef.current) {
      selectedGameAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.selectedGame, uiSoundVolume)
    }

    if (iconScrollAudioRef.current) {
      iconScrollAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.iconScroll, uiSoundVolume)
    }

    if (functionsBarHoverAudioRef.current) {
      functionsBarHoverAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.functionsBarHover, uiSoundVolume)
    }

    if (functionsBarSelectAudioRef.current) {
      functionsBarSelectAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.functionsBarSelect, uiSoundVolume)
    }

    if (favoriteSelectAudioRef.current) {
      favoriteSelectAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.favoriteSelect, uiSoundVolume)
    }

    if (favoriteDeselectAudioRef.current) {
      favoriteDeselectAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.favoriteDeselect, uiSoundVolume)
    }

    if (settingsSelectTabAudioRef.current) {
      settingsSelectTabAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSelectTab, uiSoundVolume)
    }

    if (settingsSwitchOptionAudioRef.current) {
      settingsSwitchOptionAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSwitchOption, uiSoundVolume)
    }

    if (settingsHoverAudioRef.current) {
      settingsHoverAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsHover, uiSoundVolume)
    }

    if (settingsIconVineAudioRef.current) {
      settingsIconVineAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsIconVine, uiSoundVolume)
    }

    if (settingsSystemCollageAudioRef.current) {
      settingsSystemCollageAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSystemCollage, uiSoundVolume)
    }

    if (settingsErrorAudioRef.current) {
      settingsErrorAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsError, uiSoundVolume)
    }

    if (settingsSliderAudioRef.current) {
      settingsSliderAudioRef.current.volume = scaleUiSoundVolume(LAUNCHER_UI_SOUND_BASE_VOLUMES.settingsSlider, uiSoundVolume)
    }
  }, [
    favoriteDeselectAudioRef,
    favoriteSelectAudioRef,
    functionsBarHoverAudioRef,
    functionsBarSelectAudioRef,
    iconScrollAudioRef,
    selectedGameAudioRef,
    selectedSystemAudioRef,
    settingsErrorAudioRef,
    settingsHoverAudioRef,
    settingsIconVineAudioRef,
    settingsSelectTabAudioRef,
    settingsSwitchOptionAudioRef,
    settingsSystemCollageAudioRef,
    settingsSliderAudioRef,
    uiSoundVolume,
  ])

  useEffect(() => {
    const span = createBootPerfSpan('launcher-persistence:settings-load')
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      span.end({ hasSettings: false })
      return
    }

    try {
      const parsed = timeBootSync('launcher-persistence:settings-parse-json', () => JSON.parse(raw) as {
        romDirsText?: string
        emulatorPaths?: Partial<Record<EmulatorKey, string>>
        systemEmulatorMap?: Record<string, unknown>
        controllerBindsBySystem?: unknown
        launcherControllerBinds?: unknown
        platformPeripheralsBySystem?: unknown
        romTitleCleanupEnabled?: boolean
        titleOverridesByManagedKey?: Record<string, unknown>
        steamApiKey?: string
        steamId?: string
        audioTextureEnabled?: boolean
        lowPowerModeEnabled?: boolean
        steamControllerCoexistenceMode?: SteamControllerCoexistenceMode
        graphicsFidelityMode?: GraphicsFidelityMode
        audioTextureLevel?: number
        uiSoundVolume?: number
        menuMusicEnabled?: boolean
        menuMusicVolume?: number
        preferExternalMedia?: boolean
        customCoverByGame?: Record<string, string>
        gameMetaById?: Record<string, Partial<GameLibraryMeta>>
        gridSortMode?: GridSortMode
        gridGroupMode?: GridGroupMode
        gridSizeMode?: GridSizeMode
      })

      if (typeof parsed.romDirsText === 'string') {
        setRomDirsText(parsed.romDirsText)
      }

      if (parsed.emulatorPaths) {
        setEmulatorPaths((previous) => ({
          ...previous,
          ...parsed.emulatorPaths,
        }))
      }

      if (parsed.systemEmulatorMap && typeof parsed.systemEmulatorMap === 'object') {
        const normalizedEntries = Object.entries(parsed.systemEmulatorMap)
          .map(([systemKey, emulatorKey]) => [systemKey.trim(), emulatorKey] as const)
          .filter(([systemKey, emulatorKey]) => systemKey.length > 0 && isEmulatorKey(emulatorKey))
          .map(([systemKey, emulatorKey]) => [systemKey, emulatorKey] as const)

        if (normalizedEntries.length > 0) {
          const normalized = Object.fromEntries(normalizedEntries) as Record<string, EmulatorKey>
          setSystemEmulatorMap((previous) => ({
            ...previous,
            ...normalized,
          }))
        }
      }

      if (parsed.controllerBindsBySystem !== undefined) {
        const normalizedPlatformBinds = normalizeControllerBindsBySystem(parsed.controllerBindsBySystem)
        setControllerBindsBySystem(normalizedPlatformBinds)

        if (parsed.launcherControllerBinds === undefined) {
          const migrationKey = ROM_SYSTEM_FOLDERS[0]?.folder
          const migratedLauncherBinds = migrationKey && normalizedPlatformBinds[migrationKey]
            ? {
                layout: normalizedPlatformBinds[migrationKey].layout,
                bindings: { ...normalizedPlatformBinds[migrationKey].bindings },
              }
            : createDefaultControllerSystemBinds()
          setLauncherControllerBinds(migratedLauncherBinds)
        }
      }

      if (parsed.launcherControllerBinds !== undefined) {
        setLauncherControllerBinds(normalizeLauncherControllerBinds(parsed.launcherControllerBinds))
      }

      if (parsed.platformPeripheralsBySystem !== undefined) {
        setPlatformPeripheralsBySystem(normalizePlatformPeripheralsBySystem(parsed.platformPeripheralsBySystem))
      }

      if (typeof parsed.romTitleCleanupEnabled === 'boolean') {
        setRomTitleCleanupEnabled(parsed.romTitleCleanupEnabled)
      }

      if (parsed.titleOverridesByManagedKey && typeof parsed.titleOverridesByManagedKey === 'object') {
        const normalizedEntries = Object.entries(parsed.titleOverridesByManagedKey)
          .map(([managedKey, overrideTitle]) => {
            const key = managedKey.trim()
            const title = typeof overrideTitle === 'string' ? normalizeGameTitle(overrideTitle).trim() : ''
            return [key, title] as const
          })
          .filter(([managedKey, overrideTitle]) => managedKey.length > 0 && overrideTitle.length > 0)

        const normalized = Object.fromEntries(normalizedEntries) as Record<string, string>
        setTitleOverridesByManagedKey(normalized)
      }

      if (typeof parsed.steamApiKey === 'string') {
        setSteamApiKey(parsed.steamApiKey)
      }

      if (typeof parsed.steamId === 'string') {
        setSteamId(parsed.steamId)
      }

      if (typeof parsed.audioTextureEnabled === 'boolean') {
        setAudioTextureEnabled(parsed.audioTextureEnabled)
      }

      if (typeof parsed.lowPowerModeEnabled === 'boolean') {
        setLowPowerModeEnabled(parsed.lowPowerModeEnabled)
      }

      if (
        parsed.steamControllerCoexistenceMode === 'balanced'
        || parsed.steamControllerCoexistenceMode === 'prefer_steam'
        || parsed.steamControllerCoexistenceMode === 'prefer_tilezu'
      ) {
        setSteamControllerCoexistenceMode(parsed.steamControllerCoexistenceMode)
      }

      if (
        parsed.graphicsFidelityMode === 'normal'
        || parsed.graphicsFidelityMode === 'lite'
        || parsed.graphicsFidelityMode === 'ultra-lite'
        || parsed.graphicsFidelityMode === 'ultra'
      ) {
        setGraphicsFidelityMode(parsed.graphicsFidelityMode)
      }

      if (typeof parsed.audioTextureLevel === 'number' && Number.isFinite(parsed.audioTextureLevel)) {
        setAudioTextureLevel(Math.max(0, Math.min(1, parsed.audioTextureLevel)))
      }

      if (typeof parsed.uiSoundVolume === 'number' && Number.isFinite(parsed.uiSoundVolume)) {
        setUiSoundVolume(Math.max(0, Math.min(1, parsed.uiSoundVolume)))
      }

      if (typeof parsed.menuMusicEnabled === 'boolean') {
        setMenuMusicEnabled(parsed.menuMusicEnabled)
      }

      if (typeof parsed.menuMusicVolume === 'number' && Number.isFinite(parsed.menuMusicVolume)) {
        setMenuMusicVolume(Math.max(0, Math.min(1, parsed.menuMusicVolume)))
      }

      if (typeof parsed.preferExternalMedia === 'boolean') {
        setPreferExternalMedia(parsed.preferExternalMedia)
      }

      if (parsed.customCoverByGame && typeof parsed.customCoverByGame === 'object') {
        setCustomCoverByGame(parsed.customCoverByGame)
      }

      if (parsed.gameMetaById && typeof parsed.gameMetaById === 'object') {
        const normalizedMeta = Object.fromEntries(
          Object.entries(parsed.gameMetaById).map(([gameId, meta]) => {
            const addedAt = typeof meta?.addedAt === 'number' && Number.isFinite(meta.addedAt) ? meta.addedAt : Date.now()
            const lastPlayedAt =
              typeof meta?.lastPlayedAt === 'number' && Number.isFinite(meta.lastPlayedAt) ? meta.lastPlayedAt : 0
            const playCount = typeof meta?.playCount === 'number' && Number.isFinite(meta.playCount) ? Math.max(0, Math.floor(meta.playCount)) : 0
            const trackedPlaytimeMinutes =
              typeof meta?.trackedPlaytimeMinutes === 'number' && Number.isFinite(meta.trackedPlaytimeMinutes)
                ? Math.max(0, Math.floor(meta.trackedPlaytimeMinutes))
                : 0
            const isFavorite = Boolean(meta?.isFavorite)
            const favoritedAt =
              typeof meta?.favoritedAt === 'number' && Number.isFinite(meta.favoritedAt) ? Math.max(0, meta.favoritedAt) : 0

            return [
              gameId,
              {
                addedAt,
                lastPlayedAt,
                playCount,
                trackedPlaytimeMinutes,
                isFavorite,
                favoritedAt: isFavorite ? favoritedAt : 0,
              } satisfies GameLibraryMeta,
            ]
          }),
        )

        setGameMetaById(normalizedMeta)
      }

      if (parsed.gridSortMode) {
        setGridSortMode(parsed.gridSortMode)
      }

      if (parsed.gridGroupMode === 'none' || parsed.gridGroupMode === 'platform') {
        setGridGroupMode(parsed.gridGroupMode)
      }

      if (parsed.gridSizeMode === 'compact' || parsed.gridSizeMode === 'medium' || parsed.gridSizeMode === 'large') {
        setGridSizeMode(parsed.gridSizeMode)
      }

      span.end({ hasSettings: true })
    } catch {
      setStatus('Failed to load settings. Using defaults.')
      span.end({ hasSettings: true, parseFailed: true })
    }
  }, [
    setAudioTextureEnabled,
    setLowPowerModeEnabled,
    setSteamControllerCoexistenceMode,
    setGraphicsFidelityMode,
    setAudioTextureLevel,
    setCustomCoverByGame,
    setEmulatorPaths,
    setSystemEmulatorMap,
    setControllerBindsBySystem,
    setRomTitleCleanupEnabled,
    setTitleOverridesByManagedKey,
    setGameMetaById,
    setGridGroupMode,
    setGridSizeMode,
    setGridSortMode,
    setRomDirsText,
    setStatus,
    setSteamApiKey,
    setSteamId,
  ])

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({
          romDirsText,
          emulatorPaths,
          systemEmulatorMap,
          controllerBindsBySystem,
          launcherControllerBinds,
          platformPeripheralsBySystem,
          romTitleCleanupEnabled,
          titleOverridesByManagedKey,
          steamApiKey,
          steamId,
          audioTextureEnabled,
          lowPowerModeEnabled,
          steamControllerCoexistenceMode,
          graphicsFidelityMode,
          audioTextureLevel,
          uiSoundVolume,
          menuMusicEnabled,
          menuMusicVolume,
          preferExternalMedia,
          customCoverByGame,
          gameMetaById,
          gridSortMode,
          gridGroupMode,
          gridSizeMode,
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.toLowerCase().includes('quota')) {
        setStatus('Custom cover storage is full. Use a tighter crop or replace older custom covers.')
        return
      }

      setStatus(`Could not save settings: ${message}`)
    }
  }, [
    romDirsText,
    emulatorPaths,
    systemEmulatorMap,
    controllerBindsBySystem,
    launcherControllerBinds,
    platformPeripheralsBySystem,
    romTitleCleanupEnabled,
    titleOverridesByManagedKey,
    steamApiKey,
    steamId,
    audioTextureEnabled,
    lowPowerModeEnabled,
    steamControllerCoexistenceMode,
    graphicsFidelityMode,
    audioTextureLevel,
    uiSoundVolume,
    menuMusicEnabled,
    menuMusicVolume,
    preferExternalMedia,
    customCoverByGame,
    gameMetaById,
    gridSortMode,
    gridGroupMode,
    gridSizeMode,
    setStatus,
  ])

  useEffect(() => {
    if (library.length === 0) {
      return
    }

    setGameMetaById((previous) => {
      const now = Date.now()
      const next: Record<string, GameLibraryMeta> = {}
      let changed = false

      for (let index = 0; index < library.length; index += 1) {
        const entry = library[index]
        const existing = previous[entry.id]

        if (existing) {
          next[entry.id] = existing
          continue
        }

        changed = true
        next[entry.id] = {
          addedAt: now - (library.length - index) * 1000,
          lastPlayedAt: 0,
          playCount: 0,
          trackedPlaytimeMinutes: 0,
          isFavorite: false,
          favoritedAt: 0,
        }
      }

      if (!changed && Object.keys(previous).length === Object.keys(next).length) {
        return previous
      }

      return next
    })
  }, [library, setGameMetaById])

  useEffect(() => {
    if (!isDeferredStartupReady) {
      return
    }

    if (!audioTextureEnabled || activeTab !== 'launcher' || appLowPowerActive) {
      if (rainBedGainRef.current && plipAudioContextRef.current) {
        const now = plipAudioContextRef.current.currentTime
        rainBedGainRef.current.gain.cancelScheduledValues(now)
        rainBedGainRef.current.gain.setValueAtTime(Math.max(0.0001, rainBedGainRef.current.gain.value), now)
        rainBedGainRef.current.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      }

      if (rainBedSourceRef.current) {
        const source = rainBedSourceRef.current
        window.setTimeout(() => {
          source.stop()
          source.disconnect()
        }, 220)
      }

      if (rainBedFilterRef.current) {
        rainBedFilterRef.current.disconnect()
      }

      if (rainBedGainRef.current) {
        rainBedGainRef.current.disconnect()
      }

      rainBedSourceRef.current = null
      rainBedFilterRef.current = null
      rainBedGainRef.current = null
      return
    }

    const AudioContextCtor = window.AudioContext
    if (!AudioContextCtor) {
      return
    }

    if (!plipAudioContextRef.current) {
      plipAudioContextRef.current = new AudioContextCtor()
    }

    const context = plipAudioContextRef.current
    if (context.state === 'suspended' && !appLowPowerActive) {
      void context.resume()
    }

    if (!rainBedSourceRef.current || !rainBedGainRef.current || !rainBedFilterRef.current) {
      const sampleRate = context.sampleRate
      const durationSeconds = 2.4
      const frameCount = Math.floor(sampleRate * durationSeconds)
      const noiseBuffer = context.createBuffer(1, frameCount, sampleRate)
      const channel = noiseBuffer.getChannelData(0)
      let smooth = 0

      for (let index = 0; index < frameCount; index += 1) {
        const white = Math.random() * 2 - 1
        smooth = smooth * 0.96 + white * 0.04
        channel[index] = smooth * 0.8
      }

      const source = context.createBufferSource()
      source.buffer = noiseBuffer
      source.loop = true

      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(620, context.currentTime)
      filter.Q.value = 0.32

      const gainNode = context.createGain()
      gainNode.gain.setValueAtTime(0.0001, context.currentTime)

      source.connect(filter)
      filter.connect(gainNode)
      gainNode.connect(context.destination)

      source.start()

      rainBedSourceRef.current = source
      rainBedFilterRef.current = filter
      rainBedGainRef.current = gainNode
    }

    if (rainBedGainRef.current) {
      const now = context.currentTime
      const rainTarget = Math.max(0.0012, Math.min(0.012, audioTextureLevel * 0.03))
      rainBedGainRef.current.gain.cancelScheduledValues(now)
      rainBedGainRef.current.gain.setValueAtTime(Math.max(0.0001, rainBedGainRef.current.gain.value), now)
      rainBedGainRef.current.gain.exponentialRampToValueAtTime(rainTarget, now + 0.35)
    }
  }, [
    activeTab,
    appLowPowerActive,
    audioTextureEnabled,
    audioTextureLevel,
    isDeferredStartupReady,
    plipAudioContextRef,
    rainBedFilterRef,
    rainBedGainRef,
    rainBedSourceRef,
  ])

  useEffect(() => {
    if (!achievementModalGameId) {
      return
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAchievementModalGameId(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [achievementModalGameId, setAchievementModalGameId])
}
