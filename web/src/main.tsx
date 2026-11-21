import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './index.css'
import LandingPage from './landing/LandingPage.tsx'
import DemoPlaceholder from './demo/DemoPlaceholder.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        {/* teammate: swap DemoPlaceholder for the real reader app */}
        <Route path="/demo/*" element={<DemoPlaceholder />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
