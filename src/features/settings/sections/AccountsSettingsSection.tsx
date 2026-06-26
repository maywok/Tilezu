import type { SettingsScreenModel } from '../types'
import styles from '../Settings.module.css'
import { SettingsRowStack } from '../components/rows/SettingsRows'

export function AccountsSettingsSection({ model }: { model: SettingsScreenModel }) {
  return (
    <div className={styles.settingsCard}>
      <SettingsRowStack
        title="Steam account"
        description="Browser login sets SteamID64. API key needed for achievements."
      >
        <div className={styles.settingsActionRow}>
          <button type="button" data-controller-focusable="" onClick={model.onSteamBrowserLogin} disabled={model.isSteamLoginBusy}>
            {model.isSteamLoginBusy ? 'Waiting for login...' : 'Login with Steam in Browser'}
          </button>
          <button type="button" className="ghost" data-controller-focusable="" onClick={model.onTestSteamConnection} disabled={model.isSteamTestBusy}>
            {model.isSteamTestBusy ? 'Testing...' : 'Test Steam Connection'}
          </button>
          <button type="button" className="ghost" data-controller-focusable="" onClick={model.onLogoutSteam}>
            Log Out
          </button>
          <button type="button" className="ghost" data-controller-focusable="" onClick={model.onOpenSteamApiKeyPage}>
            Open API Key Page
          </button>
        </div>
        <label className="settings-field">
          <span>Steam Web API Key</span>
          <input
            data-controller-focusable=""
            value={model.steamApiKey}
            onChange={(event) => model.onSteamApiKeyChange(event.target.value)}
            placeholder="Paste your Steam API key"
          />
        </label>
        <label className="settings-field">
          <span>Steam ID64</span>
          <input
            data-controller-focusable=""
            value={model.steamId}
            onChange={(event) => model.onSteamIdChange(event.target.value)}
            placeholder="7656119..."
          />
        </label>
      </SettingsRowStack>
    </div>
  )
}
