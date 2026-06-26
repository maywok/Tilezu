import { SETTINGS_SECTIONS } from '../settingsRegistry'
import type { SettingsScreenModel } from '../types'
import styles from '../Settings.module.css'
import { LazySettingsSectionContent } from './SettingsSectionContent'
import { SettingsNav } from './SettingsNav'
import { collectNativeFocusable, focusFirst } from '../../launcher/utils/controllerFocus'
import { useEffect } from 'react'

type SettingsScreenProps = {
  model: SettingsScreenModel
}

export function SettingsScreen({ model }: SettingsScreenProps) {
  const activeSection = SETTINGS_SECTIONS.find((section) => section.id === model.activeSection)

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const root = document.querySelector<HTMLElement>('[data-controller-tab="settings"]')
      if (!root) {
        return
      }

      focusFirst(collectNativeFocusable(root), false)
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [model.activeSection])

  return (
    <div className={styles.settingsScene} data-controller-tab="settings" data-settings-scene="">
      <header className={styles.settingsPageHeader}>
        <h1 className={styles.settingsPageTitle}>Settings</h1>
      </header>

      <div className={styles.settingsBody}>
        <SettingsNav activeSection={model.activeSection} onActiveSectionChange={model.onActiveSectionChange} />
        <div className={`${styles.settingsContent} tm-ui-scrollbar`}>
          <section
            className={styles.settingsSectionPane}
            data-controller-section={model.activeSection}
            aria-labelledby="settings-section-title"
          >
            {activeSection ? (
              <h2 id="settings-section-title" className={styles.settingsSectionTitle}>
                {activeSection.label}
              </h2>
            ) : null}
            <LazySettingsSectionContent model={model} />
          </section>
        </div>
      </div>
    </div>
  )
}
