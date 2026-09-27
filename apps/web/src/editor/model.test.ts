import { describe, expect, it } from 'vitest'
import { activeClipAt, canPlaceOnTrack, sourceTimeAt, splitClip, stepToEditPoint, timelineEnd, titlesAt, trimClip, visibleAssets, type Asset, type Clip } from './model'
import { supportedWebMType, validateExport } from './export'

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
    expect(trimClip(clip, 'right', 1)).toEqual(clip)
    expect(trimClip(clip, 'right', 5)).toEqual({ ...clip, duration: 3 })
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
  it('uses the same topmost visual and audio clip for preview and export', () => {
    const upper = { ...clip, id: 'upper', start: 4, sourceStart: 3, duration: 3 }
    const voice: Clip = { id: 'voice', assetId: 'a', track: 'audio', start: 5, sourceStart: 2, duration: 4 }
    const title: Clip = { id: 'title', assetId: '', track: 'text', start: 4, sourceStart: 0, duration: 2, text: 'Hello' }
    const clips = [clip, voice, upper, title]
    expect(activeClipAt(clips, 'video', 5)).toEqual(upper)
    expect(activeClipAt(clips, 'audio', 5)).toEqual(voice)
    expect(sourceTimeAt(upper, 5)).toBe(4)
    expect(sourceTimeAt(voice, 5)).toBe(2)
    expect(titlesAt(clips, 5)).toEqual([title])
    expect(activeClipAt(clips, 'video', 7)).toEqual(clip)
    expect(timelineEnd(clips)).toBe(10)
  })
  it('rejects a missing media asset and an empty timeline before recording', () => {
    expect(validateExport([video], [])).toMatch(/Place a clip/)
    expect(validateExport([video], [clip, { ...clip, id: 'voice', assetId: 'a', track: 'audio' }])).toMatch(/missing/)
    expect(validateExport([video], [{ ...clip, duration: 12 }])).toMatch(/past the end/)
    expect(validateExport([video, audio], [clip])).toBeNull()
  })
  it('chooses a supported WebM format or reports no recording support', () => {
    expect(supportedWebMType((type) => type === 'video/webm;codecs=vp8,opus')).toBe('video/webm;codecs=vp8,opus')
    expect(supportedWebMType((type) => type === 'video/webm;codecs=vp8', false)).toBe('video/webm;codecs=vp8')
    expect(supportedWebMType(() => false)).toBeNull()
  })
})
