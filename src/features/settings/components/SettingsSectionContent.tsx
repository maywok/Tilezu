import { lazy, Suspense } from 'react'
import type { SettingsScreenModel } from '../types'

const SoundSettingsSection = lazy(async () => {
  const module = await import('../sections/SoundSettingsSection')
  return { default: module.SoundSettingsSection }
})

const PerformanceSettingsSection = lazy(async () => {
  const module = await import('../sections/PerformanceSettingsSection')
  return { default: module.PerformanceSettingsSection }
})

const AccountsSettingsSection = lazy(async () => {
  const module = await import('../sections/AccountsSettingsSection')
  return { default: module.AccountsSettingsSection }
})

const LibrarySettingsSection = lazy(async () => {
  const module = await import('../sections/LibrarySettingsSection')
  return { default: module.LibrarySettingsSection }
})

const ControllersSettingsSection = lazy(async () => {
  const module = await import('../sections/ControllersSettingsSection')
  return { default: module.ControllersSettingsSection }
})

type SettingsSectionContentProps = {
  model: SettingsScreenModel
}

export function SettingsSectionContent({ model }: SettingsSectionContentProps) {
  switch (model.activeSection) {
    case 'sound':
      return <SoundSettingsSection model={model} />
    case 'performance':
      return <PerformanceSettingsSection model={model} />
    case 'accounts':
      return <AccountsSettingsSection model={model} />
    case 'library':
      return <LibrarySettingsSection model={model} />
    case 'controllers':
      return <ControllersSettingsSection model={model} />
    default:
      return <SoundSettingsSection model={model} />
  }
}

export function LazySettingsSectionContent({ model }: SettingsSectionContentProps) {
  return (
    <Suspense fallback={null}>
      <SettingsSectionContent model={model} />
    </Suspense>
  )
}