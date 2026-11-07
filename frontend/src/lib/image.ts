/** Client-side image helpers. Photos are re-encoded to JPEG so any phone format the browser can display works. */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("That file couldn't be read as an image. Try a JPG or PNG photo."))
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', quality),
  )
}

export interface PreparedPhoto {
  blob: Blob
  dataUrl: string
}

function draw(source: CanvasImageSource, width: number, height: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not supported in this browser.')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export async function prepareFile(file: Blob, maxSide = 1600): Promise<PreparedPhoto> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = draw(img, img.naturalWidth, img.naturalHeight, maxSide)
    return { blob: await canvasToBlob(canvas, 0.88), dataUrl: canvas.toDataURL('image/jpeg', 0.8) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function captureVideoFrame(video: HTMLVideoElement, maxSide = 1600): Promise<PreparedPhoto> {
  if (!video.videoWidth) throw new Error('The camera is not ready yet.')
  const canvas = draw(video, video.videoWidth, video.videoHeight, maxSide)
  return { blob: await canvasToBlob(canvas, 0.88), dataUrl: canvas.toDataURL('image/jpeg', 0.8) }
}

/** Square, small JPEG data URL for profile pictures (kept well under the backend's size limit). */
export async function avatarDataUrl(file: Blob, size = 256): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is not supported in this browser.')
    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    )
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Uses the browser's Barcode Detection API when available (e.g. Chrome on Android/macOS).
 * Some implementations never settle, so this gives up after `timeoutMs` and photo identification takes over.
 */
export async function detectBarcode(blob: Blob, timeoutMs = 2000): Promise<string | null> {
  const Detector = window.BarcodeDetector
  if (!Detector) return null
  const attempt = (async () => {
    const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    const bitmap = await createImageBitmap(blob)
    try {
      const codes = await detector.detect(bitmap)
      return codes.map((c) => c.rawValue.replace(/\D/g, '')).find((c) => c.length >= 8 && c.length <= 14) ?? null
    } finally {
      bitmap.close()
    }
  })().catch(() => null)
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
  return Promise.race([attempt, timeout])
}
