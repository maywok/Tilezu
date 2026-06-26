import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildClaimFeedbackFromResult } from '../features/playtime/buildClaimFeedback'
import { PLAYTIME_PLANET_ENABLED } from '../features/playtime/featureFlags'
import { emitTokenWalletDeposit } from '../features/playtime/tokenWalletAnimation'
import { formatLastPlayedShort, formatPlaytimeMinutes } from '../features/launcher/utils/category'
import { focusFirst, collectNativeFocusable } from '../features/launcher/utils/controllerFocus'
import { useKeychainAttachments, type PlaytimeHubGameEntry, type RungoTrioRole } from '../features/launcher/hooks/useKeychainAttachments'
import { ownedKeychains } from './keychains-data'
import { emitSignatureRungoReaction } from '../features/launcher/utils/signatureRungoReaction'
import { FloatingTag } from './playtime/FloatingTag'
import { GlassCard } from './playtime/GlassCard'
import { PlaytimeOrb } from './playtime/PlaytimeOrb'

export type PlaytimeModalView = 'hub' | 'game-detail'

export type { PlaytimeHubGameEntry }

interface PlaytimeModalProps {
  isOpen: boolean
  themeKey: string
  view: PlaytimeModalView
  hubGameEntries: PlaytimeHubGameEntry[]
  libraryTotalMinutes: number
  gameDetails: PlaytimeHubGameEntry | null
  totalClaimableTokens: number
  focusGameId?: string
  onClose: () => void
  onSelectGame: (gameId: string) => void
  onBackToHub: () => void
}

type OrbTag = {
  label: string
  value: string
}

type RunnerDropTargetCenter = {
  x: number
  y: number
  width: number
  height: number
  label: string
}

type RunnerDragStatePayload = {
  isDragging: boolean
  runnerKey: string | null
  activeTargetId?: string | null
  clientX?: number
  clientY?: number
}

type ActivePlanetRungo = {
  id: string
  displayName: string
  baseName: string
  previewSheetUrl: string
  trioRole: RungoTrioRole | null
  isSignature: boolean
}

const ORB_CENTER_TARGET_ID = 'orb-center'
const MODAL_HEADER_TARGET_ID = 'modal-header'
const MODAL_CARDS_TARGET_ID = 'modal-cards'
const MODAL_CLOSE_TARGET_ID = 'modal-close'
const ORBIT_BOX_TARGET_ID = 'orbit-box'
const RUNGO_DRAG_DATA_MIME = 'application/x-tm-rungo-id'
const RUNGO_DRAG_TEXT_PREFIX = 'tm-rungo:'
const ACTIVE_RUNGO_DRAG_WINDOW_KEY = '__tmActiveRungoDragId'
const RUNGO_TRIO_ROLE_OPTIONS: Array<{ id: RungoTrioRole; label: string }> = [
  { id: 'leader', label: 'Leader' },
  { id: 'mood', label: 'Mood' },
  { id: 'hype', label: 'Hype' },
]
const RUNGO_TRIO_ROLE_LABELS: Record<RungoTrioRole, string> = {
  leader: 'Leader',
  mood: 'Mood',
  hype: 'Hype',
}

function isRungoTrioRole(value: string): value is RungoTrioRole {
  return value === 'leader' || value === 'mood' || value === 'hype'
}

function readActiveRungoDragIdFromWindow(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const hostWindow = window as unknown as { __tmActiveRungoDragId?: unknown }
  const payload = hostWindow[ACTIVE_RUNGO_DRAG_WINDOW_KEY]
  if (typeof payload !== 'string') {
    return null
  }

  const normalized = payload.trim()
  return normalized || null
}

function resolveDraggedRungoId(event: React.DragEvent<HTMLElement>): string | null {
  const payloadFromMime = event.dataTransfer.getData(RUNGO_DRAG_DATA_MIME).trim()
  if (payloadFromMime) {
    return payloadFromMime
  }

  const payloadFromText = event.dataTransfer.getData('text/plain').trim()
  if (payloadFromText.startsWith(RUNGO_DRAG_TEXT_PREFIX)) {
    const fromText = payloadFromText.slice(RUNGO_DRAG_TEXT_PREFIX.length).trim()
    return fromText || null
  }

  return readActiveRungoDragIdFromWindow()
}

function resolveOrbitSlotCapacity(totalMinutes: number): number {
  const hours = Math.max(0, Math.floor(totalMinutes / 60))
  const base = Math.min(10, Math.floor(hours / 10))
  const bonus = (hours >= 500 ? 1 : 0) + (hours >= 1000 ? 1 : 0)
  return Math.min(12, base + bonus)
}

function renderSourceNote(): string {
  return 'Official playtime is available for Steam when connected. Other launchers use tracked Tile Manager sessions.'
}

