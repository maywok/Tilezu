import type { GraphicsFidelityMode } from '../../launcher/types'
import type { SettingsScreenModel } from '../types'
import styles from '../Settings.module.css'
import {
  SettingsChipRow,
  SettingsRow,
  SettingsToggleControl,
} from '../components/rows/SettingsRows'

const FIDELITY_OPTIONS: Array<{ value: GraphicsFidelityMode; label: string }> = [
  { value: 'ultra-lite', label: 'Ultra-lite' },
  { value: 'lite', label: 'Lite' },
  { value: 'normal', label: 'Normal' },
  { value: 'ultra', label: 'Ultra' },
]

export function PerformanceSettingsSection({ model }: { model: SettingsScreenModel }) {
  return (
    <div className={styles.settingsCard}>
      <SettingsRow
        title="Graphics fidelity"
        description="Normal is the default. Lower tiers favor performance."
        control={(
          <SettingsChipRow
            value={model.graphicsFidelityMode}
            options={FIDELITY_OPTIONS}
            onChange={(next) => {
              if (
                next === 'normal'
                || next === 'lite'
                || next === 'ultra-lite'
                || next === 'ultra'
              ) {
                model.onGraphicsFidelityModeChange(next)
                model.onSwitchSound()
              }
            }}
          />
        )}
      />
      <SettingsRow
        title="Low power mode"
        description="Hide to tray on exit and while games run."
        control={(
          <SettingsToggleControl
            checked={model.lowPowerModeEnabled}
            ariaLabel="Low power mode"
            onChange={(checked) => {
              model.onLowPowerModeEnabledChange(checked)
              model.onSwitchSound()
            }}
          />
        )}
      />
    </div>
  )
}
