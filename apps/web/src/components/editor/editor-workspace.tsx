import type { CSSProperties, ReactElement, ReactNode } from 'react'

type EditorWorkspaceProps = {
  readonly mode: 'web' | 'host'
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
  mode, className, style, labelledBy, header, auxiliary, left, leftSplitter,
  program, programSplitter, inspector, inspectorSplitter, floatingPanels, timeline
}: EditorWorkspaceProps): ReactElement {
  if (mode === 'web') {
    return <main className={`oc-editor${className ? ` ${className}` : ''}`} style={style} aria-labelledby={labelledBy}>
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
    {header}
    {left}
    {leftSplitter}
    {auxiliary}
    {program}
    {programSplitter}
    {inspector}
    {inspectorSplitter}
    {floatingPanels}
    {timeline}
  </section>
}
