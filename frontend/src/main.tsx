import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastHost } from '@/components/ui/Toast';
import App from './App';
import './index.css';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // A single HR user on an internal tool -- refetching on every tab focus
      // is noise, not freshness.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ToastHost>
        <App />
      </ToastHost>
    </QueryClientProvider>
  </StrictMode>
);
