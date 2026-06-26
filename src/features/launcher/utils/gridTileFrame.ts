export type GridTileShapeMode = 'rounded' | 'square' | 'circle'

type GridTileFramePaths = {
  outerPath: string
  innerClipPathObject: string
  logoAnchor: {
    xPct: number
    yPct: number
    sizePct: number
  }
}

const ROUNDED_PATHS: GridTileFramePaths = {
  outerPath: [
    'M 89 1.7',
    'Q 95.9 1.7 98.3 8.6',
    'L 98.3 91.4',
    'Q 95.9 98.3 89 98.3',
    'L 11 98.3',
    'Q 4.1 98.3 1.7 91.4',
    'L 1.7 8.6',
    'Q 4.1 1.7 11 1.7',
    'L 89 1.7',
    'Z',
  ].join(' '),
  innerClipPathObject: [
    'M 0.934 0.056',
    'Q 0.946 0.056 0.946 0.068',
    'L 0.946 0.932',
    'Q 0.946 0.944 0.934 0.944',
    'L 0.066 0.944',
    'Q 0.054 0.944 0.054 0.932',
    'L 0.054 0.068',
    'Q 0.054 0.056 0.066 0.056',
    'L 0.934 0.056',
    'Z',
  ].join(' '),
  logoAnchor: {
    xPct: 0.104,
    yPct: 0.084,
    sizePct: 0.04,
  },
}

const SQUARE_PATHS: GridTileFramePaths = {
  outerPath: [
    'M 87 9',
    'Q 94 9 94 16',
    'L 94 86',
    'Q 94 94 86 94',
    'L 14 94',
    'Q 6 94 6 86',
    'L 6 14',
    'Q 6 9 11 9',
    'L 16 9',
    'Q 18.6 9 20.4 7.2',
    'Q 23.2 4.4 26.8 4.4',
    'Q 30.4 4.4 33.2 7.2',
    'Q 35 9 38.4 9',
    'L 87 9',
    'Z',
  ].join(' '),
  innerClipPathObject: [
    'M 0.79 0.19',
    'Q 0.89 0.19 0.89 0.25',
    'L 0.89 0.79',
    'Q 0.89 0.89 0.79 0.89',
    'L 0.21 0.89',
    'Q 0.11 0.89 0.11 0.79',
    'L 0.11 0.24',
    'Q 0.11 0.19 0.16 0.19',
    'L 0.19 0.19',
    'Q 0.22 0.19 0.24 0.17',
    'Q 0.27 0.14 0.3 0.14',
    'Q 0.34 0.14 0.37 0.17',
    'Q 0.39 0.19 0.43 0.19',
    'L 0.79 0.19',
    'Z',
  ].join(' '),
  logoAnchor: {
    xPct: 0.285,
    yPct: 0.102,
    sizePct: 0.112,
  },
}

const CIRCLE_PATHS: GridTileFramePaths = {
  outerPath: [
    'M 78 10.8',
    'Q 89.4 10.8 93.2 22.2',
    'L 93.2 77.8',
    'Q 89.4 89.2 78 93',
    'L 22 93',
    'Q 10.6 89.2 6.8 77.8',
    'L 6.8 22.2',
    'Q 10.6 10.8 22 10.8',
    'Q 25 10.8 27.2 8.6',
    'Q 31.2 4.6 35.8 4.6',
    'Q 40.4 4.6 44.4 8.6',
    'Q 46.6 10.8 50.4 10.8',
    'L 78 10.8',
    'Z',
  ].join(' '),
  innerClipPathObject: [
    'M 0.75 0.2',
    'Q 0.84 0.2 0.84 0.29',
    'L 0.84 0.74',
    'Q 0.84 0.84 0.74 0.84',
    'L 0.26 0.84',
    'Q 0.16 0.84 0.16 0.74',
    'L 0.16 0.26',
    'Q 0.16 0.2 0.22 0.2',
    'Q 0.24 0.2 0.26 0.18',
    'Q 0.29 0.15 0.33 0.15',
    'Q 0.37 0.15 0.4 0.18',
    'Q 0.42 0.2 0.45 0.2',
    'L 0.75 0.2',
    'Z',
  ].join(' '),
  logoAnchor: {
    xPct: 0.305,
    yPct: 0.105,
    sizePct: 0.118,
  },
}

export function normalizeGridTileShapeMode(value: string | null | undefined): GridTileShapeMode {
  if (value === 'square' || value === 'circle') {
    return value
  }

  return 'rounded'
}

export function buildGridTileFramePaths(shapeMode: GridTileShapeMode): GridTileFramePaths {
  if (shapeMode === 'square') {
    return SQUARE_PATHS
  }

  if (shapeMode === 'circle') {
    return CIRCLE_PATHS
  }

  return ROUNDED_PATHS
}
