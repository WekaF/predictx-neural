import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for PWA
// Register Service Worker for PWA (Production only)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    } else {
      // In development, unregister any existing service workers to avoid caching issues
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for(let registration of registrations) {
          registration.unregister();
          console.log('🧹 Unregistered Service Worker in DEV mode');
        }
      });
    }
  });
}