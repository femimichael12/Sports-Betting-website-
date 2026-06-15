/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BetSlipProvider } from './context/BetSlipContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sports from './pages/Sports';
import BetHistory from './pages/BetHistory';
import Profile from './pages/Profile';
import Wallet from './pages/Wallet';
import Admin from './pages/Admin';

export default function App() {
  return (
    <AuthProvider>
      <BetSlipProvider>
        <HashRouter>
          <Routes>
            {/* Authenticated landing portal */}
            <Route path="/login" element={<Login />} />

            {/* Locked-in protected viewport terminal */}
            <Route element={<ProtectedRoute />}>
              <Route 
                path="/" 
                element={
                  <Layout>
                    <Dashboard />
                  </Layout>
                } 
              />
              <Route 
                path="/sports" 
                element={
                  <Layout>
                    <Sports />
                  </Layout>
                } 
              />
              <Route 
                path="/wagers" 
                element={
                  <Layout>
                    <BetHistory />
                  </Layout>
                } 
              />
              <Route 
                path="/wallet" 
                element={
                  <Layout>
                    <Wallet />
                  </Layout>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <Layout>
                    <Profile />
                  </Layout>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <Layout>
                    <Admin />
                  </Layout>
                } 
              />
            </Route>

            {/* Fallback interceptor redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </BetSlipProvider>
    </AuthProvider>
  );
}
