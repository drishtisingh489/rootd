/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Barcode Detection API (Chromium / Android). Optional: used only when the browser provides it.
interface DetectedBarcode {
  rawValue: string
  format: string
}
interface BarcodeDetectorInstance {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>
}
interface Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorInstance
}
