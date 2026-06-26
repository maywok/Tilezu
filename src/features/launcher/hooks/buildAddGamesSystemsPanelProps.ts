import type { Dispatch, SetStateAction } from 'react'

import type { AddGamesSystemDraft, AddGamesSystemsPanelProps } from '../components/addGames/types'

type BuildAddGamesSystemsPanelPropsInput = {
  manageSystemsSearch: string
  manageSystemsFilter: 'all' | 'hidden' | 'auto-sort'
  manageSystemsVisibleList: Array<{
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
  }>
  editingCustomSystemId: string | null
  customSystemDraft: AddGamesSystemDraft
  customSystemDraftDisplayName: string
  customSystemDraftPrimaryColor: string
  customSystemDraftSecondaryColor: string
  customSystemPreviewKey: string
  customSystemPreviewShortLabel: string
  editingCustomSystemHidden: boolean
  manageSystemsEditorTab: AddGamesSystemsPanelProps['editorTab']
  customSystemNameError: string | null
  isCustomSystemDraftDirty: boolean
  isCustomSystemRuleEditorExpanded: boolean
  templates: AddGamesSystemsPanelProps['templates']
  rulePresets: AddGamesSystemsPanelProps['rulePresets']
  isDebugMenuVisible: boolean
  debug?: AddGamesSystemsPanelProps['debug']
  setManageSystemsSearch: (value: string) => void
  setManageSystemsFilter: (filter: 'all' | 'hidden' | 'auto-sort') => void
  beginEditingCustomSystem: (systemId: string) => void
  duplicateCustomSystem: (systemId: string) => void
  toggleCustomSystemHidden: (systemId: string) => void
  exportCustomSystem: (systemId: string) => void | Promise<void>
  deleteCustomSystem: (systemId: string) => void
  applyCustomSystemTemplate: (templateKey: string) => void
  setManageSystemsEditorTab: (tab: AddGamesSystemsPanelProps['editorTab']) => void
  saveCustomSystemDraftEntry: () => void
  resetCustomSystemEditor: () => void
  setCustomSystemDraft: Dispatch<SetStateAction<AddGamesSystemDraft>>
  uploadCustomSystemIcon: (file: File | null | undefined) => void | Promise<void>
  uploadCustomSystemCollage: (file: File | null | undefined) => void | Promise<void>
  openCollageStudio: () => void
  applyCustomSystemRulePreset: (presetKey: string) => void
  setIsCustomSystemRuleEditorExpanded: (expanded: boolean) => void
  openCreateSystemFlow: () => void
  isCustomSystemCreateMode: boolean
  customSystemNameFocusKey: number
  customSystemSaveAckKey: number
  customSystemUploadFlash: 'icon' | 'collage' | null
}

export function buildAddGamesSystemsPanelProps(input: BuildAddGamesSystemsPanelPropsInput): AddGamesSystemsPanelProps {
  return {
    search: input.manageSystemsSearch,
    filter: input.manageSystemsFilter,
    systems: input.manageSystemsVisibleList.map((system) => ({
      id: system.id,
      key: system.key,
      name: system.name,
      shortLabel: system.shortLabel,
      iconPath: system.iconPath,
      collageDataUrl: system.collageDataUrl,
      accentPrimary: system.accentPrimary,
      accentSecondary: system.accentSecondary,
      hidden: system.hidden,
      ingestionMode: system.ingestionMode,
    })),
    editingSystemId: input.editingCustomSystemId,
    draft: input.customSystemDraft,
    draftDisplayName: input.customSystemDraftDisplayName,
    draftPrimaryColor: input.customSystemDraftPrimaryColor,
    draftSecondaryColor: input.customSystemDraftSecondaryColor,
    previewKey: input.customSystemPreviewKey,
    previewShortLabel: input.customSystemPreviewShortLabel,
    editingSystemHidden: input.editingCustomSystemHidden,
    editorTab: input.manageSystemsEditorTab,
    nameError: input.customSystemNameError || null,
    isDraftDirty: input.isCustomSystemDraftDirty,
    ruleEditorExpanded: input.isCustomSystemRuleEditorExpanded,
    templates: input.templates,
    rulePresets: input.rulePresets,
    onSearchChange: input.setManageSystemsSearch,
    onFilterChange: input.setManageSystemsFilter,
    onSelectSystem: input.beginEditingCustomSystem,
    onDuplicateSystem: input.duplicateCustomSystem,
    onToggleSystemHidden: input.toggleCustomSystemHidden,
    onExportSystem: (systemId) => { void input.exportCustomSystem(systemId) },
    onDeleteSystem: input.deleteCustomSystem,
    onApplyTemplate: input.applyCustomSystemTemplate,
    onEditorTabChange: input.setManageSystemsEditorTab,
    onSave: input.saveCustomSystemDraftEntry,
    onReset: input.resetCustomSystemEditor,
    onDraftChange: input.setCustomSystemDraft,
    onUploadIcon: (file) => { void input.uploadCustomSystemIcon(file) },
    onUploadCollage: (file) => { void input.uploadCustomSystemCollage(file) },
    onOpenCollageStudio: input.openCollageStudio,
    onApplyRulePreset: input.applyCustomSystemRulePreset,
    onRuleEditorExpandedChange: input.setIsCustomSystemRuleEditorExpanded,
    onNewSystem: input.openCreateSystemFlow,
    isCreateMode: input.isCustomSystemCreateMode,
    nameInputFocusKey: input.customSystemNameFocusKey,
    saveAckKey: input.customSystemSaveAckKey,
    uploadFlash: input.customSystemUploadFlash,
    debugVisible: input.isDebugMenuVisible,
    debug: input.debug,
  }
}
