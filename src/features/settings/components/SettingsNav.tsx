import { SETTINGS_SECTIONS } from '../settingsRegistry'
import type { SettingsSectionId } from '../types'
import styles from '../Settings.module.css'

type SettingsNavProps = {
  activeSection: SettingsSectionId
  onActiveSectionChange: (section: SettingsSectionId) => void
}

export function SettingsNav({ activeSection, onActiveSectionChange }: SettingsNavProps) {
  return (
    <nav className={`${styles.settingsNav} tm-ui-scrollbar`} aria-label="Settings categories">
      {SETTINGS_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          data-controller-focusable=""
          className={
            activeSection === section.id
              ? `${styles.settingsNavButton} ${styles.isActive}`
              : styles.settingsNavButton
          }
          onClick={() => onActiveSectionChange(section.id)}
          aria-current={activeSection === section.id ? 'page' : undefined}
          title={section.description}
        >
          <span className={styles.settingsNavLabel}>{section.label}</span>
        </button>
      ))}
    </nav>
  )
}
