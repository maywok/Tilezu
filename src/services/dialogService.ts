import type { DialogOpenOptions } from '../features/launcher/types'

export async function openDialog(options: DialogOpenOptions): Promise<string | string[] | null> {
  const dialogApi = await import('@tauri-apps/plugin-dialog')
  return dialogApi.open(options)
}
