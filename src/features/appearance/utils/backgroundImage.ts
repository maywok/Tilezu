import type { ThemeBackgroundImageConfig } from '../types'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MAX_BACKGROUND_IMAGE_DATA_URL_LENGTH = 900000
const TARGET_BACKGROUND_IMAGE_DATA_URL_LENGTH = 520000
const MAX_BACKGROUND_EDGE = 1920
const MIN_BACKGROUND_EDGE = 520
const SCALE_STEP = 0.82

const ENCODE_ATTEMPTS: Array<{ mimeType: string; qualityValues: number[] }> = [
  { mimeType: 'image/webp', qualityValues: [0.9, 0.82, 0.74, 0.66] },
  { mimeType: 'image/jpeg', qualityValues: [0.9, 0.82, 0.74, 0.66] },
  { mimeType: 'image/png', qualityValues: [1] },
]

export interface OptimizedBackgroundImage {
  config: ThemeBackgroundImageConfig
  width: number
  height: number
  mimeType: string
  estimatedBytes: number
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Could not read that image file.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not decode that image file.'))
        return
      }

      resolve(reader.result)
    }

    reader.readAsDataURL(file)
  })
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not open that image.'))
    image.src = source
  })
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) {
    return dataUrl.length
  }

  const payloadLength = dataUrl.length - commaIndex - 1
  return Math.ceil((payloadLength * 3) / 4)
}

function encodeCanvas(canvas: HTMLCanvasElement): { dataUrl: string; mimeType: string } | null {
  let best: { dataUrl: string; mimeType: string } | null = null

  for (const attempt of ENCODE_ATTEMPTS) {
    for (const quality of attempt.qualityValues) {
      const encoded = canvas.toDataURL(attempt.mimeType, quality)
      if (!encoded.startsWith('data:image/')) {
        continue
      }

      if (!best || encoded.length < best.dataUrl.length) {
        const detectedMimeType = encoded.slice(5, encoded.indexOf(';'))
        best = {
          dataUrl: encoded,
          mimeType: detectedMimeType || attempt.mimeType,
        }
      }

      if (encoded.length <= TARGET_BACKGROUND_IMAGE_DATA_URL_LENGTH) {
        const detectedMimeType = encoded.slice(5, encoded.indexOf(';'))
        return {
          dataUrl: encoded,
          mimeType: detectedMimeType || attempt.mimeType,
        }
      }
    }
  }

  return best
}

function createScaledCanvas(image: HTMLImageElement, scale: number): HTMLCanvasElement {
  const width = Math.max(1, Math.round(Math.max(1, image.width) * scale))
  const height = Math.max(1, Math.round(Math.max(1, image.height) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not prepare an image canvas.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  return canvas
}

export async function optimizeBackgroundImageUpload(
  file: File,
  fallback: ThemeBackgroundImageConfig | null,
): Promise<OptimizedBackgroundImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file (PNG, JPG, WEBP, or GIF).')
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image is too large. Keep uploads under 12 MB.')
  }

  const sourceDataUrl = await readFileAsDataUrl(file)
  const sourceImage = await loadImage(sourceDataUrl)

  const sourceEdge = Math.max(sourceImage.width, sourceImage.height)
  let scale = sourceEdge > MAX_BACKGROUND_EDGE ? MAX_BACKGROUND_EDGE / sourceEdge : 1

  let bestResult: OptimizedBackgroundImage | null = null

  for (let pass = 0; pass < 6; pass += 1) {
    const canvas = createScaledCanvas(sourceImage, scale)
    const encoded = encodeCanvas(canvas)

    if (!encoded) {
      throw new Error('Could not encode that image format.')
    }

    const estimate = estimateDataUrlBytes(encoded.dataUrl)
    const nextResult: OptimizedBackgroundImage = {
      config: {
        dataUrl: encoded.dataUrl,
        fit: fallback?.fit ?? 'cover',
        opacity: fallback?.opacity ?? 0.58,
      },
      width: canvas.width,
      height: canvas.height,
      mimeType: encoded.mimeType,
      estimatedBytes: estimate,
    }

    if (!bestResult || nextResult.config.dataUrl.length < bestResult.config.dataUrl.length) {
      bestResult = nextResult
    }

    if (nextResult.config.dataUrl.length <= MAX_BACKGROUND_IMAGE_DATA_URL_LENGTH) {
      return nextResult
    }

    if (Math.min(canvas.width, canvas.height) <= MIN_BACKGROUND_EDGE) {
      break
    }

    scale *= SCALE_STEP
  }

  if (bestResult && bestResult.config.dataUrl.length <= MAX_BACKGROUND_IMAGE_DATA_URL_LENGTH) {
    return bestResult
  }

  throw new Error('Image stayed too large after optimization. Try a smaller file.')
}
