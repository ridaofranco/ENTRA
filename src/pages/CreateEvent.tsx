import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Badge } from '@/src/components/ui/badge';
import { 
  Calendar, 
  MapPin, 
  Image as ImageIcon, 
  Ticket, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Sparkles,
  Info
} from 'lucide-react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { logAction } from '@/src/services/auditService';

export default function CreateEvent() {
  const navigate = useNavigate();
  const { user, profile, login, updateRole } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    venue: '',
    location: '',
    category: 'Música',
    image: '',
    price: 0,
  });

  const [tickets, setTickets] = useState([
    { type: 'General', price: 0, available: 100 }
  ]);

  if (!user) {
    return (
      <div className="pt-40 pb-20 px-6 text-center max-w-xl mx-auto">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Sparkles className="w-10 h-10" />
        </div>
        <h1 className="text-4xl font-heading font-black tracking-tighter mb-4 uppercase">Empezá a vender hoy</h1>
        <p className="text-muted-foreground mb-8">Para crear y gestionar tus eventos en ENTRÁ, primero necesitás iniciar sesión con tu cuenta.</p>
        <Button onClick={login} className="h-14 px-12 orange-gradient border-none font-bold text-lg rounded-2xl shadow-xl shadow-primary/20">
          Iniciar Sesión con Google
        </Button>
      </div>
    );
  }

  const addTicketType = () => {
    setTickets([...tickets, { type: '', price: 0, available: 0 }]);
  };

  const removeTicketType = (index: number) => {
    setTickets(tickets.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const eventDate = new Date(`${formData.date}T${formData.time}`);
      // Create a copy of formData without the 'time' field which is not needed in Firestore
      const { time, ...restFormData } = formData;
      
      // Calculate minimum price from tickets
      const minPrice = tickets.length > 0 ? Math.min(...tickets.map(t => t.price)) : 0;
      
      const eventData = {
        ...restFormData,
        price: minPrice,
        date: Timestamp.fromDate(eventDate),
        tickets,
        organizerId: user.uid,
        organizerEmail: user.email || '',
        organizerName: user.displayName || profile?.displayName || '',
        ticketsSold: 0,
        totalRevenue: 0,
        status: 'active',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(collection(db, 'events'), eventData);
      
      // Log the action
      await logAction('CREATE_EVENT', 'events', docRef.id, { title: eventData.title });
      
      // If user is still a buyer, upgrade them to organizer automatically
      if (profile?.role === 'buyer') {
        await updateRole('organizer');
      }
      
      navigate('/dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-12">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-4xl font-heading font-black tracking-tighter uppercase">Crear <span className="orange-text-gradient">Evento</span></h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        {/* Basic Info */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <Info className="w-5 h-5" />
            <h2 className="text-xl font-heading font-bold uppercase tracking-tight">Información Básica</h2>
          </div>
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Título del Evento</label>
              <Input 
                required
                placeholder="Ej: Noche de Jazz en Palermo" 
                className="bg-white/5 border-white/10 h-14 rounded-2xl text-lg"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fecha</label>
                <Input 
                  required
                  type="date" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Hora</label>
                <Input 
                  required
                  type="time" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl"
                  value={formData.time}
                  onChange={e => setFormData({...formData, time: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Descripción</label>
              <Textarea 
                required
                placeholder="Contanos de qué se trata el evento..." 
                className="bg-white/5 border-white/10 min-h-[150px] rounded-2xl"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </Card>
        </section>

        {/* Location & Image */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="w-5 h-5" />
            <h2 className="text-xl font-heading font-bold uppercase tracking-tight">Lugar y Estética</h2>
          </div>
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre del Lugar</label>
                <Input 
                  required
                  placeholder="Ej: Estadio Obras" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl"
                  value={formData.venue}
                  onChange={e => setFormData({...formData, venue: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ciudad / Zona</label>
                <Input 
                  required
                  placeholder="Ej: CABA, Buenos Aires" 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">URL del Flyer (Imagen)</label>
              <div className="flex gap-4">
                <Input 
                  placeholder="https://..." 
                  className="bg-white/5 border-white/10 h-14 rounded-2xl flex-grow"
                  value={formData.image}
                  onChange={e => setFormData({...formData, image: e.target.value})}
                />
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden">
                  {formData.image ? <img src={formData.image} className="w-full h-full object-cover" /> : <ImageIcon className="text-muted-foreground" />}
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Tickets */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 text-primary">
            <Ticket className="w-5 h-5" />
            <h2 className="text-xl font-heading font-bold uppercase tracking-tight">Tickets y Precios</h2>
          </div>
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            {tickets.map((ticket, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white/5 p-6 rounded-3xl border border-white/5">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tipo de Entrada</label>
                  <Input 
                    placeholder="Ej: General, VIP, Early Bird" 
                    className="bg-background/50 border-white/10 h-12 rounded-xl"
                    value={ticket.type}
                    onChange={e => {
                      const newTickets = [...tickets];
                      newTickets[index].type = e.target.value;
                      setTickets(newTickets);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Precio ($)</label>
                  <Input 
                    type="number"
                    className="bg-background/50 border-white/10 h-12 rounded-xl"
                    value={ticket.price}
                    onChange={e => {
                      const newTickets = [...tickets];
                      newTickets[index].price = Number(e.target.value);
                      setTickets(newTickets);
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-grow space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cupo</label>
                    <Input 
                      type="number"
                      className="bg-background/50 border-white/10 h-12 rounded-xl"
                      value={ticket.available}
                      onChange={e => {
                        const newTickets = [...tickets];
                        newTickets[index].available = Number(e.target.value);
                        setTickets(newTickets);
                      }}
                    />
                  </div>
                  {tickets.length > 1 && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeTicketType(index)}
                      className="text-red-500 hover:bg-red-500/10 h-12 w-12 rounded-xl"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button 
              type="button"
              variant="outline" 
              onClick={addTicketType}
              className="w-full h-14 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 rounded-2xl text-muted-foreground hover:text-primary transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar otro tipo de entrada
            </Button>
          </Card>
        </section>

        <Button 
          type="submit" 
          disabled={loading}
          className="w-full h-20 orange-gradient border-none font-black text-2xl rounded-[2rem] shadow-2xl shadow-primary/30 hover:scale-[1.02] transition-all"
        >
          {loading ? "Publicando..." : "Publicar Evento"}
        </Button>
      </form>
    </div>
  );
}
