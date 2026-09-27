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

export function timelineEnd(clips: readonly Clip[]): number {
  return Math.max(0, ...clips.map((clip) => clip.start + clip.duration))
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
    return [{ ...clip, duration: leftDuration }, { ...clip, id: rightId, start: time, sourceStart: clip.sourceStart + leftDuration, duration: clip.duration - leftDuration }]
  })
}

export function trimClip(clip: Clip, edge: 'left' | 'right', time: number): Clip {
  if (edge === 'right') return { ...clip, duration: Math.min(clip.duration, Math.max(0.1, time - clip.start)) }
  const nextStart = Math.min(clip.start + clip.duration - 0.1, Math.max(clip.start, time))
  const delta = nextStart - clip.start
  return { ...clip, start: nextStart, sourceStart: clip.sourceStart + delta, duration: clip.duration - delta }
}
