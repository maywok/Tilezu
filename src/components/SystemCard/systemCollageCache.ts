const SHARED_COLLAGE_PATH = '/platforms/collage/allcollage.svg'

const COLLAGE_BY_SYSTEM_KEY: Record<string, readonly string[]> = {
  all: ['/platforms/collage/allcollage.svg'],
  steam: ['/platforms/collage/steamcollage.svg'],
  epic: ['/platforms/collage/epiccollage.svg'],
  'battle-net': ['/platforms/collage/battlenetcollage.svg'],
  battle_net: ['/platforms/collage/battlenetcollage.svg'],
  battlenet: ['/platforms/collage/battlenetcollage.svg'],
  minecraft: ['/platforms/collage/minecraftcollage.svg'],
  roblox: ['/platforms/collage/robloxcollage.svg'],
  riot: ['/platforms/collage/riotcollage.svg'],
  ds: ['/platforms/collage/DScollage.svg'],
  nintendods: ['/platforms/collage/DScollage.svg'],
  'nintendo-ds': ['/platforms/collage/DScollage.svg'],
  handheld: [SHARED_COLLAGE_PATH],
  n64: [SHARED_COLLAGE_PATH],
  nes: [SHARED_COLLAGE_PATH],
  snes: [SHARED_COLLAGE_PATH],
  emulator: [SHARED_COLLAGE_PATH],
  links: [SHARED_COLLAGE_PATH],
  uri: [SHARED_COLLAGE_PATH],
}

const COLLAGE_RESOLVE_CACHE = new Map<string, string | null>()
const COLLAGE_IMAGE_LOAD_CACHE = new Map<string, Promise<boolean>>()
const COLLAGE_RESOLVE_IN_FLIGHT = new Map<string, Promise<string | null>>()

function collageCacheKey(systemKey: string | undefined): string {
  const normalized = (systemKey ?? '').trim().toLowerCase()
  return normalized || '__default__'
}

function getSystemKeyAliases(systemKey: string | undefined): string[] {
  const normalized = (systemKey ?? '').trim().toLowerCase()
  const aliases = new Set<string>()

  if (normalized) {
    aliases.add(normalized)
    aliases.add(normalized.replace(/[^a-z0-9]/g, ''))
  }

  if (normalized === 'battle-net') {
    aliases.add('battle_net')
    aliases.add('battlenet')
  }

  if (normalized === 'xbox') {
    aliases.add('xbox_app')
  }

  if (normalized === 'ds' || normalized === 'nintendo-ds' || normalized === 'nintendods') {
    aliases.add('ds')
    aliases.add('nintendo-ds')
    aliases.add('nintendods')
  }

  return Array.from(aliases)
}

function getMappedCollageCandidates(systemKey: string | undefined): string[] {
  const candidates: string[] = []

  for (const key of getSystemKeyAliases(systemKey)) {
    const mapped = COLLAGE_BY_SYSTEM_KEY[key]
    if (mapped) {
      candidates.push(...mapped)
    }
  }

  return Array.from(new Set(candidates))
}

function getHeuristicCollageCandidates(systemKey: string | undefined, mappedCandidates: readonly string[]): string[] {
  const mapped = new Set(mappedCandidates)
  const candidates: string[] = []

  for (const key of getSystemKeyAliases(systemKey)) {
    candidates.push(`/platforms/collage/${key}collage.svg`)
    candidates.push(`/platforms/collage/${key}.svg`)
    candidates.push(`/platforms/collage/${key}collage.png`)
    candidates.push(`/platforms/collage/${key}.png`)
  }

  candidates.push(SHARED_COLLAGE_PATH)

  return Array.from(new Set(candidates)).filter((candidate) => !mapped.has(candidate))
}

function tryLoadImage(url: string): Promise<boolean> {
  const cached = COLLAGE_IMAGE_LOAD_CACHE.get(url)
  if (cached) {
    return cached
  }

  const loadPromise = new Promise<boolean>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })

  COLLAGE_IMAGE_LOAD_CACHE.set(url, loadPromise)
  return loadPromise
}

async function firstLoadableUrl(urls: readonly string[]): Promise<string | null> {
  if (urls.length === 0) {
    return null
  }

  const results = await Promise.all(
    urls.map(async (url) => ((await tryLoadImage(url)) ? url : null)),
  )

  return results.find(Boolean) ?? null
}

export function getCachedSystemCollageUrl(systemKey: string | undefined): string | null | undefined {
  return COLLAGE_RESOLVE_CACHE.get(collageCacheKey(systemKey))
}

export async function resolveSystemCollageUrl(systemKey: string | undefined): Promise<string | null> {
  const cacheKey = collageCacheKey(systemKey)
  const cachedCollage = COLLAGE_RESOLVE_CACHE.get(cacheKey)
  if (cachedCollage !== undefined) {
    return cachedCollage
  }

  const inFlight = COLLAGE_RESOLVE_IN_FLIGHT.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const resolvePromise = (async () => {
    const mappedCandidates = getMappedCollageCandidates(systemKey)
    let resolved = await firstLoadableUrl(mappedCandidates)

    if (!resolved) {
      const heuristicCandidates = getHeuristicCollageCandidates(systemKey, mappedCandidates)
      resolved = await firstLoadableUrl(heuristicCandidates)
    }

    COLLAGE_RESOLVE_CACHE.set(cacheKey, resolved)
    return resolved
  })()

  COLLAGE_RESOLVE_IN_FLIGHT.set(cacheKey, resolvePromise)

  try {
    return await resolvePromise
  } finally {
    COLLAGE_RESOLVE_IN_FLIGHT.delete(cacheKey)
  }
}

export function warmSystemCollageCache(systemKeys: string[]): void {
  const uniqueKeys = Array.from(new Set(systemKeys.map((key) => key.trim()).filter(Boolean)))

  for (const systemKey of uniqueKeys) {
    void resolveSystemCollageUrl(systemKey)
  }
}