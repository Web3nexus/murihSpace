import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { apiClient } from './lib/api/client'
import { setBackendProfileDomain } from './lib/deepLinks'

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

// Profile and bio links use the backend's canonical domain. Load it before the
// first render, but never let a slow request hold up the app.
const platformReady = apiClient
  .get('/platform', { timeout: 3000 })
  .then((res) => {
    const body = res.data?.data ?? res.data;
    setBackendProfileDomain(body?.canonical_profile_domain);
  })
  .catch(() => {
    // Offline or unavailable: links stay empty until the next launch.
  });

Promise.race([platformReady, new Promise((resolve) => setTimeout(resolve, 3000))]).finally(() => {
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
  );
});
