import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactElement } from 'react'
import { EditorToolRail, type EditorToolId } from '../components/editor/editor-tool-rail'
import { MediaLibrary, DEFAULT_MEDIA_LIBRARY_FILTERS, type MediaLibraryFilters } from '../components/editor/media-library'
import { EditPointNavigation } from '../components/editor/edit-point-navigation'
import { editPoints, splitClip, stepToEditPoint, timelineEnd, trimClip, visibleAssets, type Asset, type Clip } from '../editor/model'
import '../editor/editor.css'

export const Route = createFileRoute('/editor')({ component: Editor })
const newId = (): string => crypto.randomUUID()
const formatTime = (seconds: number): string => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
const bytes = (size: number): string => size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

async function readFile(file: File): Promise<Asset> {
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image'
  const url = URL.createObjectURL(file)
  let duration = kind === 'image' ? 5 : 5
  if (kind !== 'image') {
    const media = document.createElement(kind)
    media.preload = 'metadata'
    media.src = url
    duration = await new Promise<number>((resolve) => {
      media.onloadedmetadata = () => resolve(Number.isFinite(media.duration) ? media.duration : 5)
      media.onerror = () => resolve(5)
    })
    media.removeAttribute('src')
    media.load()
  }
  return { id: newId(), name: file.name, kind, url, byteLength: file.size, duration }
}

