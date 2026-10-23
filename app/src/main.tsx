import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initPlans } from '@/features/plans/plans';
import { registerSyncTriggers } from '@/repositories';
import './index.css';

function render(): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

initPlans()
  .catch(() => undefined)
  .then(() => {
    render();
    registerSyncTriggers();
  });
