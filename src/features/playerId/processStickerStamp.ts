function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load sticker image.'))
    image.src = src
  })
}

export async function processStickerStamp(sourceDataUrl: string): Promise<string> {
  if (typeof document === 'undefined' || !sourceDataUrl.trim()) {
    return ''
  }

  try {
    const image = await loadImage(sourceDataUrl.trim())
    const stampSize = 512
    const canvas = document.createElement('canvas')
    canvas.width = stampSize
    canvas.height = stampSize
    const context = canvas.getContext('2d')
    if (!context) {
      return ''
    }

    context.drawImage(image, 0, 0, stampSize, stampSize)
    const imageData = context.getImageData(0, 0, stampSize, stampSize)
    const { data } = imageData
    const outputData = new Uint8ClampedArray(stampSize * stampSize * 4)

    for (let y = 1; y < stampSize - 1; y += 1) {
      for (let x = 1; x < stampSize - 1; x += 1) {
        const idx = (y * stampSize + x) * 4
        const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b
        const getL = (px: number, py: number) => {
          const i = (py * stampSize + px) * 4
          return lum(data[i]!, data[i + 1]!, data[i + 2]!)
        }

        const gx =
          -1 * getL(x - 1, y - 1) + 1 * getL(x + 1, y - 1)
          + -2 * getL(x - 1, y) + 2 * getL(x + 1, y)
          + -1 * getL(x - 1, y + 1) + 1 * getL(x + 1, y + 1)

        const gy =
          -1 * getL(x - 1, y - 1) - 2 * getL(x, y - 1) - 1 * getL(x + 1, y - 1)
          + 1 * getL(x - 1, y + 1) + 2 * getL(x, y + 1) + 1 * getL(x + 1, y + 1)

        const magnitude = Math.sqrt(gx * gx + gy * gy)
        const alpha = data[idx + 3] ?? 255
        const isEdge = magnitude > 30
        const outAlpha = isEdge ? 255 : 0

        outputData[idx] = 255
        outputData[idx + 1] = 255
        outputData[idx + 2] = 255
        outputData[idx + 3] = outAlpha * (alpha / 255)
      }
    }

    const outputImageData = new ImageData(outputData, stampSize, stampSize)
    context.clearRect(0, 0, stampSize, stampSize)
    context.putImageData(outputImageData, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}
