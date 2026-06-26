import type { CSSProperties, DragEvent } from 'react'

import type { GameEntry, ImportedGame } from '../../types'

export type AddGamesTab = 'apps-games' | 'roms' | 'systems'

export type AddGamesFilter =
  | 'recent'
  | 'not-in-any-system'
  | 'in-target-system'
  | 'user-added-exes'
  | 'all'

export type AddGamesAssignmentFlash = 'add' | 'remove'

export type RomImportPreviewFilter = 'all' | 'new' | 'duplicates' | 'unresolved' | 'low-confidence'

export type RomImportConfidence = 'high' | 'medium' | 'low'

export type RomImportPreviewRow = {
  id: string
  title: string
  profile: string
  profileLabel: string
  romPath: string
  categoryKey: string
  sourceLabel: string
  confidence: RomImportConfidence
  confidenceReason: string
  duplicate: boolean
  unresolved: boolean
  existingEntryId: string | null
  candidate: ImportedGame
}

export type RomImportCounts = {
  total: number
  fresh: number
  duplicates: number
  unresolved: number
  lowConfidence: number
}

export type AddGamesDragHandlers = {
  isFileDragActive: boolean
  isDropActive: boolean
  isRomDropActive: boolean
  onModalDragEnter: (event: DragEvent<HTMLElement>) => void
  onModalDragOver: (event: DragEvent<HTMLElement>) => void
  onModalDragLeave: (event: DragEvent<HTMLElement>) => void
  onModalDrop: (event: DragEvent<HTMLElement>) => void
  onPanelDragEnter: (event: DragEvent<HTMLElement>) => void
  onPanelDragOver: (event: DragEvent<HTMLElement>) => void
  onPanelDragLeave: (event: DragEvent<HTMLElement>) => void
  onPanelDrop: (event: DragEvent<HTMLElement>) => void
  onRomDragEnter: (event: DragEvent<HTMLElement>) => void
  onRomDragOver: (event: DragEvent<HTMLElement>) => void
  onRomDragLeave: (event: DragEvent<HTMLElement>) => void
  onRomDrop: (event: DragEvent<HTMLElement>) => void
}

export type AddGamesSystemTarget = {
  key: string
  label: string
  shortLabel: string
  logoPath: string
  collageDataUrl?: string
  accentPrimary: string
  accentSecondary: string
}

export type AddGamesLibraryEntryRow = {
  entry: GameEntry
  cover: string
  sourceCategoryLabel: string
  sourceCategoryLogoPath: string
  alreadyInSystem: boolean
  checked: boolean
}

export type AddGamesDragPreviewItem = {
  id: string
  title: string
  cover: string
}

