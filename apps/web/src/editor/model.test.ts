import { describe, expect, it } from 'vitest'
import { canPlaceOnTrack, splitClip, stepToEditPoint, trimClip, visibleAssets, type Asset, type Clip } from './model'

const video: Asset = { id: 'v', name: 'Scene A.mp4', kind: 'video', url: '', byteLength: 100, duration: 12 }
const audio: Asset = { id: 'a', name: 'Voice.mp3', kind: 'audio', url: '', byteLength: 20, duration: 6 }
const clip: Clip = { id: 'c', assetId: 'v', track: 'video', start: 2, sourceStart: 1, duration: 8 }

describe('editor model', () => {
  it('splits a clip without changing its source span', () => {
    expect(splitClip([clip], 'c', 5, 'right')).toEqual([
      { ...clip, duration: 3 },
      { ...clip, id: 'right', start: 5, sourceStart: 4, duration: 5 },
    ])
  })
  it('trims from the left while keeping the source time aligned', () => {
    expect(trimClip(clip, 'left', 4)).toEqual({ ...clip, start: 4, sourceStart: 3, duration: 6 })
  })
  it('never extends a clip or moves the source before zero while trimming', () => {
    expect(trimClip(clip, 'left', 0)).toEqual(clip)
    expect(trimClip(clip, 'right', 50)).toEqual(clip)
  })
  it('navigates across starts and ends of overlapping clips', () => {
    const overlapping = { ...clip, id: 'b', start: 4, duration: 3 }
    expect(stepToEditPoint([clip, overlapping], 4, 'next')).toBe(7)
    expect(stepToEditPoint([clip, overlapping], 7, 'previous')).toBe(4)
  })
  it('rejects media on incompatible tracks', () => {
    expect(canPlaceOnTrack('image', 'audio')).toBe(false)
    expect(canPlaceOnTrack('video', 'video')).toBe(true)
    expect(canPlaceOnTrack('audio', 'audio')).toBe(true)
  })
  it('filters unused audio while retaining project order', () => {
    expect(visibleAssets([video, audio], [clip], { query: '', sort: 'project', unusedOnly: true }, 'media')).toEqual([audio])
    expect(visibleAssets([video, audio], [clip], { query: '', sort: 'project', unusedOnly: false }, 'audio')).toEqual([audio])
  })
})
