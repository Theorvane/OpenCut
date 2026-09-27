import type { ReactElement } from 'react'

/** The host owns edit-point calculation; this shared control only requests a step. */
export function EditPointNavigation({ disabled, onPrevious, onNext }: {
  readonly disabled: boolean
  readonly onPrevious: () => void
  readonly onNext: () => void
}): ReactElement {
  return <div className="edit-point-navigation" role="group" aria-label="Edit point navigation">
    <button type="button" className="edit-point-navigation__button" onClick={onPrevious} disabled={disabled} aria-label="Previous edit point" title="Previous edit point"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 5v14M18 6l-9 6 9 6z" /></svg></button>
    <button type="button" className="edit-point-navigation__button" onClick={onNext} disabled={disabled} aria-label="Next edit point" title="Next edit point"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 5v14M6 6l9 6-9 6z" /></svg></button>
  </div>
}
