import React from 'react';
import ReactDOM from 'react-dom/client';
import { OptionsApp } from './App';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <OptionsApp />
    </React.StrictMode>
  );
}
