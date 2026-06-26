import type { GridSizeMode, SystemsGridSizeMode } from '../types'

export const GRID_BASE_COLUMNS_BY_MODE: Record<GridSizeMode, number> = {
  compact: 5,
  medium: 4,
  large: 3,
}

export const GRID_MIN_TILE_WIDTH_PX_BY_MODE: Record<GridSizeMode, number> = {
  compact: 146,
  medium: 166,
  large: 196,
}

export const GRID_FALLBACK_GAP_PX_BY_MODE: Record<GridSizeMode, number> = {
  compact: 10,
  medium: 12,
  large: 13,
}

const SYSTEMS_GRID_BASE_COLUMNS_BY_MODE: Record<SystemsGridSizeMode, number> = {
  compact: 6,
  medium: 5,
  large: 4,
}

const SYSTEMS_GRID_MIN_TILE_WIDTH_PX_BY_MODE: Record<SystemsGridSizeMode, number> = {
  compact: 130,
  medium: 146,
  large: 176,
}

const SYSTEMS_GRID_FALLBACK_GAP_PX_BY_MODE: Record<SystemsGridSizeMode, number> = {
  compact: 10,
  medium: 11,
  large: 12,
}

function mapSystemsSizeMode(mode: SystemsGridSizeMode): GridSizeMode {
  return mode
}

export function resolveSystemsGridSizing(mode: SystemsGridSizeMode): {
  minTileWidthPx: number
  gapPx: number
  maxColumns: number
} {
  const mapped = mapSystemsSizeMode(mode)
  return {
    minTileWidthPx: SYSTEMS_GRID_MIN_TILE_WIDTH_PX_BY_MODE[mapped],
    gapPx: SYSTEMS_GRID_FALLBACK_GAP_PX_BY_MODE[mapped],
    maxColumns: SYSTEMS_GRID_BASE_COLUMNS_BY_MODE[mapped],
  }
}