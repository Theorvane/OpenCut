import type { CSSProperties, ReactElement, ReactNode } from 'react'
import './editor-workspace-host.css'

type EditorWorkspaceProps = {
  readonly mode: 'web' | 'host'
  readonly theme?: 'light' | 'dark'
  readonly preset?: string
  readonly className?: string
  readonly style?: CSSProperties
  readonly labelledBy?: string
  readonly header?: ReactNode
  readonly auxiliary?: ReactNode
  readonly left: ReactNode
  readonly leftSplitter?: ReactNode
  readonly program: ReactNode
  readonly programSplitter?: ReactNode
  readonly inspector: ReactNode
  readonly inspectorSplitter?: ReactNode
  readonly floatingPanels?: ReactNode
  readonly timeline: ReactNode
}

/**
 * OpenCut owns the editor surface; the host owns its project and editing rules.
 * Slots let desktop hosts supply richer panels without copying web-only state,
 * local file URLs, or export logic into those hosts.
 */
export function EditorWorkspace({
  mode, theme, preset, className, style, labelledBy, header, auxiliary, left, leftSplitter,
  program, programSplitter, inspector, inspectorSplitter, floatingPanels, timeline
}: EditorWorkspaceProps): ReactElement {
  if (mode === 'web') {
    return <main className={`oc-editor${className ? ` ${className}` : ''}`} data-theme={theme} data-preset={preset} style={style} aria-labelledby={labelledBy}>
      {header}
      {auxiliary}
      <div className="oc-editor__main">
        <aside className="oc-editor__left">{left}</aside>
        <section className="oc-editor__preview" aria-label="Program monitor">{program}</section>
        <aside className="oc-editor__inspector">{inspector}</aside>
      </div>
      <section className="oc-editor__timeline" aria-label="Timeline">{timeline}</section>
    </main>
  }

  return <section className={`oc-editor-host${className ? ` ${className}` : ''}`} style={style} aria-labelledby={labelledBy}>
    <header className="oc-editor-host__header">{header}</header>
    <aside className="oc-editor-host__left" aria-label="Editor tools">{left}</aside>
    {leftSplitter}
    {auxiliary}
    <div className="oc-editor-host__program">{program}</div>
    {programSplitter}
    <aside className="oc-editor-host__inspector" aria-label="Inspector">{inspector}</aside>
    {inspectorSplitter}
    {floatingPanels}
    <section className="oc-editor-host__timeline" aria-label="Timeline">{timeline}</section>
  </section>
}
