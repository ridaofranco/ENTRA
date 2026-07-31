import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { inject } from '@vercel/analytics';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { capturarOrigen } from './lib/attribution';

// Vercel Analytics (pageviews + visitantes en el dashboard de Vercel).
// inject() es la variante framework-agnostic para SPA: no necesita config
// ni cambios en Vercel, y en localhost queda en modo debug sin reportar.
inject();

// De qué link vino esta visita (utm_* o referrer). Queda en sessionStorage y
// viaja con la compra, para que el productor sepa qué canal le vendió.
capturarOrigen();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
