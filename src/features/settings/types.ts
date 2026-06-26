import type {
  EmulatorKey,
  GraphicsFidelityMode,
  LauncherControllerAction,
  LauncherControllerInput,
  LauncherControllerLayout,
  SteamControllerCoexistenceMode,
} from '../launcher/types'
import type { PlatformPeripheralOptionDefinition } from '../launcher/utils/platformPeripherals'

export type SettingsSectionId =
  | 'sound'
  | 'performance'
  | 'accounts'
  | 'library'
  | 'controllers'

export type QuickSettingsBindings = {
  uiSoundVolume: number
  onUiSoundVolumeChange: (value: number) => void
  audioTextureEnabled: boolean
  onAudioTextureEnabledChange: (value: boolean) => void
  audioTextureLevel: number
  onAudioTextureLevelChange: (value: number) => void
  graphicsFidelityMode: GraphicsFidelityMode
  onGraphicsFidelityModeChange: (mode: GraphicsFidelityMode) => void
  lowPowerModeEnabled: boolean
  onLowPowerModeEnabledChange: (value: boolean) => void
  onSwitchSound: () => void
  onSliderSound: (value: number) => void
  menuMusicEnabled: boolean
  onMenuMusicEnabledChange: (value: boolean) => void
  menuMusicVolume: number
  onMenuMusicVolumeChange: (value: number) => void
  preferExternalMedia: boolean
  onPreferExternalMediaChange: (value: boolean) => void
}

export type EmulatorFieldConfig = {
  key: EmulatorKey
  label: string
  placeholder: string
}

export type ControllerLayoutOption = {
  value: LauncherControllerLayout
  label: string
}

export type RomSystemFolderOption = {
  folder: string
  label: string
}

export type SettingsScreenModel = {
  activeSection: SettingsSectionId
  onActiveSectionChange: (section: SettingsSectionId) => void
  onSwitchSound: () => void
  onSliderSound: (value: number) => void
  // Sound
  uiSoundVolume: number
  onUiSoundVolumeChange: (value: number) => void
  audioTextureEnabled: boolean
  onAudioTextureEnabledChange: (value: boolean) => void
  audioTextureLevel: number
  onAudioTextureLevelChange: (value: number) => void
  menuMusicEnabled: boolean
  onMenuMusicEnabledChange: (value: boolean) => void
  menuMusicVolume: number
  onMenuMusicVolumeChange: (value: number) => void
  preferExternalMedia: boolean
  onPreferExternalMediaChange: (value: boolean) => void
  // Performance
  graphicsFidelityMode: GraphicsFidelityMode
  onGraphicsFidelityModeChange: (mode: GraphicsFidelityMode) => void
  lowPowerModeEnabled: boolean
  onLowPowerModeEnabledChange: (value: boolean) => void
  performanceStatusNote: string
  // Accounts
  steamApiKey: string
  onSteamApiKeyChange: (value: string) => void
  steamId: string
  onSteamIdChange: (value: string) => void
  isSteamLoginBusy: boolean
  isSteamTestBusy: boolean
  onSteamBrowserLogin: () => void
  onTestSteamConnection: () => void
  onLogoutSteam: () => void
  onOpenSteamApiKeyPage: () => void
  // Library
  romDirsText: string
  onRomDirsTextChange: (value: string) => void
  romTitleCleanupEnabled: boolean
  onRomTitleCleanupEnabledChange: (value: boolean) => void
  emulatorPaths: Record<EmulatorKey, string>
  onEmulatorPathChange: (key: EmulatorKey, value: string) => void
  emulatorFields: EmulatorFieldConfig[]
  onBrowseRomFolder: () => void
  onRerunOnboarding: () => void
  onBrowseEmulatorPath: (key: EmulatorKey) => void
  // Controllers
  steamControllerCoexistenceMode: SteamControllerCoexistenceMode
  onSteamControllerCoexistenceModeChange: (mode: SteamControllerCoexistenceMode) => void
  controllerSettingsPanel: 'tilezu' | 'platforms'
  onControllerSettingsPanelChange: (panel: 'tilezu' | 'platforms') => void
  controllerSettingsSystemKey: string
  onControllerSettingsSystemKeyChange: (key: string) => void
  controllerSettingsBinds: {
    layout: LauncherControllerLayout
    bindings: Record<LauncherControllerAction, LauncherControllerInput>
  }
  controllerSettingsRuntimeLayout: LauncherControllerLayout
  controllerSettingsRuntimeBindings: Record<LauncherControllerAction, LauncherControllerInput>
  controllerLayoutOptions: ControllerLayoutOption[]
  romSystemFolders: RomSystemFolderOption[]
  controllerEssentialActions: LauncherControllerAction[]
  controllerAdvancedActions: LauncherControllerAction[]
  controllerPlatformActions: LauncherControllerAction[]
  controllerPlatformActionLabels: Partial<Record<LauncherControllerAction, string>>
  controllerActionLabels: Record<LauncherControllerAction, string>
  controllerInputOrder: LauncherControllerInput[]
  controllerInputLabels: Record<LauncherControllerInput, string>
  formatControllerInputForLayout: (layout: LauncherControllerLayout, input: LauncherControllerInput) => string
  connectedGamepadLabel: string | null
  launcherInputMode: string
  activeRuntimeControllerLayoutLabel: string
  onResetLauncherControllerBindings: () => void
  onUpdateLauncherControllerLayout: (layout: string) => void
  onUpdateLauncherControllerBinding: (
    action: LauncherControllerAction,
    input: LauncherControllerInput,
  ) => void
  onResetControllerBindingsForSystem: (systemKey: string) => void
  onUpdateControllerLayoutForSystem: (systemKey: string, layout: string) => void
  onUpdateControllerBindingForSystem: (
    systemKey: string,
    action: LauncherControllerAction,
    input: LauncherControllerInput,
  ) => void
  controllerSettingsPeripheralOptions: PlatformPeripheralOptionDefinition[]
  controllerSettingsPeripherals: Record<string, string>
  onUpdatePlatformPeripheralForSystem: (systemKey: string, optionId: string, value: string) => void
}
