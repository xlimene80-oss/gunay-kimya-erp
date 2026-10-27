import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App';
import './index.css';

// Configure Axios baseURL from VITE_API_URL (used on production Render deployment)
// If VITE_API_URL is undefined or empty, Axios uses relative paths hitting Vite dev proxy
const apiBase = import.meta.env.VITE_API_URL;
if (apiBase && typeof apiBase === 'string') {
  axios.defaults.baseURL = apiBase.replace(/\/$/, '');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
