import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Handle dynamic import / chunk reload failures caused by Vite cache re-optimizations or network hiccups
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, reloading page...', event);
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