export type AddGamesAppsPanelProps = {
  targetSystemKey: string
  targetSystemLabel: string
  targetSystemAssignedCount: number
  targetSystems: AddGamesSystemTarget[]
  search: string
  filter: AddGamesFilter
  selectedCount: number
  entries: AddGamesLibraryEntryRow[]
  assignmentFlashByGameId: Record<string, AddGamesAssignmentFlash>
  isDropActive: boolean
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  onFilterChange: (filter: AddGamesFilter) => void
  onTargetSystemChange: (systemKey: string) => void
  onToggleSelection: (gameId: string, checked: boolean) => void
  onClearSelection: () => void
  visibleEntryCount: number
  allVisibleSelected: boolean
  onToggleSelectAllVisible: (selectAll: boolean) => void
  onApplySelection: (assigned: boolean) => void
  onAssignGames: (gameIds: string[], assigned: boolean) => void
  onDragEnter: (event: DragEvent<HTMLElement>) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

export type AddGamesRomGalleryProps = {
  summary: string
  search: string
  filter: RomImportPreviewFilter
  counts: RomImportCounts
  visibleRows: RomImportPreviewRow[]
  selectedIds: string[]
  selectedVisibleCount: number
  selectableVisibleCount: number
  blockedLowVisibleCount: number
  allVisibleSelected: boolean
  allowLowConfidenceImports: boolean
  isScanning: boolean
  isDropActive: boolean
  focusedRow: RomImportPreviewRow | null
  coverByEntryId: Record<string, string>
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  onFilterChange: (filter: RomImportPreviewFilter) => void
  onAllowLowConfidenceChange: (allowed: boolean) => void
  onScan: () => void
  onOpenRomFolder: () => void
  onImportSelected: () => void
  onToggleSelectAllVisible: (selectAll: boolean) => void
  onClearSelection: () => void
  onToggleRowSelection: (rowId: string, checked: boolean) => void
  onFocusRow: (rowId: string) => void
  onDragEnter: (event: DragEvent<HTMLElement>) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

export type LibrarySystemsStats = {
  active: number
  hidden: number
  autoSort: number
}

export type ManageSystemsFilter = 'all' | 'hidden' | 'auto-sort'

export type ManageSystemsListItem = {
  id: string
  key: string
  name: string
  shortLabel: string
  iconPath: string
  collageDataUrl: string
  accentPrimary: string
  accentSecondary: string
  hidden: boolean
  ingestionMode: 'manual' | 'smart'
}

export type AddGamesSystemDraft = {
  name: string
  iconPath: string
  collageDataUrl: string
  accentPrimary: string
  accentSecondary: string
  description: string
  ingestionMode: 'manual' | 'smart'
  includeSourcesText: string
  includePathHintsText: string
  includeExtensionsText: string
}

export type AddGamesSystemsEditorTab = 'basics' | 'rules'

export type AddGamesSystemsDebugProps = {
  debugSystemImportKey: string
  debugSystemImportOptions: Array<{ key: string; name: string; alreadyImported: boolean }>
  selectedDebugPresetDescription: string
  simulatedImportEnabled: boolean
  simulatedImportSourcePreset: string
  simulatedImportProfilePreset: string
  simulatedImportQuantity: number
  simulatedImportIncludeDuplicateIds: boolean
  simulatedImportMissingBoxArt: boolean
  simulatedImportInvalidPaths: boolean
  simulatedImportWeirdFileNames: boolean
  simulatedImportNonEnglishTitles: boolean
  simulatedImportVeryLongTitles: boolean
  simulatedImportSummary: string
  simulatedImportPreviewRows: Array<{
    id: string
    title: string
    platform: string
    sourceLabel: string
    pathValidity: string
    duplicate: boolean
  }>
  simulatedImportSourcePresets: Array<{ key: string; label: string }>
  simulatedImportProfilePresets: Array<{ key: string; label: string }>
  onDebugSystemImportKeyChange: (value: string) => void
  onImportDebugSystemPreset: () => void
  onSimulatedImportEnabledChange: (enabled: boolean) => void
  onSimulatedImportSourcePresetChange: (value: string) => void
  onSimulatedImportProfilePresetChange: (value: string) => void
  onSimulatedImportQuantityChange: (value: number) => void
  onSimulatedImportIncludeDuplicateIdsChange: (value: boolean) => void
  onSimulatedImportMissingBoxArtChange: (value: boolean) => void
  onSimulatedImportInvalidPathsChange: (value: boolean) => void
  onSimulatedImportWeirdFileNamesChange: (value: boolean) => void
  onSimulatedImportNonEnglishTitlesChange: (value: boolean) => void
  onSimulatedImportVeryLongTitlesChange: (value: boolean) => void
  onGenerateSimulatedImportPreview: () => void
  onImportSimulatedPreviewRows: () => void
  onClearSimulatedImports: () => void
}

export type AddGamesSystemsPanelProps = {
  search: string
  filter: ManageSystemsFilter
  systems: ManageSystemsListItem[]
  editingSystemId: string | null
  draft: AddGamesSystemDraft
  draftDisplayName: string
  draftPrimaryColor: string
  draftSecondaryColor: string
  previewKey: string
  previewShortLabel: string
  editingSystemHidden: boolean
  editorTab: AddGamesSystemsEditorTab
  nameError: string | null
  isDraftDirty: boolean
  ruleEditorExpanded: boolean
  templates: Array<{ key: string; name: string }>
  rulePresets: Array<{ key: string; label: string }>
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  onFilterChange: (filter: ManageSystemsFilter) => void
  onSelectSystem: (systemId: string) => void
  onDuplicateSystem: (systemId: string) => void
  onToggleSystemHidden: (systemId: string) => void
  onExportSystem: (systemId: string) => void
  onDeleteSystem: (systemId: string) => void
  onApplyTemplate: (templateKey: string) => void
  onEditorTabChange: (tab: AddGamesSystemsEditorTab) => void
  onSave: () => void
  onReset: () => void
  onDraftChange: (updater: (previous: AddGamesSystemDraft) => AddGamesSystemDraft) => void
  onUploadIcon: (file: File | undefined) => void
  onUploadCollage: (file: File | undefined) => void
  onOpenCollageStudio: () => void
  onApplyRulePreset: (presetKey: string) => void
  onRuleEditorExpandedChange: (expanded: boolean) => void
  onNewSystem: () => void
  isCreateMode: boolean
  nameInputFocusKey: number
  saveAckKey: number
  uploadFlash: 'icon' | 'collage' | null
  debugVisible: boolean
  debug?: AddGamesSystemsDebugProps
}

export type AddGamesModalProps = {
  isOpen: boolean
  targetSystemKey: string
  targetSystemLabel: string
  targetSystems: AddGamesSystemTarget[]
  tab: AddGamesTab
  panelStyle?: CSSProperties
  isImporting: boolean
  systemsStats?: LibrarySystemsStats
  onClose: () => void
  onTabChange: (tab: AddGamesTab) => void
  onSideTabHover?: () => void
  onSearchFocus?: () => void
  onAddExecutable: () => void
  onAutoImport: () => void
  drag: AddGamesDragHandlers
  apps: AddGamesAppsPanelProps
  rom: AddGamesRomGalleryProps
  systems: AddGamesSystemsPanelProps
}
