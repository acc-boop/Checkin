import React from 'react';
import ReactDOM from 'react-dom/client';

// Initialize Supabase-backed storage BEFORE loading the App
// This sets window.storage so the App component works unchanged
import './storage';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
