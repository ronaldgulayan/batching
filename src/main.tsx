import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import './styles.css';
import { App } from './App';
import { SnackbarProvider } from './context/SnackbarContext';

const theme = createTheme({
  components: {
    NumberInput: {
      defaultProps: {
        hideControls: true,
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" forceColorScheme="dark">
      <SnackbarProvider>
        <App />
      </SnackbarProvider>
    </MantineProvider>
  </React.StrictMode>,
);

