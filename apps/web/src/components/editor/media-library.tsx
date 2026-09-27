import { useState, type DragEvent, type ReactElement } from 'react'

export type MediaLibraryFilters = { readonly query: string; readonly sort: 'project' | 'name' | 'type' | 'duration'; readonly unusedOnly: boolean }
export const DEFAULT_MEDIA_LIBRARY_FILTERS: MediaLibraryFilters = { query: '', sort: 'project', unusedOnly: false }
export type MediaLibraryAsset = {
  readonly id: string
  readonly displayName: string
  readonly kind: 'video' | 'audio' | 'image'
  readonly byteLabel: string
  readonly durationLabel: string
  readonly usageCount: number
  readonly ready: boolean
  readonly failureMessage?: string
}

type Props = {
  readonly mode: 'media' | 'audio'
  readonly hasProject: boolean
  readonly busy: boolean
  readonly availableCount: number
  readonly assets: readonly MediaLibraryAsset[]
  readonly filters: MediaLibraryFilters
  readonly selectedAssetId: string | null
  readonly onFiltersChange: (filters: MediaLibraryFilters) => void
  readonly onImport: (kind?: 'video' | 'audio' | 'image') => void
  readonly onSelect: (assetId: string) => void
  readonly onPlace: () => void
  readonly onRetry?: (assetId: string) => void
  readonly onAssetDragStart?: (event: DragEvent, assetId: string) => void
}

const glyph = { video: '🎬', audio: '🎵', image: '🖼️' }
const sorts: readonly MediaLibraryFilters['sort'][] = ['project', 'name', 'type', 'duration']

