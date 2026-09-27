// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportTimeline } from './export'
import type { Asset, Clip } from './model'

const image: Asset = { id: 'still', name: 'still.png', kind: 'image', url: 'blob:still', byteLength: 10, duration: 0.08 }
const clip: Clip = { id: 'still-clip', assetId: image.id, track: 'video', start: 0, sourceStart: 0, duration: 0.08 }
const title: Clip = { id: 'title', assetId: '', track: 'text', start: 0, sourceStart: 0, duration: 0.08, text: 'Opening' }

afterEach(() => vi.restoreAllMocks())

describe('browser export', () => {
  it('records a local WebM containing the active still and title', async () => {
    const drawImage = vi.fn()
    const fillText = vi.fn()
    const stopTrack = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage, fillText } as unknown as CanvasRenderingContext2D)
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: () => ({ getTracks: () => [{ stop: stopTrack }] }) })
    Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: () => Promise.resolve() })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, value: 100 })
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, value: 100 })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))

    class Recorder {
      static isTypeSupported = (type: string): boolean => type === 'video/webm'
      state: RecordingState = 'inactive'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(_stream: unknown, _options: unknown) {}
      start(): void { this.state = 'recording' }
      stop(): void {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['webm']) })
        this.onstop?.()
        this.stopListeners.forEach((listener) => listener())
      }
      private stopListeners: Array<() => void> = []
      addEventListener(_event: string, listener: () => void): void { this.stopListeners.push(listener) }
    }
    vi.stubGlobal('MediaRecorder', Recorder)

    const onProgress = vi.fn()
    const blob = await exportTimeline({ assets: [image], clips: [clip, title], signal: new AbortController().signal, onProgress })
    expect(blob.type).toBe('video/webm')
    expect(await blob.text()).toBe('webm')
    expect(drawImage).toHaveBeenCalled()
    expect(fillText).toHaveBeenCalledWith('Opening', 640, 324, 1024)
    expect(onProgress).toHaveBeenLastCalledWith(1)
    expect(stopTrack).toHaveBeenCalledOnce()
  })
})
