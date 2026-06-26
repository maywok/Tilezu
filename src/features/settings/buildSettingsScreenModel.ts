import type { SettingsScreenModel, SettingsSectionId } from './types'

export function buildSettingsScreenModel(
  input: Omit<SettingsScreenModel, 'activeSection' | 'onActiveSectionChange'> & {
    activeSection: SettingsSectionId
    onActiveSectionChange: (section: SettingsSectionId) => void
  },
): SettingsScreenModel {
  return input
}