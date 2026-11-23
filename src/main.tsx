import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Sumbu wght saja (52 KB latin). Versi opsz 110 KB, terlalu berat untuk target LCP.
import '@fontsource-variable/literata/wght.css';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/index.css';
import App from './App.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('Elemen #root tidak ditemukan di index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
