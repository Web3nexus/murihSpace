import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'

// Automatically handle stale chunks / dynamic import errors after new deployments
window.addEventListener('vite:preloadError', () => {
  const isReloaded = sessionStorage.getItem('vite_preload_reloaded');
  if (!isReloaded) {
    sessionStorage.setItem('vite_preload_reloaded', 'true');
    window.location.reload();
  }
});

window.addEventListener('load', () => {
  sessionStorage.removeItem('vite_preload_reloaded');
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
