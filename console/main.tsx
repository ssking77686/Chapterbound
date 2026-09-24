import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConsoleApp } from './ConsoleApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ConsoleApp />
  </StrictMode>,
)
