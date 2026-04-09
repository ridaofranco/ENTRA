/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/src/components/layout/Navbar';
import { Footer } from '@/src/components/layout/Footer';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import Landing from '@/src/pages/Landing';
import Catalog from '@/src/pages/Catalog';
import EventDetail from '@/src/pages/EventDetail';
import Checkout from '@/src/pages/Checkout';
import Dashboard from '@/src/pages/Dashboard';
import AccessControl from '@/src/pages/AccessControl';
import Auth from '@/src/pages/Auth';
import CreateEvent from '@/src/pages/CreateEvent';
import Contact from '@/src/pages/Contact';
import Profile from '@/src/pages/Profile';
import AdminDashboard from '@/src/pages/AdminDashboard';
import PlatformConfig from '@/src/pages/PlatformConfig';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/eventos" element={<Catalog />} />
            <Route path="/evento/:id" element={<EventDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/auth/login" element={<Auth />} />
            <Route path="/contacto" element={<Contact />} />
            
            {/* Protected Routes */}
            <Route path="/perfil" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin', 'superadmin']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/crear-evento" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin', 'superadmin']}>
                <CreateEvent />
              </ProtectedRoute>
            } />
            
            <Route path="/control-acceso" element={
              <ProtectedRoute allowedRoles={['organizer', 'admin', 'superadmin']}>
                <AccessControl />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* SuperAdmin Routes */}
            <Route path="/admin/config" element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <PlatformConfig />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

