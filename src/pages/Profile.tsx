import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { User, Mail, Shield, Calendar, Ticket, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

export default function Profile() {
  const { user, profile, logout, updateRole } = useAuth();

  if (!user) return <div className="pt-40 text-center">Iniciá sesión para ver tu perfil</div>;

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case 'superadmin': return 'SuperAdmin';
      case 'admin': return 'Administrador';
      case 'organizer': return 'Organizador';
      default: return 'Comprador';
    }
  };

  const stats = [
    { label: 'Eventos Asistidos', value: '0', icon: Calendar },
    { label: 'Tickets Activos', value: '0', icon: Ticket },
    { label: 'Miembro desde', value: profile?.createdAt ? new Date(profile.createdAt.seconds * 1000).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) : 'Reciente', icon: Shield },
  ];

  const handleUpgrade = async () => {
    if (window.confirm('¿Estás seguro que querés solicitar el perfil de Organizador?')) {
      await updateRole('organizer');
      alert('¡Ahora sos Organizador! Ya podés crear tus eventos.');
    }
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-heading font-black tracking-tighter uppercase mb-2">Mi <span className="orange-text-gradient">Perfil</span></h1>
        <p className="text-muted-foreground">Gestioná tu cuenta y preferencias.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 text-center">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <img 
                src={user.photoURL || ''} 
                alt={user.displayName || ''} 
                className="w-full h-full rounded-full border-4 border-primary/20 object-cover"
              />
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white border-4 border-background">
                <Settings className="w-4 h-4" />
              </div>
            </div>
            <h2 className="text-xl font-heading font-bold mb-1">{user.displayName}</h2>
            <Badge variant="outline" className="orange-text-gradient border-primary/20 font-bold uppercase tracking-widest text-[10px]">
              {getRoleBadge(profile?.role)}
            </Badge>
            
            <div className="mt-8 space-y-2">
              <Button variant="ghost" className="w-full justify-start font-bold text-muted-foreground hover:text-primary">
                <User className="w-4 h-4 mr-3" />
                Editar Perfil
              </Button>
              <Button variant="ghost" className="w-full justify-start font-bold text-muted-foreground hover:text-primary">
                <Settings className="w-4 h-4 mr-3" />
                Ajustes
              </Button>
              {profile?.role === 'buyer' && (
                <Button 
                  variant="outline" 
                  onClick={handleUpgrade}
                  className="w-full justify-start font-bold border-primary/20 text-primary hover:bg-primary/10"
                >
                  <Shield className="w-4 h-4 mr-3" />
                  Ser Organizador
                </Button>
              )}
              <Button 
                variant="ghost" 
                onClick={logout}
                className="w-full justify-start font-bold text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Cerrar Sesión
              </Button>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((s, i) => (
              <Card key={i} className="glass p-6 rounded-3xl border-white/5 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-2 text-primary" />
                <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">{s.label}</div>
                <div className="text-xl font-heading font-black">{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Info */}
          <Card className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6">
            <h3 className="text-xl font-heading font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Información de la Cuenta
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Nombre de Usuario</div>
                    <div className="font-bold">{user.displayName}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary font-bold">Cambiar</Button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Email</div>
                    <div className="font-bold">{user.email}</div>
                  </div>
                </div>
                <Badge className="bg-green-500/10 text-green-500 border-none font-bold">Verificado</Badge>
              </div>
            </div>
          </Card>

          {/* Activity */}
          <Card className="glass p-8 rounded-[2.5rem] border-white/5">
            <h3 className="text-xl font-heading font-bold mb-6">Actividad Reciente</h3>
            <div className="text-center py-10 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No tenés actividad reciente para mostrar.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
