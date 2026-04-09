import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  Ticket, 
  Calendar, 
  Plus, 
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user, profile, updateRole } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSales: 0,
    ticketsSold: 0,
    attendees: 0,
    activeEvents: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      try {
        // Fetch events created by this user - simplified query
        const eventsCol = collection(db, 'events');
        const q = query(eventsCol, where('organizerId', '==', user.uid));
        const snapshot = await getDocs(q);
        const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort client-side to avoid index requirement for composite query
        const sortedEvents = eventsData.sort((a: any, b: any) => {
          const dateA = a.date?.toDate() || 0;
          const dateB = b.date?.toDate() || 0;
          return dateB - dateA;
        });
        
        setEvents(sortedEvents.slice(0, 5));

        // Fetch all tickets for these events to calculate stats
        // In a real app, we'd query tickets where eventId is in the list of organizer's events
        // For demo, we'll fetch all and filter client-side if needed, or just show all for now
        const ticketsCol = collection(db, 'tickets');
        const ticketsSnapshot = await getDocs(ticketsCol);
        const allTickets = ticketsSnapshot.docs.map(doc => doc.data());
        
        // Filter tickets that belong to the organizer's events
        const organizerEventIds = eventsData.map(e => e.id);
        const organizerTickets = allTickets.filter(t => organizerEventIds.includes(t.eventId));
        
        const totalSales = organizerTickets.reduce((acc, t) => acc + (t.price || 0), 0);
        const ticketsSold = organizerTickets.length;
        const attendees = organizerTickets.filter(t => t.status === 'used').length;

        setStats({
          totalSales,
          ticketsSold,
          attendees,
          activeEvents: eventsData.length
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const chartData = [
    { name: 'Lun', sales: 4000 },
    { name: 'Mar', sales: 3000 },
    { name: 'Mie', sales: 2000 },
    { name: 'Jue', sales: 2780 },
    { name: 'Vie', sales: 1890 },
    { name: 'Sab', sales: 2390 },
    { name: 'Dom', sales: 3490 },
  ];

  const statCards = [
    { title: 'Ventas Totales', value: `$${stats.totalSales.toLocaleString('es-AR')}`, icon: TrendingUp, trend: '+12.5%', isUp: true },
    { title: 'Tickets Vendidos', value: stats.ticketsSold.toString(), icon: Ticket, trend: '+5.2%', isUp: true },
    { title: 'Asistentes', value: stats.attendees.toString(), icon: Users, trend: '-2.1%', isUp: false },
    { title: 'Eventos Activos', value: stats.activeEvents.toString(), icon: Calendar, trend: '0%', isUp: true },
  ];

  return (
    <div className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-tighter uppercase mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Bienvenido de nuevo, <span className="text-foreground font-bold">{user?.displayName}</span></p>
        </div>
        <div className="flex gap-4">
          {profile?.role === 'buyer' && (
            <Button 
              variant="outline"
              onClick={() => updateRole('organizer')}
              className="border-primary/30 text-primary hover:bg-primary/5 font-bold h-12 px-6 rounded-xl"
            >
              Convertirme en Organizador
            </Button>
          )}
          <Button 
            onClick={() => window.location.href='/crear-evento'}
            className="orange-gradient border-none font-bold h-12 px-8 rounded-xl shadow-lg shadow-primary/20"
          >
            <Plus className="w-5 h-5 mr-2" />
            Crear Evento
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="glass p-6 rounded-3xl border-white/5">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <stat.icon className="w-6 h-6" />
                </div>
                <Badge variant="outline" className={cn(
                  "border-none font-bold",
                  stat.isUp ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"
                )}>
                  {stat.trend}
                  {stat.isUp ? <ArrowUpRight className="w-3 h-3 ml-1" /> : <ArrowDownRight className="w-3 h-3 ml-1" />}
                </Badge>
              </div>
              <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.title}</div>
              <div className="text-3xl font-heading font-black">{stat.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <Card className="lg:col-span-2 glass p-8 rounded-[2.5rem] border-white/5">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-heading font-bold">Ventas de la Semana</h3>
            <select className="bg-white/5 border-white/10 rounded-lg text-xs font-bold px-3 py-2 outline-none">
              <option>Últimos 7 días</option>
              <option>Último mes</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff5c00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ff5c00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 12 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#71717a', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#ff5c00' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#ff5c00" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent Events */}
        <Card className="glass p-8 rounded-[2.5rem] border-white/5">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-heading font-bold">Mis Eventos</h3>
            <Button variant="ghost" size="sm" className="text-primary font-bold">Ver todos</Button>
          </div>
          <div className="space-y-6">
            {loading ? (
              <p className="text-center text-muted-foreground py-10 animate-pulse">Cargando...</p>
            ) : events.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No tenés eventos creados.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
                    <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-bold truncate group-hover:text-primary transition-colors">{event.title}</div>
                    <div className="text-xs text-muted-foreground">{event.date?.toDate().toLocaleDateString()}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