function Editor(): ReactElement {
  const [assets, setAssets] = useState<Asset[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [activeTab, setActiveTab] = useState<EditorToolId>('media')
  const [mediaFilters, setMediaFilters] = useState<MediaLibraryFilters>(DEFAULT_MEDIA_LIBRARY_FILTERS)
  const [audioFilters, setAudioFilters] = useState<MediaLibraryFilters>(DEFAULT_MEDIA_LIBRARY_FILTERS)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [snapping, setSnapping] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const importKind = useRef<'video' | 'audio' | 'image' | undefined>(undefined)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const clockRef = useRef({ time: 0, at: 0 })
  const objectUrls = useRef<string[]>([])
  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  const end = timelineEnd(clips)
  const duration = Math.max(10, Math.ceil(end + 2))
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null
  const currentVideo = [...clips].reverse().find((clip) => clip.track === 'video' && playhead >= clip.start && playhead < clip.start + clip.duration) ?? null
  const currentAudio = [...clips].reverse().find((clip) => clip.track === 'audio' && playhead >= clip.start && playhead < clip.start + clip.duration) ?? null
  const videoAsset = assets.find((asset) => asset.id === currentVideo?.assetId)
  const audioAsset = assets.find((asset) => asset.id === currentAudio?.assetId)
  const filteredAssets = useMemo(() => visibleAssets(assets, clips, activeTab === 'audio' ? audioFilters : mediaFilters, activeTab === 'audio' ? 'audio' : 'media'), [assets, clips, activeTab, audioFilters, mediaFilters])
  const filters = activeTab === 'audio' ? audioFilters : mediaFilters
  const setFilters = activeTab === 'audio' ? setAudioFilters : setMediaFilters
  const mediaItems = filteredAssets.map((asset) => ({ id: asset.id, displayName: asset.name, kind: asset.kind, byteLabel: bytes(asset.byteLength), durationLabel: asset.kind === 'image' ? 'Still image' : formatTime(asset.duration), usageCount: clips.filter((clip) => clip.assetId === asset.id).length, ready: true }))

  const importFiles = (kind?: 'video' | 'audio' | 'image'): void => {
    importKind.current = kind
    if (fileInput.current) fileInput.current.accept = kind ? `${kind}/*` : 'video/*,audio/*,image/*'
    fileInput.current?.click()
  }
  const onFiles = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const loaded = await Promise.all(files.map(readFile))
    objectUrls.current.push(...loaded.map((asset) => asset.url))
    setAssets((current) => [...current, ...loaded])
    if (loaded[0]) setSelectedAssetId(loaded[0].id)
  }
  const placeAsset = (assetId: string, at = playhead, targetTrack?: Clip['track']): void => {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset) return
    const track = targetTrack ?? (asset.kind === 'audio' ? 'audio' : 'video')
    if (track === 'audio' && asset.kind !== 'audio') return
    if (track === 'video' && asset.kind === 'audio') return
    const clip: Clip = { id: newId(), assetId, start: Math.max(0, at), sourceStart: 0, duration: asset.duration, track }
    setClips((current) => [...current, clip])
    setSelectedClipId(clip.id)
  }
  const seek = (time: number): void => {
    const next = Math.max(0, Math.min(duration, time))
    clockRef.current = { time: next, at: performance.now() }
    setPlayhead(next)
  }
  useEffect(() => {
    if (!playing) return
    clockRef.current = { time: playhead, at: performance.now() }
    let frame = 0
    const tick = (now: number): void => {
      const next = clockRef.current.time + (now - clockRef.current.at) / 1000
      if (next >= end) { setPlayhead(end); setPlaying(false); return }
      setPlayhead(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  // Only restart the clock when playback is toggled; seek() resets its anchor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, end])
  useEffect(() => {
    const video = videoRef.current
    if (!video || !currentVideo || videoAsset?.kind !== 'video') return
    const desired = currentVideo.sourceStart + playhead - currentVideo.start
    if (Math.abs(video.currentTime - desired) > 0.3) video.currentTime = desired
    if (playing) void video.play().catch(() => setPlaying(false))
    else video.pause()
  }, [playhead, playing, currentVideo, videoAsset])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentAudio) return
    const desired = currentAudio.sourceStart + playhead - currentAudio.start
    if (Math.abs(audio.currentTime - desired) > 0.3) audio.currentTime = desired
    if (playing) void audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }, [playhead, playing, currentAudio])

  const changeClip = (patch: Partial<Clip>): void => {
    if (!selectedClipId) return
    setClips((current) => current.map((clip) => clip.id === selectedClipId ? { ...clip, ...patch } : clip))
  }
  const split = (): void => {
    if (!selectedClipId) return
    setClips((current) => splitClip(current, selectedClipId, playhead, newId()))
  }
  const remove = (): void => {
    if (!selectedClipId) return
    setClips((current) => current.filter((clip) => clip.id !== selectedClipId))
    setSelectedClipId(null)
  }
  const addText = (): void => {
    const clip: Clip = { id: newId(), assetId: '', track: 'text', start: playhead, sourceStart: 0, duration: 5, text: 'Text' }
    setClips((current) => [...current, clip])
    setSelectedClipId(clip.id)
  }
  const onTrackDrop = (event: DragEvent, track: Clip['track']): void => {
    event.preventDefault()
    const assetId = event.dataTransfer.getData('text/plain')
    const clipId = event.dataTransfer.getData('application/x-opencut-clip')
    const rect = event.currentTarget.getBoundingClientRect()
    const rawTime = Math.max(0, (event.clientX - rect.left) / (36 * zoom))
    const nearby = editPoints(clips).find((point) => Math.abs(point - rawTime) < 0.2 / zoom)
    const at = snapping && nearby !== undefined ? nearby : rawTime
    if (clipId) setClips((current) => current.map((clip) => clip.id === clipId && (track === 'text' ? clip.track === 'text' : clip.track !== 'text') ? { ...clip, track, start: at } : clip))
    else if (assetId) placeAsset(assetId, at, track)
  }

  return <main className="oc-editor">
    <header className="oc-editor__header"><strong>OpenCut</strong><span>Untitled project</span><span className="oc-editor__header-spacer" /><span>Local browser editor</span></header>
    <input ref={fileInput} type="file" multiple hidden accept={importKind.current === 'video' ? 'video/*' : importKind.current === 'audio' ? 'audio/*' : importKind.current === 'image' ? 'image/*' : 'video/*,audio/*,image/*'} onChange={(event) => { void onFiles(event) }} />
    <div className="oc-editor__main">
      <aside className="oc-editor__left"><EditorToolRail activeTabId={activeTab} onActiveTabChange={setActiveTab} /><div className="editor-tool-panel" id="editor-tool-panel" role="tabpanel" aria-labelledby={`editor-tool-tab-${activeTab}`}>
        {activeTab === 'media' || activeTab === 'audio' ? <MediaLibrary mode={activeTab} hasProject busy={false} availableCount={activeTab === 'audio' ? assets.filter((asset) => asset.kind === 'audio').length : assets.length} assets={mediaItems} filters={filters} selectedAssetId={selectedAssetId} onFiltersChange={setFilters} onImport={importFiles} onSelect={setSelectedAssetId} onPlace={() => selectedAssetId && placeAsset(selectedAssetId)} onAssetDragStart={(event, assetId) => { event.dataTransfer.setData('text/plain', assetId); event.dataTransfer.effectAllowed = 'copy' }} />
          : activeTab === 'text' ? <div className="oc-editor__pane"><h2>Text</h2><button type="button" onClick={addText}>+ Add text at playhead</button></div>
          : <div className="oc-editor__pane"><h2>Project</h2><p>Media: {assets.length}</p><p>Timeline clips: {clips.length}</p><button type="button" onClick={() => importFiles()}>Import media</button></div>}
      </div></aside>
      <section className="oc-editor__preview" aria-label="Program monitor"><div className="oc-editor__stage">
        {currentVideo?.track === 'text' ? null : videoAsset?.kind === 'video' ? <video ref={videoRef} key={currentVideo?.id} src={videoAsset.url} playsInline /> : videoAsset?.kind === 'image' ? <img src={videoAsset.url} alt="Timeline still" /> : <div className="oc-editor__stage-empty">Import media, then place it on the timeline</div>}
        {audioAsset && <audio ref={audioRef} key={currentAudio?.id} src={audioAsset.url} />}
        {clips.filter((clip) => clip.track === 'text' && playhead >= clip.start && playhead < clip.start + clip.duration).map((clip) => <div className="oc-editor__title" key={clip.id}>{clip.text}</div>)}
      </div><div className="oc-editor__transport"><button type="button" onClick={() => { if (playhead >= end) seek(0); setPlaying((value) => !value) }} disabled={clips.length === 0}>{playing ? 'Pause' : 'Play'}</button><span>{formatTime(playhead)} / {formatTime(end)}</span></div></section>
      <aside className="oc-editor__inspector"><h2>Inspector</h2>{selectedClip ? <><label>Start <input type="number" min="0" step="0.1" value={selectedClip.start.toFixed(1)} onChange={(event) => changeClip({ start: Math.max(0, Number(event.target.value)) })} /></label><label>Duration <input type="number" min="0.1" step="0.1" value={selectedClip.duration.toFixed(1)} onChange={(event) => changeClip({ duration: Math.max(0.1, Number(event.target.value)) })} /></label>{selectedClip.track === 'text' && <label>Text <input value={selectedClip.text ?? ''} onChange={(event) => changeClip({ text: event.target.value })} /></label>}<button type="button" onClick={() => setClips((current) => current.map((clip) => clip.id === selectedClip.id ? trimClip(clip, 'left', playhead) : clip))}>Trim left to playhead</button><button type="button" onClick={() => setClips((current) => current.map((clip) => clip.id === selectedClip.id ? trimClip(clip, 'right', playhead) : clip))}>Trim right to playhead</button></> : selectedAsset ? <><strong>{selectedAsset.name}</strong><span>{selectedAsset.kind} · {bytes(selectedAsset.byteLength)}</span><span>{formatTime(selectedAsset.duration)}</span></> : <p>Select a clip or media item.</p>}</aside>
    </div>
    <section className="oc-editor__timeline" aria-label="Timeline"><div className="oc-editor__timeline-toolbar"><button type="button" onClick={split} disabled={!selectedClip || playhead <= selectedClip.start || playhead >= selectedClip.start + selectedClip.duration}>Split</button><button type="button" onClick={remove} disabled={!selectedClip}>Delete</button><EditPointNavigation disabled={clips.length === 0} onPrevious={() => seek(stepToEditPoint(clips, playhead, 'previous'))} onNext={() => seek(stepToEditPoint(clips, playhead, 'next'))} /><button type="button" aria-pressed={snapping} title="Snap to edit points" onClick={() => setSnapping((value) => !value)}>{snapping ? 'Snap on' : 'Snap off'}</button><span className="oc-editor__toolbar-spacer" /><button type="button" onClick={() => setZoom((value) => Math.max(0.5, value / 1.25))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(5, value * 1.25))}>+</button></div><div className="oc-editor__timeline-scroll"><div className="oc-editor__track-labels"><div>Time</div><div>Text</div><div>Video</div><div>Audio</div></div><div className="oc-editor__timeline-content" style={{ width: `${duration * 36 * zoom}px` }}><div className="oc-editor__ruler" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); seek((event.clientX - rect.left) / (36 * zoom)) }}>{Array.from({ length: Math.ceil(duration / 5) + 1 }, (_, i) => <span key={i} style={{ left: `${i * 5 * 36 * zoom}px` }}>{i * 5}s</span>)}</div>{(['text', 'video', 'audio'] as const).map((track) => <div key={track} className="oc-editor__track" onDragOver={(event) => event.preventDefault()} onDrop={(event) => onTrackDrop(event, track)}>{clips.filter((clip) => clip.track === track).map((clip) => <button key={clip.id} type="button" draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-opencut-clip', clip.id); event.dataTransfer.effectAllowed = 'move' }} className={`oc-editor__clip oc-editor__clip--${track}${selectedClipId === clip.id ? ' oc-editor__clip--selected' : ''}`} style={{ left: `${clip.start * 36 * zoom}px`, width: `${Math.max(clip.duration * 36 * zoom, 28)}px` }} onClick={() => { setSelectedClipId(clip.id); seek(clip.start) }} title={`${clip.text ?? assets.find((asset) => asset.id === clip.assetId)?.name ?? 'Clip'} · ${formatTime(clip.duration)}`}>{clip.text ?? assets.find((asset) => asset.id === clip.assetId)?.name ?? 'Clip'}</button>)}</div>)}<div className="oc-editor__playhead" style={{ left: `${playhead * 36 * zoom}px` }} />{editPoints(clips).map((point) => <div key={point} className="oc-editor__edit-mark" style={{ left: `${point * 36 * zoom}px` }} />)}</div></div></section>
  </main>
}
