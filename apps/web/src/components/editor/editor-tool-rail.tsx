import type { KeyboardEvent, ReactElement, ReactNode } from 'react'

export const EDITOR_TOOL_IDS = ['project', 'media', 'audio', 'text'] as const
export type EditorToolId = (typeof EDITOR_TOOL_IDS)[number]

const TOOLS: Record<EditorToolId, { label: string; icon: ReactNode }> = {
  project: { label: 'Project', icon: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9h16M8 5V3" /></> },
  media: { label: 'Media', icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 4v16M16 4v16M3 10h5M16 10h5M3 15h5M16 15h5" /></> },
  audio: { label: 'Audio', icon: <><path d="M5 9v6M9 6v12M13 3v18M17 7v10M21 10v4" /></> },
  text: { label: 'Text', icon: <><path d="M4 6V4h16v2M12 4v16M8 20h8" /></> },
}

export function EditorToolRail({ activeTabId, onActiveTabChange }: {
  readonly activeTabId: EditorToolId
  readonly onActiveTabChange: (id: EditorToolId) => void
}): ReactElement {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = EDITOR_TOOL_IDS.indexOf(activeTabId)
    const next = event.key === 'Home' ? EDITOR_TOOL_IDS[0]
      : event.key === 'End' ? EDITOR_TOOL_IDS[EDITOR_TOOL_IDS.length - 1]
      : EDITOR_TOOL_IDS[(index + (event.key === 'ArrowUp' ? -1 : 1) + EDITOR_TOOL_IDS.length) % EDITOR_TOOL_IDS.length]
    if (next === undefined) return
    onActiveTabChange(next)
    document.getElementById(`editor-tool-tab-${next}`)?.focus()
  }

  return <div className="editor-tool-rail" role="tablist" aria-label="Editor tools" aria-orientation="vertical">
    {EDITOR_TOOL_IDS.map((id) => <button
      key={id}
      id={`editor-tool-tab-${id}`}
      className={`editor-tool-tab${activeTabId === id ? ' editor-tool-tab--active' : ''}`}
      type="button"
      role="tab"
      aria-controls="editor-tool-panel"
      aria-selected={activeTabId === id}
      aria-label={TOOLS[id].label}
      title={TOOLS[id].label}
      tabIndex={activeTabId === id ? 0 : -1}
      onClick={() => onActiveTabChange(id)}
      onKeyDown={onKeyDown}
    ><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{TOOLS[id].icon}</svg><span>{TOOLS[id].label}</span></button>)}
  </div>
}
