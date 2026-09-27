// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportTimeline } from './export'
import type { Asset, Clip } from './model'

const image: Asset = { id: 'still', name: 'still.png', kind: 'image', url: 'blob:still', byteLength: 10, duration: 0.08 }
const clip: Clip = { id: 'still-clip', assetId: image.id, track: 'video', start: 0, sourceStart: 0, duration: 0.08 }
const title: Clip = { id: 'title', assetId: '', track: 'text', start: 0, sourceStart: 0, duration: 0.08, text: 'Opening' }

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

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

  it('seeks trimmed video and audio clips and includes their mixed sound track', async () => {
    const drawImage = vi.fn()
    const addTrack = vi.fn()
    const close = vi.fn().mockResolvedValue(undefined)
    const play = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage, fillText: vi.fn() } as unknown as CanvasRenderingContext2D)
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { configurable: true, value: () => ({ addTrack, getTracks: () => [{ stop: vi.fn() }] }) })
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, value: 3 })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1920 })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 1080 })
    const sourceTimes = new WeakMap<HTMLMediaElement, number>()
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() { return sourceTimes.get(this as HTMLMediaElement) ?? 0 },
      set(value: number) { sourceTimes.set(this as HTMLMediaElement, value); queueMicrotask(() => this.dispatchEvent(new Event('seeked'))) },
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
    const connect = vi.fn()
    class AudioContextMock {
      resume = vi.fn().mockResolvedValue(undefined)
      close = close
      createMediaStreamDestination = () => ({ stream: { getAudioTracks: () => ['mixed-audio'] } })
      createMediaElementSource = () => ({ connect })
    }
    vi.stubGlobal('AudioContext', AudioContextMock)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16))
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    class Recorder {
      static isTypeSupported = (type: string): boolean => type === 'video/webm;codecs=vp8,opus'
      state: RecordingState = 'inactive'
      ondataavailable: ((event: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      private stopListeners: Array<() => void> = []
      constructor(_stream: unknown, _options: unknown) {}
      start(): void { this.state = 'recording' }
      stop(): void {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['webm']) })
        this.onstop?.()
        this.stopListeners.forEach((listener) => listener())
      }
      addEventListener(_event: string, listener: () => void): void { this.stopListeners.push(listener) }
    }
    vi.stubGlobal('MediaRecorder', Recorder)

    const video: Asset = { id: 'video', name: 'clip.mp4', kind: 'video', url: 'blob:video', byteLength: 20, duration: 0.12 }
    const audio: Asset = { id: 'audio', name: 'voice.wav', kind: 'audio', url: 'blob:audio', byteLength: 20, duration: 0.12 }
    const videoClip: Clip = { id: 'video-clip', assetId: video.id, track: 'video', start: 0, sourceStart: 0.02, duration: 0.08 }
    const audioClip: Clip = { id: 'audio-clip', assetId: audio.id, track: 'audio', start: 0, sourceStart: 0.02, duration: 0.08 }
    const blob = await exportTimeline({ assets: [video, audio], clips: [videoClip, audioClip], signal: new AbortController().signal, onProgress: vi.fn() })
    expect(blob.type).toBe('video/webm;codecs=vp8,opus')
    expect(addTrack).toHaveBeenCalledWith('mixed-audio')
    expect(connect).toHaveBeenCalledTimes(2)
    expect(play).toHaveBeenCalled()
    expect(drawImage).toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })
})
