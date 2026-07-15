import { createRoot } from 'react-dom/client'
import { App } from './App.js'

// Existing entry point: a migration plan must wrap/extend this file, never
// replace it wholesale (CAP-ERA-001 §14.3).
const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<App />)
}
