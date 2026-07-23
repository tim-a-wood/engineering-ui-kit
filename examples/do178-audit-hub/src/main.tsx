import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono'
import './tokens.css'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider } from './components.tsx'
import { App } from './views.tsx'

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StrictMode>,
  )
}
