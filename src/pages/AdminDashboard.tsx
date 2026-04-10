import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, Ticket, TrendingUp, Loader, ChevronDown } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { handleFirestoreError, OperationType } from '@/src/lib/firebase';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: 'buyer' | 'organizer' | 'admin' | 'superadmin';
  createdAt: any;
  suspended?: boolean;
}

interface EventData {
  id: string;
  title: string;
  organizerEmail: string;
  date: any;
  status: string;
  tickets: Array<{ type: string; price: number; available: number }>;
}

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'event', id: string } | null>(null);

  // Check authorization using profile.role (NOT user.role — user is FirebaseUser)
  const isAuthorized = profile?.role === 'admin' || profile?.role === 'superadmin';

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized]);

  if (!user || !profile || !isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="glass border-orange-500/20 p-8">
          <p className="text-red-400 text-center">No autorizado. Se requiere acceso de administrador.</p>
        </Card>
      </div>
    );
  }

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserData[] = usersSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as UserData));
      setUsers(usersData);

      // Fetch events
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const eventsData: EventData[] = eventsSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as EventData));
      setEvents(eventsData);

      // Fetch orders for real stats
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const ordersData = ordersSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Compute stats from real orders
  const confirmedOrders = orders.filter((o: any) => o.status === 'confirmed');
  const totalTicketsSold = confirmedOrders.reduce((sum: number, o: any) => {
    return sum + (o.items || []).reduce((s: number, item: any) => s + (item.quantity || 0), 0);
  }, 0);
  const totalRevenue = confirmedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  const statCards = [
    {
      label: 'Usuarios',
      value: users.length,
      icon: Users,
      color: 'from-blue-500/20 to-blue-600/20',
      textColor: 'text-blue-400',
    },
    {
      label: 'Eventos',
      value: events.length,
      icon: Calendar,
      color: 'from-purple-500/20 to-purple-600/20',
      textColor: 'text-purple-400',
    },
    {
      label: 'Tickets Vendidos',
      value: totalTicketsSold,
      icon: Ticket,
      color: 'from-orange-500/20 to-orange-600/20',
      textColor: 'text-orange-400',
    },
    {
      label: 'Ingresos (ARS)',
      value: `$${totalRevenue.toLocaleString('es-AR')}`,
      icon: TrendingUp,
      color: 'from-green-500/20 to-green-600/20',
      textColor: 'text-green-400',
    },
  ];

  const handleRoleChange = async (userId: string, newRole: 'buyer' | 'organizer' | 'admin' | 'superadmin') => {
    try {
      setUpdatingUserId(userId);
      await updateDoc(doc(db, 'users', userId), { role: newRole, updatedAt: new Date() });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setRoleDropdown(null);
    } catch (error) {
      console.error('Error updating role:', error);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleEventStatusChange = async (eventId: string, status: 'active' | 'paused') => {
    try {
      await updateDoc(doc(db, 'events', eventId), { status });
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, status } : e))
      );
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `events/${eventId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setConfirmDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleSuspendUser = async (userId: string, suspended: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { suspended, updatedAt: new Date() });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, suspended } : u))
      );
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const formatDate = (date: any) => {
    try {
      if (date?.toDate) return date.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
      if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { }
    return '-';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  const roleColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-red-500/30 text-red-300 border-red-500/50';
      case 'admin': return 'bg-orange-500/30 text-orange-300 border-orange-500/50';
      case 'organizer': return 'bg-purple-500/30 text-purple-300 border-purple-500/50';
      default: return 'bg-blue-500/30 text-blue-300 border-blue-500/50';
    }
  };

  return (
    <div className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-black tracking-tight">
          Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Administración</span>
        </h1>
        <p className="text-zinc-400 mt-1">Gestión de usuarios, eventos y métricas de la plataforma</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 rounded-3xl border border-white/10 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{stat.label}</span>
                <div className={`bg-gradient-to-br ${stat.color} p-2 rounded-xl`}>
                  <Icon className={`w-4 h-4 ${stat.textColor}`} />
                </div>
              </div>
              <p className={`text-2xl font-black ${stat.textColor}`}>{stat.value}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
          <h2 className="text-xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Usuarios</span>
            <span className="text-zinc-500 text-sm font-normal ml-3">{users.length} total</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Nombre</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Email</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Rol</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Registro</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="py-3 px-4 text-zinc-200 font-medium">{u.displayName || 'Sin nombre'}</td>
                    <td className="py-3 px-4 text-zinc-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${roleColor(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">{formatDate(u.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {/* Role dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setRoleDropdown(roleDropdown === u.id ? null : u.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 transition text-xs font-bold"
                            disabled={updatingUserId === u.id}
                          >
                            {updatingUserId === u.id ? 'Guardando...' : 'Cambiar rol'}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          {roleDropdown === u.id && (
                            <div className="absolute top-full mt-1 right-0 bg-zinc-900 border border-white/10 rounded-xl overflow-hidden z-10 shadow-xl min-w-max">
                              {(['buyer', 'organizer', 'admin', 'superadmin'] as const).map((role) => (
                                <button
                                  key={role}
                                  onClick={() => handleRoleChange(u.id, role)}
                                  className={`w-full text-left px-4 py-2 hover:bg-orange-500/20 transition text-xs font-bold ${
                                    u.role === role ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-300'
                                  }`}
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Suspend/unsuspend */}
                        <button
                          onClick={() => handleSuspendUser(u.id, !u.suspended)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            u.suspended
                              ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                              : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          {u.suspended ? 'Activar' : 'Suspender'}
                        </button>
                        {/* Delete user (SuperAdmin only) */}
                        {profile?.role === 'superadmin' && (
                          <button
                            onClick={() => setConfirmDelete({ type: 'user', id: u.id })}
                            className="px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-600/30 text-red-500 text-xs font-bold transition"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Events Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6">
          <h2 className="text-xl font-black mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Eventos</span>
            <span className="text-zinc-500 text-sm font-normal ml-3">{events.length} total</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Título</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Organizador</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Fecha</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Estado</th>
                  <th className="text-left py-3 px-4 text-zinc-500 font-bold text-xs uppercase tracking-widest">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-white/5 hover:bg-white/5 transition"
                  >
                    <td className="py-3 px-4 text-zinc-200 font-medium">{e.title}</td>
                    <td className="py-3 px-4 text-zinc-400">{e.organizerEmail || '-'}</td>
                    <td className="py-3 px-4 text-zinc-500 text-xs">{formatDate(e.date)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${
                        e.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                        e.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                        'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                      }`}>
                        {e.status === 'active' ? 'Activo' : e.status === 'paused' ? 'Pausado' : e.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {e.status === 'active' ? (
                          <button
                            onClick={() => handleEventStatusChange(e.id, 'paused')}
                            className="px-3 py-1.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold transition"
                          >
                            Pausar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEventStatusChange(e.id, 'active')}
                            className="px-3 py-1.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-bold transition"
                          >
                            Activar
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDelete({ type: 'event', id: e.id })}
                          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full text-center space-y-6"
          >
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <TrendingUp className="w-10 h-10 rotate-45" /> {/* Using TrendingUp as a placeholder for alert */}
            </div>
            <div>
              <h3 className="text-2xl font-black mb-2">¿Estás seguro?</h3>
              <p className="text-zinc-400">
                Esta acción es irreversible y eliminará permanentemente el {confirmDelete.type === 'user' ? 'usuario' : 'evento'}.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete.type === 'user' ? handleDeleteUser(confirmDelete.id) : handleDeleteEvent(confirmDelete.id)}
                className="flex-1 px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold transition"
              >
                Eliminar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

