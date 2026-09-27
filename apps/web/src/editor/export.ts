import { activeClipAt, sourceTimeAt, timelineEnd, titlesAt, visualLayersAt, type Asset, type Clip } from './model'

const WIDTH = 1280
const HEIGHT = 720
const FRAME_RATE = 30
const WEBM_WITH_AUDIO = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'] as const
const WEBM_VIDEO_ONLY = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const

export type ExportProgress = (progress: number) => void

export function supportedWebMType(isSupported: (mimeType: string) => boolean, hasAudio = true): string | null {
  return (hasAudio ? WEBM_WITH_AUDIO : WEBM_VIDEO_ONLY).find(isSupported) ?? null
}

export function validateExport(assets: readonly Asset[], clips: readonly Clip[]): string | null {
  if (timelineEnd(clips) <= 0) return 'Place a clip on the timeline before exporting.'
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  if (clips.some((clip) => clip.track !== 'text' && !assetById.has(clip.assetId))) return 'A timeline clip is missing its media file.'
  if (clips.some((clip) => {
    const asset = assetById.get(clip.assetId)
    return asset && asset.kind !== 'image' && clip.sourceStart + clip.duration > asset.duration + 0.05
  })) return 'A clip extends past the end of its source media. Shorten it before exporting.'
  return null
}

function drawContained(context: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number): void {
  if (width <= 0 || height <= 0) return
  const scale = Math.min(WIDTH / width, HEIGHT / height)
  const drawWidth = width * scale
  const drawHeight = height * scale
  context.drawImage(source, (WIDTH - drawWidth) / 2, (HEIGHT - drawHeight) / 2, drawWidth, drawHeight)
}

function drawTitles(context: CanvasRenderingContext2D, clips: readonly Clip[], time: number): void {
  const titles = titlesAt(clips, time)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '700 54px Inter, sans-serif'
  context.fillStyle = '#ffffff'
  context.shadowColor = '#000000'
  context.shadowBlur = 12
  context.shadowOffsetY = 3
  titles.forEach((clip, index) => context.fillText(clip.text ?? '', WIDTH / 2, HEIGHT * 0.45 + index * 64, WIDTH * 0.8))
  context.shadowBlur = 0
  context.shadowOffsetY = 0
}

function loadElement(element: HTMLMediaElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) { resolve(); return }
    const done = (): void => { cleanup(); resolve() }
    const fail = (): void => { cleanup(); reject(new Error(`Could not decode ${element.currentSrc || 'media'}.`)) }
    const abort = (): void => { cleanup(); reject(signal.reason) }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Media loading timed out. Try importing the file again.')) }, 30000)
    const cleanup = (): void => {
      clearTimeout(timeout)
      element.removeEventListener('loadeddata', done)
      element.removeEventListener('error', fail)
      signal.removeEventListener('abort', abort)
    }
    element.addEventListener('loadeddata', done, { once: true })
    element.addEventListener('error', fail, { once: true })
    signal.addEventListener('abort', abort, { once: true })
    element.load()
  })
}

function preseekElement(element: HTMLMediaElement, time: number, signal: AbortSignal): Promise<void> {
  if (time <= 0.01) return Promise.resolve()
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const done = (): void => { cleanup(); resolve() }
    const fail = (): void => { cleanup(); reject(new Error('Could not seek to a trimmed clip start.')) }
    const abort = (): void => { cleanup(); reject(signal.reason) }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Seeking to a trimmed clip start timed out.')) }, 30000)
    const cleanup = (): void => {
      clearTimeout(timeout)
      element.removeEventListener('seeked', done)
      element.removeEventListener('error', fail)
      signal.removeEventListener('abort', abort)
    }
    element.addEventListener('seeked', done, { once: true })
    element.addEventListener('error', fail, { once: true })
    signal.addEventListener('abort', abort, { once: true })
    element.currentTime = time
  })
}

function decodeImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const abort = (): void => { cleanup(); reject(new Error('Export cancelled.')) }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Image loading timed out. Try importing the file again.')) }, 30000)
    const cleanup = (): void => { clearTimeout(timeout); signal.removeEventListener('abort', abort) }
    signal.addEventListener('abort', abort, { once: true })
    void image.decode().then(() => { cleanup(); resolve() }, (error: unknown) => { cleanup(); reject(error) })
  })
}

export async function exportTimeline(options: {
  assets: readonly Asset[]
  clips: readonly Clip[]
  signal: AbortSignal
  onProgress: ExportProgress
}): Promise<Blob> {
  const { assets, clips, signal, onProgress } = options
  const problem = validateExport(assets, clips)
  if (problem) throw new Error(problem)
  if (signal.aborted) throw signal.reason
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error('This browser cannot record the editor canvas. Use a browser with MediaRecorder and canvas capture support.')
  }
  const mediaClips = clips.filter((clip) => clip.track !== 'text' && assets.find((asset) => asset.id === clip.assetId)?.kind !== 'image')
  const mimeType = supportedWebMType((type) => MediaRecorder.isTypeSupported(type), mediaClips.length > 0)
  if (!mimeType) throw new Error('This browser does not support WebM recording.')

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the export canvas.')
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const mediaByClip = new Map<string, HTMLMediaElement>()
  const gainByClip = new Map<string, GainNode>()
  const imageByAsset = new Map<string, HTMLImageElement>()
  let audioContext: AudioContext | null = null
  let stream: MediaStream | null = null
  try {
    // Resume while the export click still has user activation. Media loading can take seconds.
    if (mediaClips.length > 0) {
      audioContext = new AudioContext()
      await audioContext.resume()
    }
    const imageAssets = assets.filter((asset) => asset.kind === 'image' && clips.some((clip) => clip.assetId === asset.id))
    await Promise.all(imageAssets.map(async (asset) => {
      const image = new Image()
      image.src = asset.url
      await decodeImage(image, signal)
      imageByAsset.set(asset.id, image)
    }))
    await Promise.all(mediaClips.map(async (clip) => {
      const asset = assetById.get(clip.assetId)
      if (!asset) return
      const element = document.createElement(asset.kind === 'audio' ? 'audio' : 'video')
      element.preload = 'auto'
      element.src = asset.url
      mediaByClip.set(clip.id, element)
      await loadElement(element, signal)
      await preseekElement(element, clip.sourceStart, signal)
    }))
    if (signal.aborted) throw signal.reason

    stream = canvas.captureStream(FRAME_RATE)
    if (audioContext) {
      const destination = audioContext.createMediaStreamDestination()
      mediaByClip.forEach((element, id) => {
        const gain = audioContext?.createGain()
        if (!gain) return
        gain.gain.value = 0
        audioContext?.createMediaElementSource(element).connect(gain).connect(destination)
        gainByClip.set(id, gain)
      })
      destination.stream.getAudioTracks().forEach((track) => stream?.addTrack(track))
    }

    let activeVisualIds = new Set<string>()
    let activeAudioId: string | null = null
    let recordFailure: Error | null = null
    let stopRecording: (() => void) | null = null
    const syncVisuals = (time: number): void => {
      const layers = visualLayersAt(clips, time)
      const nextIds = new Set(layers.map((layer) => layer.clip.id))
      for (const id of activeVisualIds) if (!nextIds.has(id)) mediaByClip.get(id)?.pause()
      activeVisualIds = nextIds
      for (const layer of layers) {
        const element = mediaByClip.get(layer.clip.id)
        if (!element) continue
        const gain = gainByClip.get(layer.clip.id)
        if (gain) gain.gain.value = layer.audioGain
        const desired = Math.max(0, sourceTimeAt(layer.clip, time))
        if (Math.abs(element.currentTime - desired) > 0.35) element.currentTime = desired
        if (element.paused) void element.play().catch((error: unknown) => {
          if (!activeVisualIds.has(layer.clip.id) || (error instanceof DOMException && error.name === 'AbortError')) return
          recordFailure = error instanceof Error ? error : new Error('Could not play video during export.')
          stopRecording?.()
        })
      }
      for (const [id, gain] of gainByClip) if (!nextIds.has(id) && clips.find((clip) => clip.id === id)?.track === 'video') gain.gain.value = 0
    }
    const syncAudio = (time: number): void => {
      const clip = activeClipAt(clips, 'audio', time)
      const element = clip ? mediaByClip.get(clip.id) : undefined
      if (activeAudioId && activeAudioId !== clip?.id) {
        mediaByClip.get(activeAudioId)?.pause()
        const previousGain = gainByClip.get(activeAudioId)
        if (previousGain) previousGain.gain.value = 0
      }
      activeAudioId = clip?.id ?? null
      if (!clip || !element) return
      const gain = gainByClip.get(clip.id)
      if (gain) gain.gain.value = 1
      const desired = Math.max(0, sourceTimeAt(clip, time))
      if (Math.abs(element.currentTime - desired) > 0.35) element.currentTime = desired
      if (element.paused) void element.play().catch((error: unknown) => {
        if (activeAudioId !== clip.id || (error instanceof DOMException && error.name === 'AbortError')) return
        recordFailure = error instanceof Error ? error : new Error('Could not play media during export.')
        stopRecording?.()
      })
    }
    const drawFrame = (time: number): void => {
      context.fillStyle = '#080a0d'
      context.fillRect(0, 0, WIDTH, HEIGHT)
      for (const layer of visualLayersAt(clips, time)) {
        const asset = assetById.get(layer.clip.assetId)
        context.globalAlpha = layer.opacity
        context.filter = layer.filter
        if (asset?.kind === 'image') {
          const image = imageByAsset.get(asset.id)
          if (image) drawContained(context, image, image.naturalWidth, image.naturalHeight)
        } else if (asset?.kind === 'video') {
          const element = mediaByClip.get(layer.clip.id)
          if (element instanceof HTMLVideoElement && element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            drawContained(context, element, element.videoWidth, element.videoHeight)
          }
        }
      }
      context.globalAlpha = 1
      context.filter = 'none'
      drawTitles(context, clips, time)
    }

    const duration = timelineEnd(clips)
    syncVisuals(0)
    syncAudio(0)
    drawFrame(0)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 })
    const blob = await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []
      let frame = 0
      let finishTimer = 0
      const abort = (): void => { recordFailure = new Error('Export cancelled.'); stopRecording?.() }
      const finish = (): void => { if (recorder.state !== 'inactive') recorder.stop() }
      stopRecording = finish
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
      recorder.onerror = () => { recordFailure = new Error('The browser stopped recording.'); finish() }
      recorder.onstop = () => {
        if (recordFailure || signal.aborted) reject(recordFailure ?? new Error('Export cancelled.'))
        else if (chunks.length === 0) reject(new Error('The browser produced an empty recording.'))
        else resolve(new Blob(chunks, { type: mimeType }))
      }
      signal.addEventListener('abort', abort, { once: true })
      try {
        recorder.start(1000)
        const startedAt = performance.now()
        const tick = (now: number): void => {
          if (recorder.state === 'inactive') return
          try {
            const time = Math.min(duration, (now - startedAt) / 1000)
            syncVisuals(time)
            syncAudio(time)
            drawFrame(time)
            onProgress(Math.min(1, time / duration))
            if (time < duration) frame = requestAnimationFrame(tick)
            else finish()
          } catch (error) {
            recordFailure = error instanceof Error ? error : new Error('Could not render the timeline frame.')
            finish()
          }
        }
        frame = requestAnimationFrame(tick)
        finishTimer = window.setTimeout(() => { finish() }, duration * 1000 + 250)
      } catch (error) { reject(error) }
      recorder.addEventListener('stop', () => {
        cancelAnimationFrame(frame)
        clearTimeout(finishTimer)
        signal.removeEventListener('abort', abort)
      }, { once: true })
    })
    onProgress(1)
    return blob
  } finally {
    mediaByClip.forEach((element) => { element.pause(); element.removeAttribute('src'); element.load() })
    stream?.getTracks().forEach((track) => track.stop())
    if (audioContext) await audioContext.close()
  }
}
