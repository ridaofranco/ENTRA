import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, Ticket, TrendingUp, Loader, ChevronDown } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'buyer' | 'organizer' | 'admin';
  createdAt: any;
}

interface Event {
  id: string;
  title: string;
  organizer: string;
  date: string;
  status: 'active' | 'paused' | 'completed';
  ticketsSold: number;
}

interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalTicketsSold: number;
  revenue: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalEvents: 0,
    totalTicketsSold: 0,
    revenue: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Check authorization
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="glass border-orange-500/20 p-8">
          <p className="text-red-400 text-center">Unauthorized. Admin access required.</p>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];
      usersSnapshot.forEach((doc) => {
        usersData.push({
          id: doc.id,
          ...doc.data(),
        } as User);
      });
      setUsers(usersData);

      // Fetch events
      const eventsSnapshot = await getDocs(collection(db, 'events'));
      const eventsData: Event[] = [];
      eventsSnapshot.forEach((doc) => {
        eventsData.push({
          id: doc.id,
          ...doc.data(),
        } as Event);
      });
      setEvents(eventsData);

      // Fetch tickets for stats
      const ticketsSnapshot = await getDocs(collection(db, 'tickets'));
      let totalTicketsSold = 0;
      let revenue = 0;
      ticketsSnapshot.forEach((doc) => {
        totalTicketsSold += 1;
        revenue += doc.data().price || 0;
      });

      setStats({
        totalUsers: usersData.length,
        totalEvents: eventsData.length,
        totalTicketsSold,
        revenue,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'buyer' | 'organizer' | 'admin') => {
    try {
      setUpdatingUserId(userId);
      await updateDoc(doc(db, 'users', userId), { role: newRole });
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
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'events', eventId));
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const statCards = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'from-blue-500/20 to-blue-600/20',
      textColor: 'text-blue-400',
    },
    {
      label: 'Total Events',
      value: stats.totalEvents,
      icon: Calendar,
      color: 'from-purple-500/20 to-purple-600/20',
      textColor: 'text-purple-400',
    },
    {
      label: 'Tickets Sold',
      value: stats.totalTicketsSold,
      icon: Ticket,
      color: 'from-orange-500/20 to-orange-600/20',
      textColor: 'text-orange-400',
    },
    {
      label: 'Revenue (ARS)',
      value: `$${stats.revenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'from-green-500/20 to-green-600/20',
      textColor: 'text-green-400',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader className="w-12 h-12 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-heading text-4xl orange-text-gradient mb-2">Admin Dashboard</h1>
        <p className="text-slate-400">Platform overview and management</p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
            >
              <Card className={`glass border-orange-500/20 p-6 bg-gradient-to-br ${stat.color}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                    <p className={`font-heading text-2xl md:text-3xl ${stat.textColor}`}>
                      {stat.value}
                    </p>
                  </div>
                  <Icon className={`w-8 h-8 ${stat.textColor}`} />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8"
      >
        <Card className="glass border-orange-500/20 p-6">
          <h2 className="font-heading text-2xl orange-text-gradient mb-4">Recent Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-500/20">
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Joined Date</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 transition"
                  >
                    <td className="py-3 px-4 text-slate-200">{u.name || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-300">{u.email}</td>
                    <td className="py-3 px-4">
                      <Badge
                        className={
                          u.role === 'admin'
                            ? 'bg-orange-500/30 text-orange-300 border-orange-500/50'
                            : u.role === 'organizer'
                              ? 'bg-purple-500/30 text-purple-300 border-purple-500/50'
                              : 'bg-blue-500/30 text-blue-300 border-blue-500/50'
                        }
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {u.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setRoleDropdown(roleDropdown === u.id ? null : u.id)
                          }
                          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 transition text-xs"
                          disabled={updatingUserId === u.id}
                        >
                          Change
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {roleDropdown === u.id && (
                          <div className="absolute top-full mt-2 right-0 glass border border-orange-500/30 rounded-lg overflow-hidden z-10 min-w-max">
                            {(['buyer', 'organizer', 'admin'] as const).map((role) => (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(u.id, role)}
                                className="w-full text-left px-4 py-2 hover:bg-orange-500/20 transition text-slate-300 text-xs"
                                disabled={updatingUserId === u.id}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* Events Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass border-orange-500/20 p-6">
          <h2 className="font-heading text-2xl orange-text-gradient mb-4">All Events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-500/20">
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Title</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Organizer</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Tickets Sold</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 transition"
                  >
                    <td className="py-3 px-4 text-slate-200 font-medium">{e.title}</td>
                    <td className="py-3 px-4 text-slate-300">{e.organizer}</td>
                    <td className="py-3 px-4 text-slate-400">{e.date}</td>
                    <td className="py-3 px-4">
                      <Badge
                        className={
                          e.status === 'active'
                            ? 'bg-green-500/30 text-green-300 border-green-500/50'
                            : e.status === 'paused'
                              ? 'bg-yellow-500/30 text-yellow-300 border-yellow-500/50'
                              : 'bg-slate-500/30 text-slate-300 border-slate-500/50'
                        }
                      >
                        {e.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">{e.ticketsSold}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {e.status === 'active' ? (
                          <Button
                            onClick={() => handleEventStatusChange(e.id, 'paused')}
                            size="sm"
                            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 text-xs"
                          >
                            Pause
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleEventStatusChange(e.id, 'active')}
                            size="sm"
                            className="bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/50 text-xs"
                          >
                            Unpause
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDeleteEvent(e.id)}
                          size="sm"
                          className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 text-xs"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
