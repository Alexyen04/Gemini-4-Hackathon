import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/anton/latin-400.css'
import '@fontsource/bangers/latin-400.css'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/comic-neue/latin-700.css'
import './styles.css'
import './landing.css'
import './reader.css'
import './pipeline.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
