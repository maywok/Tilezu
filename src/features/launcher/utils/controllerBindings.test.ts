import { describe, expect, it } from 'vitest'
import {
  CONTROLLER_ACTION_ORDER,
  CONTROLLER_ADVANCED_ACTIONS,
  CONTROLLER_ESSENTIAL_ACTIONS,
  buildControllerLaunchArgsForSystem,
  createDefaultControllerSystemBinds,
  formatControllerInputForLayout,
  layoutForGamepadFamily,
  remapBindingInputForLayout,
} from './controllerBindings'
import {
  buildGridNavigationLayout,
  pickDirectionalSpatialTarget,
  type DirectionalSpatialTarget,
} from './controllerFocus'

describe('controllerBindings runtime remap matrix', () => {
  it('maps families to runtime layouts', () => {
    expect(layoutForGamepadFamily('xbox')).toBe('xbox')
    expect(layoutForGamepadFamily('playstation')).toBe('playstation')
    expect(layoutForGamepadFamily('nintendo')).toBe('nintendo')
    expect(layoutForGamepadFamily('generic')).toBe('xbox')
    expect(layoutForGamepadFamily(null)).toBe('xbox')
  })

  it('remaps semantic face buttons from xbox to nintendo layout', () => {
    expect(remapBindingInputForLayout('face_south', 'xbox', 'nintendo')).toBe('face_east')
    expect(remapBindingInputForLayout('face_east', 'xbox', 'nintendo')).toBe('face_south')
    expect(remapBindingInputForLayout('face_north', 'xbox', 'nintendo')).toBe('face_west')
    expect(remapBindingInputForLayout('face_west', 'xbox', 'nintendo')).toBe('face_north')
  })

  it('keeps nintendo semantic mapping stable when source and target are both nintendo', () => {
    expect(remapBindingInputForLayout('face_east', 'nintendo', 'nintendo')).toBe('face_east')
    expect(remapBindingInputForLayout('face_south', 'nintendo', 'nintendo')).toBe('face_south')
  })

  it('provides nintendo confirm/back defaults physically aligned to A/B', () => {
    const nintendoDefaults = createDefaultControllerSystemBinds('nintendo')
    expect(nintendoDefaults.bindings.confirm).toBe('face_east')
    expect(nintendoDefaults.bindings.back).toBe('face_south')
  })

  it('formats symbols according to target layout labels', () => {
    expect(formatControllerInputForLayout('xbox', 'face_south')).toBe('A')
    expect(formatControllerInputForLayout('playstation', 'face_south')).toBe('Cross')
    expect(formatControllerInputForLayout('nintendo', 'face_east')).toBe('A')
    expect(formatControllerInputForLayout('nintendo', 'face_south')).toBe('B')
  })

  it('partitions controller actions into essentials and advanced', () => {
    const combined = [...CONTROLLER_ESSENTIAL_ACTIONS, ...CONTROLLER_ADVANCED_ACTIONS]
    expect(combined).toHaveLength(CONTROLLER_ACTION_ORDER.length)
    expect(new Set(combined)).toEqual(new Set(CONTROLLER_ACTION_ORDER))
  })

  it('builds RetroArch launch args from per-system binds', () => {
    const bindsBySystem = {
      n64: createDefaultControllerSystemBinds('nintendo'),
    }
    const args = buildControllerLaunchArgsForSystem('n64', bindsBySystem)
    expect(args).toHaveLength(2)
    expect(args[0]).toBe('--tm-controller-layout=nintendo')
    expect(args[1]).toMatch(/^--tm-controller-map=/)
    expect(args[1]).toContain('confirm:face_east')
    expect(args[1]).toContain('back:face_south')
  })

  it('returns no launch args when system key is missing', () => {
    expect(buildControllerLaunchArgsForSystem(null, {})).toEqual([])
    expect(buildControllerLaunchArgsForSystem('  ', {})).toEqual([])
  })
})

describe('controllerFocus spatial navigation', () => {
  it('picks the nearest target in the requested direction', () => {
    const current: DirectionalSpatialTarget = { id: '0', centerX: 100, centerY: 100 }
    const candidates: DirectionalSpatialTarget[] = [
      current,
      { id: '1', centerX: 100, centerY: 40 },
      { id: '2', centerX: 180, centerY: 42 },
      { id: '3', centerX: 100, centerY: 180 },
    ]

    expect(pickDirectionalSpatialTarget(current, candidates, 'up')?.id).toBe('1')
    expect(pickDirectionalSpatialTarget(current, candidates, 'down')?.id).toBe('3')
    expect(pickDirectionalSpatialTarget(current, candidates, 'right')?.id).toBe('2')
  })

  it('builds grid navigation slots by row and column', () => {
    const elements = [{ id: '0' }, { id: '1' }, { id: '2' }, { id: '3' }] as unknown as HTMLElement[]
    const layout = buildGridNavigationLayout(elements, 2)

    expect(layout.slotsById['0']).toEqual({ id: '0', row: 0, column: 0 })
    expect(layout.slotsById['3']).toEqual({ id: '3', row: 1, column: 1 })
    expect(layout.maxRow).toBe(1)
  })
})
