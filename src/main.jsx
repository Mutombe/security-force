import { createRoot } from 'react-dom/client';
import { IconContext } from '@phosphor-icons/react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { StoreProvider } from './store';
import { RouterProvider } from './router';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <IconContext.Provider value={{ size: 18, weight: 'regular', mirrored: false }}>
    <RouterProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </RouterProvider>
  </IconContext.Provider>,
);
