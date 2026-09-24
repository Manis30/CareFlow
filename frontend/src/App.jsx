import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import PageTitleHandler from './components/common/PageTitleHandler';

function App() {
  return (
    <BrowserRouter>
      <PageTitleHandler />
      <AuthProvider>
        <AppRoutes />
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
