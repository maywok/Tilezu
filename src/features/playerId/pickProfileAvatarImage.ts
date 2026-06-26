import { openDialog } from '../../services/dialogService'
import { readLocalImageAsDataUrl } from '../../services/launcherService'

export async function pickProfileAvatarImage(): Promise<string | null> {
  try {
    const selected = await openDialog({
      directory: false,
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'avif'] }],
    })
    if (!selected || Array.isArray(selected)) {
      return null
    }

    const dataUrl = await readLocalImageAsDataUrl(selected)
    const normalized = dataUrl.trim()
    if (!normalized.startsWith('data:image/') || normalized.length > 4_000_000) {
      return null
    }

    return normalized
  } catch {
    return null
  }
}
