import React from 'react'

type BrandEntry = {
  accent: string
  glow: string
}

const BRAND_COLOR_MAP = {
  all: {
    accent: 'rgba(124, 179, 255, 0.48)',
    glow: 'rgba(124, 179, 255, 0.24)',
  },
  links: {
    accent: 'rgba(130, 166, 219, 0.44)',
    glow: 'rgba(130, 166, 219, 0.2)',
  },
  executable: {
    accent: 'rgba(130, 166, 219, 0.44)',
    glow: 'rgba(130, 166, 219, 0.2)',
  },
  applications: {
    accent: 'rgba(130, 166, 219, 0.44)',
    glow: 'rgba(130, 166, 219, 0.2)',
  },
  emulator: {
    accent: 'rgba(130, 166, 219, 0.44)',
    glow: 'rgba(130, 166, 219, 0.2)',
  },
  steam: {
    accent: 'rgba(244, 158, 87, 0.54)',
    glow: 'rgba(29, 90, 164, 0.26)',
  },
  epic: {
    accent: 'rgba(141, 194, 230, 0.5)',
    glow: 'rgba(210, 193, 156, 0.28)',
  },
  'battle-net': {
    accent: 'rgba(255, 168, 38, 0.58)',
    glow: 'rgba(255, 139, 20, 0.28)',
  },
  minecraft: {
    accent: 'rgba(140, 205, 89, 0.56)',
    glow: 'rgba(123, 85, 53, 0.26)',
  },
  roblox: {
    accent: 'rgba(255, 77, 106, 0.56)',
    glow: 'rgba(255, 77, 106, 0.24)',
  },
  riot: {
    accent: 'rgba(197, 37, 68, 0.6)',
    glow: 'rgba(21, 8, 12, 0.4)',
  },
  ds: {
    accent: 'rgba(255, 70, 92, 0.62)',
    glow: 'rgba(33, 136, 255, 0.34)',
  },
  nes: {
    accent: 'rgba(196, 133, 181, 0.48)',
    glow: 'rgba(132, 177, 232, 0.28)',
  },
  snes: {
    accent: 'rgba(196, 133, 181, 0.48)',
    glow: 'rgba(132, 177, 232, 0.28)',
  },
  n64: {
    accent: 'rgba(196, 133, 181, 0.48)',
    glow: 'rgba(132, 177, 232, 0.28)',
  },
  handheld: {
    accent: 'rgba(196, 133, 181, 0.48)',
    glow: 'rgba(132, 177, 232, 0.28)',
  },
} as const

export type SystemThemeKey = string
type KnownSystemThemeKey = keyof typeof BRAND_COLOR_MAP

type SystemThemeValue = {
  systemKey: SystemThemeKey
  brandClassName: string
  isProvided: boolean
  styleVars: React.CSSProperties
}

type SystemThemeProviderProps = {
  accentKey: string | null | undefined
  children: React.ReactNode
}

const DEFAULT_THEME_KEY: KnownSystemThemeKey = 'all'
const DEFAULT_THEME_STYLE_VARS = buildSystemThemeStyleVars(DEFAULT_THEME_KEY)

const DEFAULT_THEME_VALUE: SystemThemeValue = {
  systemKey: DEFAULT_THEME_KEY,
  brandClassName: `brand-${DEFAULT_THEME_KEY}`,
  isProvided: false,
  styleVars: DEFAULT_THEME_STYLE_VARS,
}

const SystemThemeContext = React.createContext<SystemThemeValue>(DEFAULT_THEME_VALUE)

export function normalizeSystemThemeKey(input: string | null | undefined): SystemThemeKey {
  const value = (input || '').trim().toLowerCase()

  if (!value) {
    return DEFAULT_THEME_KEY
  }

  if (value in BRAND_COLOR_MAP) {
    return value as KnownSystemThemeKey
  }

  if (value === 'battle_net' || value === 'battlenet') {
    return 'battle-net'
  }

  if (value === 'nintendo-ds') {
    return 'ds'
  }

  const sanitized = value
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (sanitized.length > 0) {
    return sanitized
  }

  return DEFAULT_THEME_KEY
}

export function buildSystemThemeStyleVars(systemKey: SystemThemeKey): React.CSSProperties {
  const mapped = BRAND_COLOR_MAP[systemKey as KnownSystemThemeKey]
  if (!mapped) {
    return {
      ['--tm-system-accent' as string]: 'var(--brand-border, rgba(124, 179, 255, 0.48))',
      ['--tm-system-glow' as string]: 'var(--flyout-edge, rgba(124, 179, 255, 0.28))',
      ['--active-ring' as string]: 'var(--brand-border, rgba(124, 179, 255, 0.48))',
      ['--active-glow' as string]: 'var(--flyout-edge, rgba(124, 179, 255, 0.28))',
      ['--accent-ring-soft' as string]: 'var(--brand-border, rgba(124, 179, 255, 0.48))',
      ['--accent-glow-soft' as string]: 'var(--flyout-edge, rgba(124, 179, 255, 0.28))',
    }
  }

  const entry: BrandEntry = mapped || BRAND_COLOR_MAP[DEFAULT_THEME_KEY]

  return {
    ['--tm-system-accent' as string]: entry.accent,
    ['--tm-system-glow' as string]: entry.glow,
    ['--active-ring' as string]: entry.accent,
    ['--active-glow' as string]: entry.glow,
    ['--accent-ring-soft' as string]: entry.accent,
    ['--accent-glow-soft' as string]: entry.glow,
  }
}

export function SystemThemeProvider({ accentKey, children }: SystemThemeProviderProps) {
  const normalizedKey = React.useMemo<SystemThemeKey>(() => normalizeSystemThemeKey(accentKey), [accentKey])

  const value = React.useMemo<SystemThemeValue>(
    () => ({
      systemKey: normalizedKey,
      brandClassName: `brand-${normalizedKey}`,
      isProvided: true,
      styleVars: buildSystemThemeStyleVars(normalizedKey),
    }),
    [normalizedKey],
  )

  return <SystemThemeContext.Provider value={value}>{children}</SystemThemeContext.Provider>
}

export function useSystemTheme(): SystemThemeValue {
  return React.useContext(SystemThemeContext)
}
