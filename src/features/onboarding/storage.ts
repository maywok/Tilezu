import { ONBOARDING_DRAFT_KEY, ONBOARDING_META_KEY, ONBOARDING_VERSION } from './constants'

export type OnboardingStep = 'animation' | 'profile' | 'import' | 'review'
export type ImportFileType = 'rom' | 'disc' | 'exe' | 'launcher'

export type OnboardingImportPreview = {
  scannedAt: number
  discoveredCount: number
  estimatedNewCount: number
  duplicateCount: number
  sampleTitles: string[]
}

export type OnboardingDraft = {
  version: number
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  hasSkippedAnimation: boolean
  profile: {
    displayName: string
    avatarDataUrl: string
    wantsOnlineLater: boolean
  }
  import: {
    selectedQuickPresetKeys: string[]
    customFolders: string[]
    selectedFileTypes: ImportFileType[]
    backgroundIndexing: boolean
    preview: OnboardingImportPreview | null
  }
}

type OnboardingMeta = {
  first_run_completed: boolean
  onboarding_version_completed: number
  completed_at: number
}

const DEFAULT_FILE_TYPES: ImportFileType[] = ['rom', 'disc', 'exe', 'launcher']

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function uniqueSteps(values: OnboardingStep[]): OnboardingStep[] {
  const allowed: OnboardingStep[] = ['animation', 'profile', 'import', 'review']
  return [...new Set(values)].filter((step) => allowed.includes(step))
}

function uniqueFileTypes(values: ImportFileType[]): ImportFileType[] {
  const allowed: ImportFileType[] = ['rom', 'disc', 'exe', 'launcher']
  const next = [...new Set(values)].filter((type) => allowed.includes(type))
  return next.length > 0 ? next : [...DEFAULT_FILE_TYPES]
}

export function createDefaultOnboardingDraft(overrides?: Partial<OnboardingDraft>): OnboardingDraft {
  const base: OnboardingDraft = {
    version: ONBOARDING_VERSION,
    currentStep: 'animation',
    completedSteps: [],
    hasSkippedAnimation: false,
    profile: {
      displayName: '',
      avatarDataUrl: '',
      wantsOnlineLater: false,
    },
    import: {
      selectedQuickPresetKeys: ['documents', 'desktop'],
      customFolders: [],
      selectedFileTypes: [...DEFAULT_FILE_TYPES],
      backgroundIndexing: true,
      preview: null,
    },
  }

  if (!overrides) {
    return base
  }

  return {
    ...base,
    ...overrides,
    profile: {
      ...base.profile,
      ...overrides.profile,
    },
    import: {
      ...base.import,
      ...overrides.import,
      selectedQuickPresetKeys: uniqueStrings(overrides.import?.selectedQuickPresetKeys ?? base.import.selectedQuickPresetKeys),
      customFolders: uniqueStrings(overrides.import?.customFolders ?? base.import.customFolders),
      selectedFileTypes: uniqueFileTypes(overrides.import?.selectedFileTypes ?? base.import.selectedFileTypes),
      backgroundIndexing: overrides.import?.backgroundIndexing ?? base.import.backgroundIndexing,
      preview: overrides.import?.preview ?? base.import.preview,
    },
    completedSteps: uniqueSteps(overrides.completedSteps ?? base.completedSteps),
  }
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadOnboardingMeta(): OnboardingMeta | null {
  return parseJson<OnboardingMeta>(localStorage.getItem(ONBOARDING_META_KEY))
}

export function isOnboardingRequired(): boolean {
  const meta = loadOnboardingMeta()
  if (!meta) {
    return true
  }

  if (!meta.first_run_completed) {
    return true
  }

  return meta.onboarding_version_completed < ONBOARDING_VERSION
}

export function loadOnboardingDraft(): OnboardingDraft {
  const parsed = parseJson<Partial<OnboardingDraft>>(localStorage.getItem(ONBOARDING_DRAFT_KEY))
  if (!parsed) {
    return createDefaultOnboardingDraft()
  }

  const preservedProfile = parsed.profile
  const preservedImport = parsed.import

  if (parsed.version !== ONBOARDING_VERSION) {
    return createDefaultOnboardingDraft({
      profile: preservedProfile,
      import: preservedImport,
    })
  }

  return createDefaultOnboardingDraft({
    ...parsed,
    completedSteps: uniqueSteps((parsed.completedSteps as OnboardingStep[] | undefined) ?? []),
    import: {
      ...preservedImport,
      selectedQuickPresetKeys: uniqueStrings(preservedImport?.selectedQuickPresetKeys ?? []),
      customFolders: uniqueStrings(preservedImport?.customFolders ?? []),
      selectedFileTypes: uniqueFileTypes((preservedImport?.selectedFileTypes as ImportFileType[] | undefined) ?? []),
      backgroundIndexing: preservedImport?.backgroundIndexing ?? true,
      preview: preservedImport?.preview ?? null,
    },
  })
}

export function saveOnboardingDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft))
    return
  } catch {
    // Try a compact fallback payload if storage quota is exceeded.
  }

  try {
    const compactDraft: OnboardingDraft = {
      ...draft,
      profile: {
        ...draft.profile,
        avatarDataUrl: '',
      },
    }
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(compactDraft))
  } catch {
    // Ignore final fallback errors to keep onboarding UI responsive.
  }
}

export function clearOnboardingDraft(): void {
  localStorage.removeItem(ONBOARDING_DRAFT_KEY)
}

export function markOnboardingCompleted(): void {
  const meta: OnboardingMeta = {
    first_run_completed: true,
    onboarding_version_completed: ONBOARDING_VERSION,
    completed_at: Date.now(),
  }

  localStorage.setItem(ONBOARDING_META_KEY, JSON.stringify(meta))
  clearOnboardingDraft()
}
