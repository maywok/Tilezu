import type { SettingsSectionId } from './types'

export type SettingsSectionDefinition = {
  id: SettingsSectionId
  label: string
  description: string
}

export const SETTINGS_SECTIONS: SettingsSectionDefinition[] = [
  {
    id: 'sound',
    label: 'Sound',
    description: 'UI sounds and background ambience',
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Graphics and power options',
  },
  {
    id: 'accounts',
    label: 'Accounts',
    description: 'Steam login and API access',
  },
  {
    id: 'library',
    label: 'Library',
    description: 'ROM folders and import paths',
  },
  {
    id: 'controllers',
    label: 'Controllers',
    description: 'Gamepad layout and binds',
  },
]

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'sound'
