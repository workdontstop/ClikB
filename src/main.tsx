// src/main.tsx
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom'; // <-- Import BrowserRouter
import { store } from './store'; // Import the Redux store
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import { PWAProvider } from './PWAContext';
import { installPixelBillingInterceptor } from './pixelBillingClient';

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_ID = VITE_GOOGLE_CLIENT_ID;

installPixelBillingInterceptor();


function LoadingCover() {
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => {
      const { darkMode, appColorDark, appColorLight } = store.getState().settings;
      const accent = darkMode ? appColorDark : appColorLight;
      root.dataset.bootTheme = darkMode ? 'dark' : 'light';
      root.style.setProperty('--boot-background', darkMode ? '#08090b' : '#ffffff');
      root.style.setProperty('--boot-tile', darkMode ? 'rgba(128,128,128,0.6)' : '#ffffff');
      root.style.setProperty('--boot-accent', accent);
      root.style.setProperty('--boot-glow', `color-mix(in srgb, ${accent} 40%, transparent)`);
    };
    syncTheme();
    const unsubscribe = store.subscribe(syncTheme);
    let fadeTimer: ReturnType<typeof window.setTimeout> | undefined;

    const revealTimer = window.setTimeout(() => {
      document.getElementById('clikb-loading-cover')?.setAttribute('data-ready', '');
      fadeTimer = window.setTimeout(() => {
        document.documentElement.classList.remove('clikb-booting');
        document.getElementById('clikb-loading-cover')?.remove();
      }, 240);
    }, Math.max(0, 2000 - performance.now()));

    return () => {
      unsubscribe();
      window.clearTimeout(revealTimer);
      window.clearTimeout(fadeTimer);
    };
  }, []);
  return null;
}


// main.tsx

{/*
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
*/}


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <PWAProvider>
          {/* Wrap App with BrowserRouter */}
          <BrowserRouter>
            <App />
            <LoadingCover />
          </BrowserRouter>
        </PWAProvider>
      </Provider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
