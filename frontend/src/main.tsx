import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

// Configure Axios baseURL from VITE_API_URL (used on production Render deployment)
// If VITE_API_URL is undefined or empty, automatically detect if running on Render domain
const envApiUrl = import.meta.env.VITE_API_URL;
const isRenderDomain = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');

const apiBase = envApiUrl || (isRenderDomain ? 'https://gunay-kimya-api.onrender.com' : undefined);
if (apiBase && typeof apiBase === 'string') {
  axios.defaults.baseURL = apiBase.replace(/\/$/, '');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
