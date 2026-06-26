import type { AppearanceTheme } from '../types'
import { cloneTheme, createEntityId } from './theme'
import { parseThemeFromJson } from '../storage'

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  const encoded = window.btoa(binary)
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(value: string): string {
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = window.atob(normalized)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeThemeShareCode(theme: AppearanceTheme): string {
  const shareableTheme = cloneTheme({
    ...theme,
    backgroundImage: null,
  })

  const payload = JSON.stringify({
    version: 1,
    theme: cloneTheme({
      ...shareableTheme,
      id: createEntityId('shared-theme'),
      updatedAt: Date.now(),
    }),
  })

  return encodeBase64Url(payload)
}

export function decodeThemeShareCode(code: string): AppearanceTheme | null {
  try {
    const decoded = decodeBase64Url(code.trim())
    return parseThemeFromJson(decoded)
  } catch {
    return null
  }
}

export function createShareLink(theme: AppearanceTheme): string {
  const shareCode = encodeThemeShareCode(theme)
  const url = new URL(window.location.href)
  url.searchParams.set('theme', shareCode)
  return url.toString()
}

export function getSharedThemeFromLocation(): AppearanceTheme | null {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('theme')
    if (!code) {
      return null
    }

    return decodeThemeShareCode(code)
  } catch {
    return null
  }
}
