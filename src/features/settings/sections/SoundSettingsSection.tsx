import type { SettingsScreenModel } from '../types'
import styles from '../Settings.module.css'
import {
  SettingsRow,
  SettingsSliderControl,
  SettingsToggleControl,
} from '../components/rows/SettingsRows'

export function SoundSettingsSection({ model }: { model: SettingsScreenModel }) {
  return (
    <>
      <div className={styles.settingsCard}>
        <SettingsRow
          title="UI sound volume"
          description="Launcher UI sounds."
          control={(
            <SettingsSliderControl
              value={Math.round(model.uiSoundVolume * 100)}
              onSliderSound={model.onSliderSound}
              onChange={(next) => {
                model.onUiSoundVolumeChange(next / 100)
              }}
            />
          )}
        />
        <SettingsRow
          title="Menu music"
          description="Background menu music."
          control={(
            <SettingsToggleControl
              checked={model.menuMusicEnabled}
              ariaLabel="Menu music"
              onChange={(checked) => {
                model.onMenuMusicEnabledChange(checked)
                model.onSwitchSound()
              }}
            />
          )}
        />
        <SettingsRow
          title="Music volume"
          description="Menu music volume."
          control={(
            <SettingsSliderControl
              value={Math.round(model.menuMusicVolume * 100)}
              disabled={!model.menuMusicEnabled}
              onSliderSound={model.onSliderSound}
              onChange={(next) => {
                model.onMenuMusicVolumeChange(next / 100)
              }}
            />
          )}
        />
        <SettingsRow
          title="Prefer external music"
          description="Pause menu music when other apps are playing audio."
          control={(
            <SettingsToggleControl
              checked={model.preferExternalMedia}
              ariaLabel="Prefer external music"
              onChange={(checked) => {
                model.onPreferExternalMediaChange(checked)
                model.onSwitchSound()
              }}
            />
          )}
        />
        <SettingsRow
          title="Background ambience"
          description="Low-volume ambience layer."
          control={(
            <SettingsToggleControl
              checked={model.audioTextureEnabled}
              ariaLabel="Background ambience"
              onChange={(checked) => {
                model.onAudioTextureEnabledChange(checked)
                model.onSwitchSound()
              }}
            />
          )}
        />
        <SettingsRow
          title="Ambience level"
          description="Ambience strength."
          control={(
            <SettingsSliderControl
              value={Math.round(model.audioTextureLevel * 100)}
              disabled={!model.audioTextureEnabled}
              onSliderSound={model.onSliderSound}
              onChange={(next) => {
                model.onAudioTextureLevelChange(next / 100)
              }}
            />
          )}
        />
      </div>

      <div className={styles.settingsCard}>
        <SettingsRow
          title="Reset setup"
          description="Run setup wizard again."
          control={(
            <button
              type="button"
              className="ghost"
              data-controller-focusable=""
              onClick={() => {
                model.onSwitchSound()
                model.onRerunOnboarding()
              }}
            >
              Reset Setup
            </button>
          )}
        />
      </div>
    </>
  )
}