// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom'; // <-- Import BrowserRouter
import { store } from './store'; // Import the Redux store
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';
import { PWAProvider } from './PWAContext';

const VITE_GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_ID = VITE_GOOGLE_CLIENT_ID;


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
          </BrowserRouter>
        </PWAProvider>
      </Provider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
