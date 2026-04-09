/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Landing from '@/pages/Landing';
import Catalog from '@/pages/Catalog';
import EventDetail from '@/pages/EventDetail';
import Checkout from '@/pages/Checkout';
import Dashboard from '@/pages/Dashboard';
import AccessControl from '@/pages/AccessControl';
import Auth from '@/pages/Auth';
import CreateEvent from '@/pages/CreateEvent';
import Contact from '@/pages/Contact';
import AdminDashboard from '@/pages/AdminDashboard';
import PlatformConfig from '@/pages/PlatformConfig';
import Profile from '@/pages/Profile';

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

