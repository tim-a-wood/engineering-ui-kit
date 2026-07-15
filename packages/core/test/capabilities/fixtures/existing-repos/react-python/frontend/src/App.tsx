import { fetchDashboard } from './ApiClient.js'

export function App(): JSX.Element {
  return (
    <main>
      <h1>Existing repo fixture (React + Python)</h1>
      <p>A minimal dashboard consuming the existing Python HTTP API via {fetchDashboard.name}.</p>
    </main>
  )
}
