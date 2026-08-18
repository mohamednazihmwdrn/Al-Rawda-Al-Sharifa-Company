import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { markQuotaExhausted } from './services/dbService';

// Graceful interception of Firestore Quota limits to keep local operations flawless
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    if (
      msg.includes('resource-exhausted') || 
      msg.includes('Quota limit exceeded') || 
      msg.includes('Quota exceeded') ||
      msg.includes('maximum backoff delay') ||
      reason?.code === 'resource-exhausted'
    ) {
      markQuotaExhausted();
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('resource-exhausted') || 
      msg.includes('Quota limit exceeded') || 
      msg.includes('Quota exceeded') ||
      msg.includes('maximum backoff delay')
    ) {
      markQuotaExhausted();
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