/** Display only. The host supplies its own timeline usage and filter result. */
export function MediaLibrary({ mode, hasProject, busy, availableCount, assets, filters, selectedAssetId, onFiltersChange, onImport, onSelect, onPlace, onRetry, onAssetDragStart }: Props): ReactElement {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const selected = assets.find((asset) => asset.id === selectedAssetId)
  const activeFilters = filters.query.trim().length > 0 || filters.sort !== 'project' || filters.unusedOnly
  const audio = mode === 'audio'
  return <section className="asset-bin" aria-labelledby="assets-title" style={{ gap: 'var(--space-2)', padding: 'var(--space-3)' }}>
    <div className="panel-heading asset-bin__header">
      <h2 id="assets-title" className="asset-bin__title">{audio ? 'Audio' : 'Media'}</h2>
      <div className="asset-bin__view-toggle" role="group" aria-label="Media view mode">
        <button className={`asset-bin__view-button${viewMode === 'grid' ? ' asset-bin__view-button--active' : ''}`} type="button" aria-pressed={viewMode === 'grid'} title="Grid view" onClick={() => setViewMode('grid')}>▦</button>
        <button className={`asset-bin__view-button${viewMode === 'list' ? ' asset-bin__view-button--active' : ''}`} type="button" aria-pressed={viewMode === 'list'} title="List view" onClick={() => setViewMode('list')}>☰</button>
      </div>
    </div>
    <div className="asset-bin__find">
      <input type="search" value={filters.query} onChange={(event) => onFiltersChange({ ...filters, query: event.currentTarget.value })} placeholder="Search…" aria-label={audio ? 'Search audio by name' : 'Search media by name'} disabled={!hasProject} />
      <select value={filters.sort} onChange={(event) => onFiltersChange({ ...filters, sort: event.currentTarget.value as MediaLibraryFilters['sort'] })} aria-label="Sort media" disabled={!hasProject}>
        {sorts.map((sort) => <option key={sort} value={sort}>{sort === 'project' ? 'Original' : sort === 'name' ? 'Name A–Z' : sort === 'type' ? 'Type' : 'Longest'}</option>)}
      </select>
    </div>
    <div className="asset-bin__filter-row">
      <label className="asset-bin__unused"><input type="checkbox" checked={filters.unusedOnly} onChange={(event) => onFiltersChange({ ...filters, unusedOnly: event.currentTarget.checked })} disabled={!hasProject} />Unused only</label>
      <button className="button button--ghost asset-bin__reset" type="button" onClick={() => onFiltersChange(DEFAULT_MEDIA_LIBRARY_FILTERS)} disabled={!hasProject || !activeFilters}>Reset</button>
    </div>
    <div className="asset-bin__toolbar">
      {!audio && <button className="button button--ghost asset-bin__toolbar-button" type="button" onClick={() => onImport('video')} disabled={!hasProject || busy}>+ Video</button>}
      <button className="button button--ghost asset-bin__toolbar-button" type="button" onClick={() => onImport('audio')} disabled={!hasProject || busy}>+ Audio</button>
      {!audio && <button className="button button--ghost asset-bin__toolbar-button" type="button" onClick={() => onImport('image')} disabled={!hasProject || busy}>+ Image</button>}
      <button className="button button--primary asset-bin__toolbar-button" type="button" onClick={onPlace} disabled={!selected?.ready}>Place</button>
    </div>
    {!hasProject ? <div className="empty-slate">Create or open a project before importing local media.</div>
      : availableCount === 0 ? <button className="asset-bin__dropzone" type="button" onClick={() => onImport(audio ? 'audio' : undefined)} disabled={busy}><span aria-hidden="true" className="asset-bin__dropzone-icon">⬆</span><strong>{audio ? 'Import audio' : 'Import media'}</strong><span>{audio ? 'Add local audio files to this project.' : 'Local video, audio and images stay on this machine.'}</span></button>
      : assets.length === 0 ? <div className="empty-slate">No {audio ? 'audio' : 'media'} matches the current filters.</div>
      : <div className={`asset-grid ${viewMode === 'grid' ? 'asset-grid--tiles' : 'asset-grid--list'}`} aria-label="Imported project assets">
        {assets.map((asset) => <div key={asset.id} className="asset-tile-entry">
          {viewMode === 'grid' ? <button className={`asset-tile${asset.id === selectedAssetId ? ' asset-tile--selected' : ''}`} draggable={asset.ready && !!onAssetDragStart} type="button" onClick={() => onSelect(asset.id)} onDragStart={(event) => onAssetDragStart?.(event, asset.id)} title={asset.displayName}>
            <span className={`asset-tile__preview asset-tile__preview--${asset.kind}`} aria-hidden="true"><span className="asset-tile__glyph">{glyph[asset.kind]}</span><span className={`asset-tile__kind asset-card__kind asset-card__kind--${asset.kind}`}>{asset.kind}</span><span className="asset-tile__duration">{asset.durationLabel}</span></span>
            <strong className="asset-tile__name">{asset.displayName}</strong><small className="asset-tile__meta">{asset.byteLabel} · {asset.usageCount} on timeline</small>
          </button> : <button className={`asset-row${asset.id === selectedAssetId ? ' asset-row--selected' : ''}`} draggable={asset.ready && !!onAssetDragStart} type="button" onClick={() => onSelect(asset.id)} onDragStart={(event) => onAssetDragStart?.(event, asset.id)} title={asset.displayName}>
            <span className={`asset-row__thumb asset-row__thumb--${asset.kind}`} aria-hidden="true">{glyph[asset.kind]}</span><span className="asset-row__body"><strong className="asset-row__name">{asset.displayName}</strong><small className="asset-row__meta">{asset.kind} · {asset.byteLabel} · {asset.usageCount} on timeline</small></span><span className="asset-row__duration">{asset.durationLabel}</span>
          </button>}
          {asset.id === selectedAssetId && asset.failureMessage !== undefined && onRetry && <button className="button asset-bin__retry" type="button" onClick={() => onRetry(asset.id)}>Retry metadata</button>}
        </div>)}
      </div>}
  </section>
}
