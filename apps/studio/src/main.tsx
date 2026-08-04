import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './StudioApp.js';
import './studio.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <StudioApp />
    </StrictMode>
  );
}
