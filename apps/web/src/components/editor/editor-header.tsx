import type { ReactElement, ReactNode } from 'react'

export type EditorThemeOption = { readonly id: string; readonly label: string }

type EditorHeaderProps = {
  readonly brand: string
  readonly projectName: string
  readonly themeMode: 'light' | 'dark'
  readonly themePreset: string
  readonly themeOptions: readonly EditorThemeOption[]
  readonly onThemeModeToggle: () => void
  readonly onThemePresetChange: (presetId: string) => void
  readonly actions?: ReactNode
}

/** Presentation only: the host supplies project identity, theme state and actions. */
export function EditorHeader({ brand, projectName, themeMode, themePreset, themeOptions, onThemeModeToggle, onThemePresetChange, actions }: EditorHeaderProps): ReactElement {
  return <>
    <strong className="oc-editor-header__brand">{brand}</strong>
    <span className="oc-editor-header__project" title={projectName}>{projectName}</span>
    <span className="oc-editor-header__spacer" />
    <select className="oc-editor-theme-picker" aria-label="Editor theme preset" value={themePreset} onChange={(event) => onThemePresetChange(event.currentTarget.value)}>
      {themeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <button className="oc-editor-header__theme-toggle" type="button" onClick={onThemeModeToggle} aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme`}>
      {themeMode === 'dark' ? '☀' : '☾'}
    </button>
    {actions}
  </>
}
