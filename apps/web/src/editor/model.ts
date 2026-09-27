import type { MediaLibraryFilters } from '../components/editor/media-library'

export type Asset = {
  readonly id: string
  readonly name: string
  readonly kind: 'video' | 'audio' | 'image'
  readonly url: string
  readonly byteLength: number
  readonly duration: number
}

export type Clip = {
  readonly id: string
  readonly assetId: string
  readonly start: number
  readonly sourceStart: number
  readonly duration: number
  readonly track: 'video' | 'audio' | 'text'
  readonly text?: string
  readonly visual?: VisualSettings
}

/** Keep the current frame when it belongs to the selected clip; otherwise reveal its first frame. */
export function playheadForSelectedClip(clip: Clip, playhead: number): number {
  return playhead >= clip.start && playhead < clip.start + clip.duration ? playhead : clip.start
}

export type VisualSettings = {
  readonly brightness: number
  readonly contrast: number
  readonly saturation: number
  readonly opacity: number
  readonly fadeIn: number
  readonly fadeOut: number
}

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  brightness: 100, contrast: 100, saturation: 100, opacity: 100, fadeIn: 0, fadeOut: 0,
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

export function visualSettings(clip: Clip): VisualSettings {
  const settings = clip.visual
  return {
    brightness: clamp(settings?.brightness, 0, 200, 100),
    contrast: clamp(settings?.contrast, 0, 200, 100),
    saturation: clamp(settings?.saturation, 0, 200, 100),
    opacity: clamp(settings?.opacity, 0, 100, 100),
    fadeIn: clamp(settings?.fadeIn, 0, clip.duration, 0),
    fadeOut: clamp(settings?.fadeOut, 0, clip.duration, 0),
  }
}

export function visualFilter(settings: VisualSettings): string {
  return `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)`
}

export type VisualLayer = { readonly clip: Clip; readonly opacity: number; readonly audioGain: number; readonly filter: string }

export function visualLayersAt(clips: readonly Clip[], time: number): VisualLayer[] {
  const layers = clips.filter((clip) => clip.track === 'video' && time >= clip.start && time < clip.start + clip.duration).map((clip) => {
    const settings = visualSettings(clip)
    const elapsed = time - clip.start
    const remaining = clip.start + clip.duration - time
    const fadeIn = settings.fadeIn > 0 ? Math.min(1, elapsed / settings.fadeIn) : 1
    const fadeOut = settings.fadeOut > 0 ? Math.min(1, remaining / settings.fadeOut) : 1
    return { clip, opacity: (settings.opacity / 100) * Math.min(fadeIn, fadeOut), filter: visualFilter(settings) }
  })
  let uncovered = 1
  const audioGains = layers.map(() => 0)
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    audioGains[index] = layers[index].opacity * uncovered
    uncovered *= 1 - layers[index].opacity
  }
  return layers.map((layer, index) => ({ ...layer, audioGain: audioGains[index] }))
}

export function visibleAssets(assets: readonly Asset[], clips: readonly Clip[], filters: MediaLibraryFilters, mode: 'media' | 'audio'): Asset[] {
  const query = filters.query.trim().toLocaleLowerCase()
  const used = new Set(clips.map((clip) => clip.assetId))
  const result = assets.filter((asset) => (mode === 'media' || asset.kind === 'audio') && asset.name.toLocaleLowerCase().includes(query) && (!filters.unusedOnly || !used.has(asset.id)))
  if (filters.sort === 'project') return result
  return result.map((asset, index) => ({ asset, index })).sort((left, right) => {
    const order = filters.sort === 'duration' ? right.asset.duration - left.asset.duration
      : filters.sort === 'type' ? left.asset.kind.localeCompare(right.asset.kind)
      : left.asset.name.localeCompare(right.asset.name)
    return order || left.index - right.index
  }).map(({ asset }) => asset)
}

export function canPlaceOnTrack(kind: Asset['kind'], track: Clip['track']): boolean {
  return kind === 'audio' ? track === 'audio' : track === 'video'
}

export function timelineEnd(clips: readonly Clip[]): number {
  return Math.max(0, ...clips.map((clip) => clip.start + clip.duration))
}

export function activeClipAt(clips: readonly Clip[], track: Clip['track'], time: number): Clip | null {
  return [...clips].reverse().find((clip) => clip.track === track && time >= clip.start && time < clip.start + clip.duration) ?? null
}

export function titlesAt(clips: readonly Clip[], time: number): Clip[] {
  return clips.filter((clip) => clip.track === 'text' && time >= clip.start && time < clip.start + clip.duration)
}

export function sourceTimeAt(clip: Clip, time: number): number {
  return clip.sourceStart + time - clip.start
}

export function editPoints(clips: readonly Clip[]): number[] {
  return [...new Set([0, ...clips.flatMap((clip) => [clip.start, clip.start + clip.duration])])].sort((a, b) => a - b)
}

export function stepToEditPoint(clips: readonly Clip[], time: number, direction: 'previous' | 'next'): number {
  const points = editPoints(clips)
  return direction === 'previous' ? ([...points].reverse().find((point) => point < time - 0.01) ?? 0)
    : (points.find((point) => point > time + 0.01) ?? timelineEnd(clips))
}

export function splitClip(clips: readonly Clip[], id: string, time: number, rightId: string): Clip[] {
  return clips.flatMap((clip) => {
    if (clip.id !== id || time <= clip.start || time >= clip.start + clip.duration) return [clip]
    const leftDuration = time - clip.start
    const settings = clip.visual ? visualSettings(clip) : null
    return [
      { ...clip, duration: leftDuration, ...(settings ? { visual: { ...settings, fadeOut: 0 } } : {}) },
      { ...clip, id: rightId, start: time, sourceStart: clip.sourceStart + leftDuration, duration: clip.duration - leftDuration, ...(settings ? { visual: { ...settings, fadeIn: 0 } } : {}) },
    ]
  })
}

export function trimClip(clip: Clip, edge: 'left' | 'right', time: number): Clip {
  if (edge === 'right') {
    if (time <= clip.start || time >= clip.start + clip.duration) return clip
    const removed = clip.start + clip.duration - time
    const settings = clip.visual ? visualSettings(clip) : null
    return { ...clip, duration: Math.max(0.1, time - clip.start), ...(settings ? { visual: { ...settings, fadeOut: Math.max(0, settings.fadeOut - removed) } } : {}) }
  }
  const nextStart = Math.min(clip.start + clip.duration - 0.1, Math.max(clip.start, time))
  const delta = nextStart - clip.start
  const settings = clip.visual ? visualSettings(clip) : null
  return { ...clip, start: nextStart, sourceStart: clip.sourceStart + delta, duration: clip.duration - delta, ...(settings ? { visual: { ...settings, fadeIn: Math.max(0, settings.fadeIn - delta) } } : {}) }
}
