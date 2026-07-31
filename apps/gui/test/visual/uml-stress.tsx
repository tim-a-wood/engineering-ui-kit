import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '../../src/styles.css'
import './uml-stress.css'
import { UmlDiagramWorkspace } from '../../src/views/capabilities/UmlDiagramWorkspace'
import { UML_ROBUSTNESS_FIXTURES } from '../fixtures/uml-robustness'

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function StressMatrix() {
  const requested = new URLSearchParams(window.location.search).get('case')
  const fixture = UML_ROBUSTNESS_FIXTURES.find(({ context }) => slug(context) === requested)
    ?? UML_ROBUSTNESS_FIXTURES[0]

  function selectCase(value: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('case', value)
    window.location.assign(url)
  }

  return (
    <main className="uml-stress-shell">
      <header className="uml-stress-context">
        <div>
          <p className="capabilities-eyebrow">Coordinate-free production stress fixture</p>
          <h1>{fixture.context}</h1>
          <p>
            The semantic projection uses the production layout worker, UML symbols, connector router, and canvas.
          </p>
        </div>
        <label className="uml-stress-case-picker">
          <span>Stress shape</span>
          <select
            aria-label="Stress shape"
            value={slug(fixture.context)}
            onChange={(event) => selectCase(event.target.value)}
          >
            {UML_ROBUSTNESS_FIXTURES.map(({ context, projection }) => (
              <option key={context} value={slug(context)}>
                {context} · {projection.kind}
              </option>
            ))}
          </select>
        </label>
      </header>
      <UmlDiagramWorkspace diagrams={[fixture.projection]} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StressMatrix />
  </StrictMode>,
)
