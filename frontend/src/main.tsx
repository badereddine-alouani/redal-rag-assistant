import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

let rootElement = document.getElementById('redal-chat-widget-root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'redal-chat-widget-root';
  document.body.appendChild(rootElement);
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
