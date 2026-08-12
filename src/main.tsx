import { StrictMode } from 'react'

import App from './App.tsx'
import './index.css'
import '@/lib/i18n'
import { createRoot } from 'react-dom/client'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
