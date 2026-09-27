import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EditorHeader } from '../components/editor/editor-header'

describe('editor header presentation contract', () => {
  it('renders identity and theme choices supplied by the host', () => {
    const markup = renderToStaticMarkup(createElement(EditorHeader, {
      brand: 'Example host',
      projectName: 'Scene 12',
      themeMode: 'dark',
      themePreset: 'night',
      themeOptions: [{ id: 'day', label: 'Day' }, { id: 'night', label: 'Night' }],
      onThemeModeToggle: () => undefined,
      onThemePresetChange: () => undefined,
      actions: createElement('button', null, 'Save project'),
    }))

    expect(markup).toContain('Example host')
    expect(markup).toContain('Scene 12')
    expect(markup).toContain('value="night" selected=""')
    expect(markup).toContain('Switch to light theme')
    expect(markup).toContain('Save project')
    expect(markup).not.toContain('OpenCut')
  })
})
