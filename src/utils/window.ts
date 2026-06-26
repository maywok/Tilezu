import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow, type Window as TauriWindow } from '@tauri-apps/api/window'

type WindowCommand<T> = (appWindow: TauriWindow) => Promise<T>

function getAppWindow(): TauriWindow | null {
  if (!isTauri()) {
    return null
  }

  return getCurrentWindow()
}

async function runWindowCommand<T>(command: WindowCommand<T>, fallback: T): Promise<T> {
  const appWindow = getAppWindow()
  if (!appWindow) {
    return fallback
  }

  try {
    return await command(appWindow)
  } catch {
    return fallback
  }
}

export function canUseWindowControls(): boolean {
  return isTauri()
}

export async function minimizeWindow(): Promise<void> {
  await runWindowCommand(async (appWindow) => {
    await appWindow.minimize()
  }, undefined)
}

export async function toggleMaximizeWindow(): Promise<void> {
  await runWindowCommand(async (appWindow) => {
    await appWindow.toggleMaximize()
  }, undefined)
}

export async function closeWindow(): Promise<void> {
  await runWindowCommand(async (appWindow) => {
    await appWindow.close()
  }, undefined)
}

export async function startWindowDragging(): Promise<void> {
  await runWindowCommand(async (appWindow) => {
    await appWindow.startDragging()
  }, undefined)
}

export async function readWindowMaximized(): Promise<boolean> {
  return runWindowCommand(async (appWindow) => appWindow.isMaximized(), false)
}

export async function onWindowFrameChanged(listener: () => void): Promise<() => void> {
  const appWindow = getAppWindow()
  if (!appWindow) {
    return () => {}
  }

  const unlistenResized = await appWindow.onResized(listener)
  const unlistenMoved = await appWindow.onMoved(listener)

  return () => {
    unlistenResized()
    unlistenMoved()
  }
}