export const PlaytimeModal: React.FC<PlaytimeModalProps> = ({
  isOpen,
  themeKey,
  view,
  hubGameEntries,
  libraryTotalMinutes,
  gameDetails,
  totalClaimableTokens,
  focusGameId = '',
  onClose,
  onSelectGame,
  onBackToHub,
}) => {
  const {
    gardenThemes,
    rangePerks,
    rangeCosmetics,
    rangeToyCatalog,
    getClaimableTokenCountForGame,
    claimGamePlaytimeTokens,
    claimAllGamePlaytimeTokens,
    isRungoUnlocked,
    signatureRungoId,
    setSignatureRungoId,
    getPlanetLoadoutForGame,
    addRungoToPlanetLoadout,
    removeRungoFromPlanetLoadout,
    getRungoTrioForGame,
    setRungoTrioRoleForGame,
    getRungoNameOverridesForGame,
    setRungoNameOverrideForGame,
  } = useKeychainAttachments()
  const [isOrbExpanded, setIsOrbExpanded] = useState(false)
  const [isRunnerDragging, setIsRunnerDragging] = useState(false)
  const [activeDropTargetId, setActiveDropTargetId] = useState<string | null>(null)
  const [claimFeedback, setClaimFeedback] = useState('')
  const [roleFeedback, setRoleFeedback] = useState('')
  const [hubSearch, setHubSearch] = useState('')
  const [isHubSearchFocused, setIsHubSearchFocused] = useState(false)
  const [pendingAddRungoId, setPendingAddRungoId] = useState('')
  const [editingPlanetRungoId, setEditingPlanetRungoId] = useState<string | null>(null)
  const [editingPlanetRungoAlias, setEditingPlanetRungoAlias] = useState('')
  const [runnerAnchorByKey, setRunnerAnchorByKey] = useState<Record<string, string>>({})
  const [runnerDropTargetCenters, setRunnerDropTargetCenters] = useState<Record<string, RunnerDropTargetCenter>>({})
  const closeGuardUntilRef = useRef(0)
  const claimFeedbackTimerRef = useRef<number | null>(null)
  const roleFeedbackTimerRef = useRef<number | null>(null)
  const headerDropRef = useRef<HTMLElement | null>(null)
  const centerDropRef = useRef<HTMLDivElement | null>(null)
  const cardsDropRef = useRef<HTMLDivElement | null>(null)
  const hubListRef = useRef<HTMLDivElement | null>(null)
  const hubRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const panelRef = useRef<HTMLElement | null>(null)
  const orbitBoxDropRef = useRef<HTMLDivElement | null>(null)
  const closeDropRef = useRef<HTMLButtonElement | null>(null)

  const showPlanetUi = PLAYTIME_PLANET_ENABLED && view === 'game-detail'
  const detailMinutes = gameDetails?.totalMinutes ?? 0
  const orbitSlotCapacity = useMemo(() => resolveOrbitSlotCapacity(detailMinutes), [detailMinutes])
  const normalizedHubSearch = hubSearch.trim().toLowerCase()
  const hasHubSearchQuery = normalizedHubSearch.length > 0
  const filteredHubGameEntries = useMemo(() => {
    if (!hasHubSearchQuery) {
      return hubGameEntries
    }

    return hubGameEntries.filter((entry) => entry.title.toLowerCase().includes(normalizedHubSearch))
  }, [hasHubSearchQuery, hubGameEntries, normalizedHubSearch])

  const gamePlanetLoadout = useMemo(() => {
    if (view !== 'game-detail' || !gameDetails) {
      return []
    }

    return getPlanetLoadoutForGame(gameDetails.id)
  }, [gameDetails, getPlanetLoadoutForGame, view])

  const activeGamePlanetLoadout = useMemo(() => {
    if (view !== 'game-detail') {
      return []
    }

    return gamePlanetLoadout.slice(0, orbitSlotCapacity)
  }, [gamePlanetLoadout, view, orbitSlotCapacity])

  const rungoById = useMemo(() => {
    return ownedKeychains.reduce<Record<string, (typeof ownedKeychains)[number]>>((map, entry) => {
      map[entry.id] = entry
      return map
    }, {})
  }, [])

  const gameRungoNameOverrides = useMemo(() => {
    if (view !== 'game-detail' || !gameDetails) {
      return {}
    }

    return getRungoNameOverridesForGame(gameDetails.id)
  }, [gameDetails, getRungoNameOverridesForGame, view])

  const gameRungoTrioRoles = useMemo<Partial<Record<RungoTrioRole, string>>>(() => {
    if (view !== 'game-detail' || !gameDetails) {
      return {}
    }

    return getRungoTrioForGame(gameDetails.id)
  }, [gameDetails, getRungoTrioForGame, view])

  const gameRungoRoleById = useMemo<Partial<Record<string, RungoTrioRole>>>(() => {
    const next: Partial<Record<string, RungoTrioRole>> = {}
    Object.entries(gameRungoTrioRoles).forEach(([roleId, rungoId]) => {
      if (!rungoId || !isRungoTrioRole(roleId)) {
        return
      }

      next[rungoId] = roleId
    })

    return next
  }, [gameRungoTrioRoles])

  const activePlanetRungos = useMemo<ActivePlanetRungo[]>(() => {
    if (view !== 'game-detail') {
      return []
    }

    return activeGamePlanetLoadout
      .map((rungoId) => {
        const entry = rungoById[rungoId]
        if (!entry) {
          return null
        }

        return {
          id: entry.id,
          baseName: entry.name,
          displayName: gameRungoNameOverrides[entry.id] ?? entry.name,
          previewSheetUrl: entry.previewSheetUrl,
          trioRole: gameRungoRoleById[entry.id] ?? null,
          isSignature: signatureRungoId === entry.id,
        }
      })
      .filter((entry): entry is ActivePlanetRungo => Boolean(entry))
  }, [
    activeGamePlanetLoadout,
    gameRungoNameOverrides,
    gameRungoRoleById,
    view,
    rungoById,
    signatureRungoId,
  ])

  const trioSummary = useMemo(() => {
    if (view !== 'game-detail') {
      return []
    }

    return RUNGO_TRIO_ROLE_OPTIONS.map((entry) => {
      const rungoId = gameRungoTrioRoles[entry.id]
      if (!rungoId) {
        return `${entry.label}: --`
      }

      const rungoEntry = rungoById[rungoId]
      const rungoBaseName = rungoEntry?.name ?? rungoId
      const rungoDisplayName = gameRungoNameOverrides[rungoId] ?? rungoBaseName
      return `${entry.label}: ${rungoDisplayName}`
    })
  }, [gameRungoNameOverrides, gameRungoTrioRoles, view, rungoById])

  const addablePlanetRungos = useMemo(() => {
    if (view !== 'game-detail') {
      return []
    }

    const activeSet = new Set(activeGamePlanetLoadout)
    return ownedKeychains.filter((entry) => {
      return isRungoUnlocked(entry.id) && !activeSet.has(entry.id)
    })
  }, [activeGamePlanetLoadout, isRungoUnlocked, view])

  const claimableTokenCount = useMemo(() => {
    if (view !== 'game-detail' || !gameDetails) {
      return 0
    }

    return getClaimableTokenCountForGame(gameDetails.id, gameDetails.totalMinutes)
  }, [gameDetails, getClaimableTokenCountForGame, view])

  const refreshDropTargetCenters = useCallback(() => {
    const nextCenters: Record<string, RunnerDropTargetCenter> = {}

    const addCenter = (targetId: string, label: string, element: Element | null) => {
      if (!element) {
        return
      }

      const rect = element.getBoundingClientRect()
      nextCenters[targetId] = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
        label,
      }
    }

    addCenter(MODAL_HEADER_TARGET_ID, 'Header', headerDropRef.current)
    addCenter(ORB_CENTER_TARGET_ID, 'Orb Center', centerDropRef.current)
    addCenter(MODAL_CARDS_TARGET_ID, 'Game Details', cardsDropRef.current)
    addCenter(ORBIT_BOX_TARGET_ID, 'Orbit Box', orbitBoxDropRef.current)
    addCenter(MODAL_CLOSE_TARGET_ID, 'Close Button', closeDropRef.current)

    setRunnerDropTargetCenters(nextCenters)
  }, [view])

  const handleRequestClose = useCallback(() => {
    const now = Date.now()
    if (isRunnerDragging || now < closeGuardUntilRef.current) {
      return
    }

    onClose()
  }, [isRunnerDragging, onClose])

  const handleRunnerDragStateChange = useCallback((state: RunnerDragStatePayload) => {
    setIsRunnerDragging(state.isDragging)
    if (state.isDragging) {
      setActiveDropTargetId(state.activeTargetId ?? ORB_CENTER_TARGET_ID)
      closeGuardUntilRef.current = Date.now() + 560
      return
    }

    setActiveDropTargetId(null)
    closeGuardUntilRef.current = Math.max(closeGuardUntilRef.current, Date.now() + 220)
  }, [])

  const handleRunnerAssignAnchor = useCallback((runnerKey: string, targetId: string, rungoId?: string) => {
    if (targetId === ORBIT_BOX_TARGET_ID && view === 'game-detail' && gameDetails && rungoId) {
      removeRungoFromPlanetLoadout(gameDetails.id, rungoId)
      setRunnerAnchorByKey((previous) => {
        const next = { ...previous }
        delete next[runnerKey]
        return next
      })
      closeGuardUntilRef.current = Date.now() + 640
      return
    }

    setRunnerAnchorByKey((previous) => ({
      ...previous,
      [runnerKey]: targetId,
    }))
    closeGuardUntilRef.current = Date.now() + 640
  }, [gameDetails, view, removeRungoFromPlanetLoadout])

  const startPlanetRungoRename = useCallback((entry: ActivePlanetRungo) => {
    setEditingPlanetRungoId(entry.id)
    setEditingPlanetRungoAlias(entry.displayName)
  }, [])

  const cancelPlanetRungoRename = useCallback(() => {
    setEditingPlanetRungoId(null)
    setEditingPlanetRungoAlias('')
  }, [])

  const commitPlanetRungoRename = useCallback((entry: ActivePlanetRungo) => {
    if (!gameDetails) {
      cancelPlanetRungoRename()
      return
    }

    const normalizedAlias = editingPlanetRungoAlias.trim()
    const aliasValue = !normalizedAlias || normalizedAlias === entry.baseName
      ? ''
      : normalizedAlias

    setRungoNameOverrideForGame(gameDetails.id, entry.id, aliasValue)
    cancelPlanetRungoRename()
  }, [cancelPlanetRungoRename, editingPlanetRungoAlias, gameDetails, setRungoNameOverrideForGame])

  const resolveRungoDisplayName = useCallback((rungoId: string) => {
    const overrideName = gameRungoNameOverrides[rungoId]?.trim()
    if (overrideName) {
      return overrideName
    }

    return rungoById[rungoId]?.name ?? 'Rungo'
  }, [gameRungoNameOverrides, rungoById])

  const setPlanetRungoTrioRole = useCallback((rungoId: string, nextRole: RungoTrioRole | null) => {
    if (!gameDetails) {
      return
    }

    const rungoDisplayName = resolveRungoDisplayName(rungoId)
    const currentRole = gameRungoRoleById[rungoId] ?? null
    if (!nextRole) {
      if (!currentRole) {
        return
      }

      setRungoTrioRoleForGame(gameDetails.id, currentRole, null)
      setRoleFeedback(`${rungoDisplayName} removed from ${RUNGO_TRIO_ROLE_LABELS[currentRole]}.`)
      return
    }

    if (currentRole === nextRole) {
      return
    }

    const displacedRungoId = gameRungoTrioRoles[nextRole] ?? null
    const previousRoleLabel = currentRole ? RUNGO_TRIO_ROLE_LABELS[currentRole] : null
    setRungoTrioRoleForGame(gameDetails.id, nextRole, rungoId)

    const nextRoleLabel = RUNGO_TRIO_ROLE_LABELS[nextRole]
    if (displacedRungoId && displacedRungoId !== rungoId) {
      const displacedRungoName = resolveRungoDisplayName(displacedRungoId)
      setRoleFeedback(`${rungoDisplayName} set as ${nextRoleLabel}. ${displacedRungoName} was replaced.`)
      return
    }

    if (previousRoleLabel) {
      setRoleFeedback(`${rungoDisplayName} moved from ${previousRoleLabel} to ${nextRoleLabel}.`)
      return
    }

    setRoleFeedback(`${rungoDisplayName} set as ${nextRoleLabel}.`)
  }, [gameDetails, gameRungoRoleById, gameRungoTrioRoles, resolveRungoDisplayName, setRungoTrioRoleForGame])

  const handleOrbitBoxDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (view !== 'game-detail' || !gameDetails) {
      return
    }

    const draggedRungoId = resolveDraggedRungoId(event)
    if (!draggedRungoId) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [gameDetails, view])

  const handleOrbitBoxDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (view !== 'game-detail' || !gameDetails) {
      return
    }

    const draggedRungoId = resolveDraggedRungoId(event)
    if (!draggedRungoId) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const result = addRungoToPlanetLoadout(gameDetails.id, draggedRungoId, orbitSlotCapacity)
    if (result.updated) {
      setClaimFeedback('Rungo added to this planet.')
      return
    }

    if (result.reason === 'capacity') {
      setClaimFeedback(`Planet is full (${orbitSlotCapacity} max by playtime).`)
      return
    }

    if (result.reason === 'already-present') {
      setClaimFeedback('That Rungo is already on this planet.')
      return
    }

    if (result.reason === 'locked') {
      setClaimFeedback('That Rungo is still locked.')
      return
    }

    setClaimFeedback('Unable to add that Rungo right now.')
  }, [addRungoToPlanetLoadout, gameDetails, view, orbitSlotCapacity])

  const claimFeedbackCatalog = useMemo(() => ({
    gardenThemes,
    rangePerks,
    rangeCosmetics,
    rangeToyCatalog,
  }), [gardenThemes, rangeCosmetics, rangePerks, rangeToyCatalog])

  const applyClaimFeedback = useCallback((claimResult: Parameters<typeof buildClaimFeedbackFromResult>[0]) => {
    const feedback = buildClaimFeedbackFromResult(claimResult, claimFeedbackCatalog)
    if (feedback) {
      setClaimFeedback(feedback)
      if (claimResult.claimedTokens > 0) {
        emitSignatureRungoReaction('claim-token', 'playtime-claim')
      }
      return
    }

    setClaimFeedback('No new milestone tokens to claim yet.')
  }, [claimFeedbackCatalog])

  const handleClaimGame = useCallback((event: React.MouseEvent<HTMLButtonElement>, gameId: string, playtimeMinutes: number) => {
    const claimResult = claimGamePlaytimeTokens(gameId, playtimeMinutes)
    if (claimResult.claimedTokens > 0) {
      emitTokenWalletDeposit({
        tokenCount: claimResult.claimedTokens,
        originRect: event.currentTarget.getBoundingClientRect(),
      })
    }

    applyClaimFeedback(claimResult)
  }, [applyClaimFeedback, claimGamePlaytimeTokens])

  const handleClaimAll = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const entries = hubGameEntries.map((entry) => ({
      gameId: entry.id,
      playtimeMinutes: entry.totalMinutes,
    }))
    const claimResult = claimAllGamePlaytimeTokens(entries)
    if (claimResult.claimedTokens > 0) {
      emitTokenWalletDeposit({
        tokenCount: claimResult.claimedTokens,
        originRect: event.currentTarget.getBoundingClientRect(),
      })
    }

    applyClaimFeedback(claimResult)
  }, [applyClaimFeedback, claimAllGamePlaytimeTokens, hubGameEntries])

  const orbTags = useMemo<OrbTag[]>(() => {
    if (!gameDetails) {
      return [
        {
          label: 'Status',
          value: 'No game selected',
        },
      ]
    }

    return [
      {
        label: 'Tracked',
        value: formatPlaytimeMinutes(gameDetails.trackedMinutes),
      },
      {
        label: 'Official',
        value:
          gameDetails.officialMinutes === null
            ? 'Unavailable'
            : formatPlaytimeMinutes(gameDetails.officialMinutes),
      },
      {
        label: 'Launches',
        value: gameDetails.playCount.toString(),
      },
    ]
  }, [gameDetails])

  useEffect(() => {
    setIsOrbExpanded(false)
    setPendingAddRungoId('')
    setEditingPlanetRungoId(null)
    setEditingPlanetRungoAlias('')
  }, [isOpen, view, gameDetails?.title])

  useEffect(() => {
    if (!editingPlanetRungoId) {
      return
    }

    if (activePlanetRungos.some((entry) => entry.id === editingPlanetRungoId)) {
      return
    }

    setEditingPlanetRungoId(null)
    setEditingPlanetRungoAlias('')
  }, [activePlanetRungos, editingPlanetRungoId])

  useEffect(() => {
    if (claimFeedbackTimerRef.current) {
      window.clearTimeout(claimFeedbackTimerRef.current)
      claimFeedbackTimerRef.current = null
    }

    if (!claimFeedback) {
      return
    }

    claimFeedbackTimerRef.current = window.setTimeout(() => {
      setClaimFeedback('')
      claimFeedbackTimerRef.current = null
    }, 2200)

    return () => {
      if (claimFeedbackTimerRef.current) {
        window.clearTimeout(claimFeedbackTimerRef.current)
        claimFeedbackTimerRef.current = null
      }
    }
  }, [claimFeedback])

  useEffect(() => {
    if (roleFeedbackTimerRef.current) {
      window.clearTimeout(roleFeedbackTimerRef.current)
      roleFeedbackTimerRef.current = null
    }

    if (!roleFeedback) {
      return
    }

    roleFeedbackTimerRef.current = window.setTimeout(() => {
      setRoleFeedback('')
      roleFeedbackTimerRef.current = null
    }, 1800)

    return () => {
      if (roleFeedbackTimerRef.current) {
        window.clearTimeout(roleFeedbackTimerRef.current)
        roleFeedbackTimerRef.current = null
      }
    }
  }, [roleFeedback])

  useEffect(() => {
    if (isOpen) {
      return
    }

    setIsRunnerDragging(false)
    setActiveDropTargetId(null)
    setClaimFeedback('')
    setRoleFeedback('')
    setHubSearch('')
    setIsHubSearchFocused(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) {
        return
      }

      if (view === 'hub' && focusGameId) {
        const rowButton = hubRowRefs.current[focusGameId]?.querySelector<HTMLElement>('.playtime-hub-row-main')
        if (rowButton) {
          rowButton.focus()
          rowButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          return
        }
      }

      focusFirst(collectNativeFocusable(panel))
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [focusGameId, isOpen, view])

  useEffect(() => {
    if (!isOpen || view !== 'hub') {
      return
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      const row = target?.closest('.playtime-hub-row')
      if (row) {
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }

    const list = hubListRef.current
    list?.addEventListener('focusin', handleFocusIn)
    return () => {
      list?.removeEventListener('focusin', handleFocusIn)
    }
  }, [isOpen, view])

  useEffect(() => {
    if (!isOpen || view !== 'hub' || !focusGameId) {
      return
    }

    const scrollToFocusedRow = () => {
      const row = hubRowRefs.current[focusGameId]
      if (!row) {
        return
      }

      row.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }

    const frameId = window.requestAnimationFrame(scrollToFocusedRow)
    const retryTimer = window.setTimeout(scrollToFocusedRow, 120)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(retryTimer)
    }
  }, [focusGameId, hubGameEntries, isOpen, view])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return
    }

    const updateCenters = () => {
      refreshDropTargetCenters()
    }

    updateCenters()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
        updateCenters()
      })
      : null

    const observedTargets = [
      headerDropRef.current,
      centerDropRef.current,
      cardsDropRef.current,
      orbitBoxDropRef.current,
      closeDropRef.current,
    ].filter((element): element is HTMLElement => Boolean(element))

    if (resizeObserver) {
      observedTargets.forEach((element) => {
        resizeObserver.observe(element)
      })
    }

    window.addEventListener('resize', updateCenters)
    window.addEventListener('scroll', updateCenters, true)

    return () => {
      window.removeEventListener('resize', updateCenters)
      window.removeEventListener('scroll', updateCenters, true)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [gameDetails?.title, isOpen, isOrbExpanded, showPlanetUi, refreshDropTargetCenters, view])

  if (!isOpen) {
    return null
  }

  const headerClassName = [
    'playtime-liquid-header',
    showPlanetUi ? 'playtime-runner-drop-target' : '',
    isRunnerDragging ? 'is-runner-dragging' : '',
    activeDropTargetId === MODAL_HEADER_TARGET_ID ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')

  const closeButtonClassName = [
    'playtime-liquid-close',
    showPlanetUi ? 'playtime-runner-drop-target' : '',
    isRunnerDragging ? 'is-runner-dragging' : '',
    activeDropTargetId === MODAL_CLOSE_TARGET_ID ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')

  const centerClassName = [
    'playtime-liquid-center',
    'playtime-runner-drop-target',
    isRunnerDragging ? 'is-runner-dragging' : '',
    activeDropTargetId === ORB_CENTER_TARGET_ID ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')

  const capsuleGridClassName = [
    'playtime-capsule-grid',
    view === 'game-detail' ? 'single-column' : '',
    showPlanetUi ? 'playtime-runner-drop-target' : '',
    isRunnerDragging ? 'is-runner-dragging' : '',
    activeDropTargetId === MODAL_CARDS_TARGET_ID ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')

  const orbitBoxClassName = [
    'playtime-orbit-box',
    'playtime-runner-drop-target',
    isRunnerDragging ? 'is-runner-dragging' : '',
    activeDropTargetId === ORBIT_BOX_TARGET_ID ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')

  const panelClassName = [
    `playtime-liquid-panel brand-${themeKey}`,
    view === 'hub' ? 'is-hub-view' : 'is-game-detail-view',
    showPlanetUi ? '' : 'is-planet-disabled',
    isRunnerDragging ? 'is-runner-dragging' : '',
  ].filter(Boolean).join(' ')

  const renderGameDetailStats = (details: PlaytimeHubGameEntry) => (
    <GlassCard interactive className="playtime-game-capsule">
      <div className="playtime-capsule-head">
        <strong>{details.title}</strong>
        <span className="playtime-capsule-time">{formatPlaytimeMinutes(details.totalMinutes)}</span>
      </div>

      <div className="playtime-tag-row">
        <FloatingTag label="Tracked" value={formatPlaytimeMinutes(details.trackedMinutes)} depth={1} />
        <FloatingTag
          label="Official"
          value={details.officialMinutes === null ? 'Unavailable' : formatPlaytimeMinutes(details.officialMinutes)}
          depth={1.14}
        />
        <FloatingTag label="Launch Count" value={details.playCount.toString()} depth={1.22} />
        <FloatingTag label="Last Played" value={formatLastPlayedShort(details.lastPlayedAt)} depth={1.28} />
        <FloatingTag label="Data Source" value={details.sourceLabel} depth={1.34} />
      </div>

      <div className="playtime-claim-row">
        <button
          type="button"
          className={claimableTokenCount > 0 ? 'playtime-claim-button' : 'playtime-claim-button is-disabled'}
          data-controller-focusable=""
          disabled={claimableTokenCount <= 0}
          onClick={(event) => {
            handleClaimGame(event, details.id, details.totalMinutes)
          }}
        >
          Claim Tokens ({claimableTokenCount})
        </button>
      </div>

      {claimFeedback ? <p className="playtime-claim-feedback">{claimFeedback}</p> : null}
    </GlassCard>
  )

  const renderPlanetAside = () => {
    if (!showPlanetUi || !gameDetails) {
      return null
    }

    return (
      <aside
        ref={orbitBoxDropRef}
        className={orbitBoxClassName}
        onDragOver={handleOrbitBoxDragOver}
        onDrop={handleOrbitBoxDrop}
      >
        <div className="playtime-orbit-box-head">
          <strong>Rungos</strong>
          <span>{activeGamePlanetLoadout.length}/{orbitSlotCapacity} Rungos</span>
        </div>
        <div className="playtime-orbit-box-trio-summary" role="status" aria-live="polite">
          {trioSummary.map((entry) => (
            <span key={entry}>{entry}</span>
          ))}
        </div>
        {roleFeedback ? <p className="playtime-orbit-box-role-feedback">{roleFeedback}</p> : null}
        <p>Click a name or use Rename to edit. Drag a runner here to remove it from this planet.</p>

        <div className="playtime-orbit-box-add-row">
          <select
            className="playtime-orbit-box-add-select"
            value={pendingAddRungoId}
            onChange={(event) => {
              setPendingAddRungoId(event.target.value)
            }}
          >
            <option value="">Add Rungo...</option>
            {addablePlanetRungos.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}</option>
            ))}
          </select>
          <button
            type="button"
            className={pendingAddRungoId ? 'playtime-orbit-box-add-button' : 'playtime-orbit-box-add-button is-disabled'}
            disabled={!pendingAddRungoId}
            onClick={() => {
              const selectedRungoId = pendingAddRungoId.trim()
              if (!selectedRungoId) {
                return
              }

              const result = addRungoToPlanetLoadout(gameDetails.id, selectedRungoId, orbitSlotCapacity)
              if (!result.updated && result.reason === 'capacity') {
                setClaimFeedback(`Planet is full (${orbitSlotCapacity} max by playtime).`)
                return
              }

              if (!result.updated) {
                setClaimFeedback('Unable to add that Rungo right now.')
                return
              }

              setPendingAddRungoId('')
            }}
          >
            Add
          </button>
        </div>

        <div className="playtime-orbit-box-list">
          {activePlanetRungos.length > 0 ? (
            activePlanetRungos.map((entry) => {
              const isEditing = editingPlanetRungoId === entry.id

              return (
                <div
                  key={entry.id}
                  className={[
                    'playtime-orbit-box-item',
                    'is-on-planet',
                    entry.isSignature ? 'is-signature' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span
                    className="playtime-orbit-box-item-preview"
                    style={{ backgroundImage: `url(${entry.previewSheetUrl})` }}
                    aria-hidden="true"
                  />

                  <div className="playtime-orbit-box-item-main">
                    {isEditing ? (
                      <input
                        className="playtime-orbit-box-item-name-input"
                        value={editingPlanetRungoAlias}
                        maxLength={42}
                        autoFocus
                        onChange={(event) => {
                          setEditingPlanetRungoAlias(event.target.value)
                        }}
                        onBlur={() => {
                          commitPlanetRungoRename(entry)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitPlanetRungoRename(entry)
                          }

                          if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelPlanetRungoRename()
                          }
                        }}
                        aria-label={`Rename ${entry.baseName}`}
                      />
                    ) : (
                      <button
                        type="button"
                        className="playtime-orbit-box-item-name-button"
                        onClick={() => {
                          startPlanetRungoRename(entry)
                        }}
                      >
                        <span className="playtime-orbit-box-item-name" title={entry.baseName}>{entry.displayName}</span>
                      </button>
                    )}

                    <div className="playtime-orbit-box-item-meta">
                      <span className="playtime-orbit-box-item-badges">
                        {entry.isSignature ? <span className="playtime-orbit-box-item-badge is-signature">Signature</span> : null}
                        {entry.trioRole ? (
                          <span className="playtime-orbit-box-item-badge is-role">{RUNGO_TRIO_ROLE_LABELS[entry.trioRole]}</span>
                        ) : null}
                      </span>
                      <label className="playtime-orbit-box-item-role-control">
                        <span>Role</span>
                        <select
                          className="playtime-orbit-box-item-role-select"
                          value={entry.trioRole ?? ''}
                          onChange={(event) => {
                            const rawRole = event.target.value.trim()
                            if (!rawRole) {
                              setPlanetRungoTrioRole(entry.id, null)
                              return
                            }

                            if (isRungoTrioRole(rawRole)) {
                              setPlanetRungoTrioRole(entry.id, rawRole)
                            }
                          }}
                        >
                          <option value="">None</option>
                          {RUNGO_TRIO_ROLE_OPTIONS.map((roleEntry) => (
                            <option key={roleEntry.id} value={roleEntry.id}>{roleEntry.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <span className="playtime-orbit-box-item-actions">
                    <button
                      type="button"
                      className={entry.isSignature ? 'playtime-orbit-box-item-signature is-active' : 'playtime-orbit-box-item-signature'}
                      onClick={() => {
                        if (entry.isSignature) {
                          return
                        }

                        setSignatureRungoId(entry.id)
                      }}
                    >
                      {entry.isSignature ? 'Signature' : 'Set Signature'}
                    </button>
                    <button
                      type="button"
                      className="playtime-orbit-box-item-rename"
                      onClick={() => {
                        if (isEditing) {
                          commitPlanetRungoRename(entry)
                          return
                        }

                        startPlanetRungoRename(entry)
                      }}
                    >
                      {isEditing ? 'Save' : 'Rename'}
                    </button>
                    <button
                      type="button"
                      className="playtime-orbit-box-item-remove"
                      onClick={() => {
                        if (isEditing) {
                          cancelPlanetRungoRename()
                        }
                        removeRungoFromPlanetLoadout(gameDetails.id, entry.id)
                      }}
                    >
                      Remove
                    </button>
                  </span>
                </div>
              )
            })
          ) : (
            <div className="playtime-orbit-box-empty">No Rungos on this planet yet.</div>
          )}
        </div>
      </aside>
    )
  }

  return (
    <div className={`playtime-liquid-overlay brand-${themeKey}`} onClick={handleRequestClose}>
      <section
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playtime-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header
          ref={headerDropRef}
          className={headerClassName}
        >
          {view === 'hub' ? (
            <>
              <h2 id="playtime-modal-title">Playtime Hub</h2>
              <p className="playtime-liquid-summary">
                {formatPlaytimeMinutes(libraryTotalMinutes)} across {hubGameEntries.length} {hubGameEntries.length === 1 ? 'game' : 'games'}
              </p>
              {totalClaimableTokens > 0 ? (
                <div className="playtime-hub-collect-all-row">
                  <button
                    type="button"
                    className="playtime-claim-button playtime-hub-collect-all"
                    data-controller-focusable=""
                    onClick={handleClaimAll}
                  >
                    <span className="playtime-hub-coin-icon" aria-hidden="true" />
                    Collect all ({totalClaimableTokens})
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 id="playtime-modal-title">{gameDetails?.title ?? 'Game Playtime'}</h2>
              <p className="playtime-liquid-summary">
                {gameDetails ? formatPlaytimeMinutes(gameDetails.totalMinutes) : 'No game selected'}
              </p>
            </>
          )}
          <p className="playtime-liquid-note">{renderSourceNote()}</p>
        </header>

        <button
          ref={closeDropRef}
          type="button"
          className={`${closeButtonClassName}${view === 'game-detail' ? ' is-back' : ''}`.trim()}
          data-controller-focusable=""
          data-controller-close=""
          onClick={(event) => {
            event.stopPropagation()
            if (view === 'game-detail') {
              onBackToHub()
              return
            }

            handleRequestClose()
          }}
          aria-label={view === 'game-detail' ? 'Back to playtime hub' : 'Close playtime hub'}
        >
          {view === 'game-detail' ? 'Back' : 'Close'}
        </button>

        {view === 'hub' ? (
          <div className="playtime-hub-shell">
            {claimFeedback ? <p className="playtime-claim-feedback playtime-hub-feedback">{claimFeedback}</p> : null}
            <div
              className={
                isHubSearchFocused
                  ? hasHubSearchQuery
                    ? 'wii-search-wrap games-search-wrap playtime-hub-search-wrap is-search-focused has-query'
                    : 'wii-search-wrap games-search-wrap playtime-hub-search-wrap is-search-focused'
                  : hasHubSearchQuery
                    ? 'wii-search-wrap games-search-wrap playtime-hub-search-wrap has-query'
                    : 'wii-search-wrap games-search-wrap playtime-hub-search-wrap'
              }
            >
              <span className="search-leading-icon" aria-hidden="true">
                {'\u2315'}
              </span>
              <input
                className="search-input games-search-input"
                data-controller-focusable=""
                value={hubSearch}
                onChange={(event) => setHubSearch(event.target.value)}
                onFocus={() => setIsHubSearchFocused(true)}
                onBlur={() => setIsHubSearchFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && hubSearch.trim().length > 0) {
                    event.preventDefault()
                    setHubSearch('')
                  }
                }}
                placeholder="Search games in hub"
                aria-label="Search playtime hub games"
              />
              {hasHubSearchQuery ? (
                <span className="search-results-pill" aria-live="polite">
                  {filteredHubGameEntries.length} {filteredHubGameEntries.length === 1 ? 'match' : 'matches'}
                </span>
              ) : null}
            </div>
            <div
              className="playtime-hub-list"
              ref={(node) => {
                hubListRef.current = node
                cardsDropRef.current = node
              }}
            >
            {hubGameEntries.length === 0 ? (
              <GlassCard className="playtime-empty-card">
                <div className="playtime-capsule-head">
                  <strong>No games in library</strong>
                  <span className="playtime-capsule-time">0m</span>
                </div>
                <p>Add games to your library to track playtime and collect milestone tokens.</p>
              </GlassCard>
            ) : filteredHubGameEntries.length === 0 ? (
              <GlassCard className="playtime-empty-card">
                <div className="playtime-capsule-head">
                  <strong>No matching games</strong>
                </div>
                <p>Try a different search term or clear the search field.</p>
              </GlassCard>
            ) : (
              filteredHubGameEntries.map((entry) => {
                const rowClaimable = getClaimableTokenCountForGame(entry.id, entry.totalMinutes)

                return (
                  <div
                    key={entry.id}
                    ref={(node) => {
                      hubRowRefs.current[entry.id] = node
                    }}
                    className={`playtime-hub-row${focusGameId === entry.id ? ' is-focused' : ''}`.trim()}
                    data-game-id={entry.id}
                  >
                    <button
                      type="button"
                      className="playtime-hub-row-main"
                      data-controller-focusable=""
                      onClick={() => onSelectGame(entry.id)}
                    >
                      <span className="playtime-hub-row-cover" aria-hidden="true">
                        {entry.iconSrc ? (
                          <img src={entry.iconSrc} alt="" />
                        ) : (
                          <span className="playtime-hub-row-cover-fallback">{entry.title.slice(0, 1)}</span>
                        )}
                      </span>
                      <span className="playtime-hub-row-copy">
                        <strong
                          data-context-copy={entry.title}
                          data-context-copy-label="Copy game name"
                        >
                          {entry.title}
                        </strong>
                        <span className="playtime-hub-row-meta">
                          {formatPlaytimeMinutes(entry.totalMinutes)}
                          {rowClaimable > 0 ? (
                            <span className="playtime-hub-token-chip">
                              <span className="playtime-hub-coin-icon" aria-hidden="true" />
                              +{rowClaimable}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={rowClaimable > 0 ? 'playtime-claim-button playtime-hub-row-claim' : 'playtime-claim-button playtime-hub-row-claim is-disabled'}
                      data-controller-focusable=""
                      disabled={rowClaimable <= 0}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleClaimGame(event, entry.id, entry.totalMinutes)
                      }}
                    >
                      Claim{rowClaimable > 0 ? ` (${rowClaimable})` : ''}
                    </button>
                  </div>
                )
              })
            )}
            </div>
          </div>
        ) : (
          <>
            {showPlanetUi ? (
              <div
                ref={centerDropRef}
                className={centerClassName}
                onDragOver={handleOrbitBoxDragOver}
                onDrop={handleOrbitBoxDrop}
              >
                <PlaytimeOrb
                  title={gameDetails?.title ?? 'Playtime'}
                  totalMinutes={detailMinutes}
                  subtitle={gameDetails?.title ?? 'Select a game to inspect details'}
                  isExpanded={isOrbExpanded}
                  showRunners={showPlanetUi}
                  runnerIconSrc={gameDetails?.iconSrc ?? null}
                  activeRungoIds={activeGamePlanetLoadout}
                  signatureRungoId={signatureRungoId}
                  rungoRoleById={gameRungoRoleById}
                  rungoNameOverridesById={gameRungoNameOverrides}
                  runnerAnchorByKey={runnerAnchorByKey}
                  runnerDropTargetCenters={runnerDropTargetCenters}
                  onRunnerDragStateChange={handleRunnerDragStateChange}
                  onRunnerAssignAnchor={handleRunnerAssignAnchor}
                  onToggle={() => {
                    setIsOrbExpanded((previous) => !previous)
                  }}
                >
                  <div className="playtime-tag-cloud">
                    {orbTags.map((tag, index) => (
                      <FloatingTag
                        key={`${tag.label}-${tag.value}-${index}`}
                        label={tag.label}
                        value={tag.value}
                        depth={1 + (index * 0.16)}
                      />
                    ))}
                  </div>
                </PlaytimeOrb>
              </div>
            ) : null}

            <div
              ref={cardsDropRef}
              className={capsuleGridClassName}
            >
              {gameDetails ? (
                <div className={`playtime-game-layout${showPlanetUi ? '' : ' is-stats-only'}`}>
                  {renderGameDetailStats(gameDetails)}
                  {renderPlanetAside()}
                </div>
              ) : (
                <GlassCard className="playtime-empty-card">
                  <div className="playtime-capsule-head">
                    <strong>No game selected</strong>
                    <span className="playtime-capsule-time">Unavailable</span>
                  </div>
                  <p>Select a game from the hub to see playtime details.</p>
                </GlassCard>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
