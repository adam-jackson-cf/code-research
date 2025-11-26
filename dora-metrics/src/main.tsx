/**
 * Application Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Get repository from URL params or use default
const urlParams = new URLSearchParams(window.location.search);
const repo = urlParams.get('repo') || 'facebook/react';
const token = urlParams.get('token') || undefined;

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App repositoryUrl={repo} githubToken={token} />
  </React.StrictMode>
);
