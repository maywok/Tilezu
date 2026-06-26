import { SETTINGS_KEY } from '../launcher/constants'

export function readPreferExternalMediaFromSettings(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) {
      return true
    }

    const parsed = JSON.parse(raw) as { preferExternalMedia?: boolean }
    return typeof parsed.preferExternalMedia === 'boolean' ? parsed.preferExternalMedia : true
  } catch {
    return true
  }
}