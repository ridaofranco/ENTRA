import { motion } from 'framer-motion';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { ArrowRight, Ticket, Zap, Shield, BarChart3, Globe, CheckCircle2, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { seedEventsIfMissing } from '@/src/services/eventService';

export default function Landing() {
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        await seedEventsIfMissing();
        const eventsCol = collection(db, 'events');
        const q = query(eventsCol, orderBy('date', 'asc'), limit(3));
        const snapshot = await getDocs(q);
        setFeaturedEvents(snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (error) {
        console.error("Error fetching featured events", error);
      }
    };
    fetchFeatured();
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 px-6">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background z-10" />
          <img 
            src="https://images.unsplash.com/photo-1459749411177-042180ce673c?auto=format&fit=crop&q=80&w=2000" 
            alt="Concert background" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge variant="outline" className="mb-6 border-primary/30 text-primary px-4 py-1.5 uppercase tracking-widest font-bold bg-primary/5">
              Nuevo en Argentina
            </Badge>
            <h1 className="text-5xl md:text-7xl font-heading font-black leading-[1.05] tracking-tighter mb-6">
              La ticketera que<br />
              <span className="orange-text-gradient">Argentina merecía.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mb-10 leading-relaxed">
              Comisiones más bajas del mercado, control de accesos integrado y una experiencia de compra que tus asistentes van a amar. Hecho en Argentina, pensado para dominar Latinoamérica.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link to="/crear-evento">
                <Button size="lg" className="orange-gradient border-none font-bold h-14 px-8 text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform w-full sm:w-auto">
                  Crear mi evento gratis
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/eventos">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-white/10 hover:border-primary hover:text-primary transition-colors w-full sm:w-auto">
                  Ver demo
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-8 pt-8 border-t border-white/5">
              <div>
                <div className="text-3xl font-heading font-black text-primary">1.9%</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Comisión mínima</div>
              </div>
              <div>
                <div className="text-3xl font-heading font-black text-primary">30s</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Compra express</div>
              </div>
              <div>
                <div className="text-3xl font-heading font-black text-primary">API</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Control total</div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="glass rounded-3xl p-6 shadow-2xl border-white/10 relative">
              <div className="flex gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              
              <Card className="bg-background/50 border-white/5 overflow-hidden mb-6">
                <div className="h-40 bg-primary/20 relative flex items-center justify-center text-4xl">
                  🎵
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
                <div className="p-4">
                  <h4 className="font-heading font-bold text-lg mb-1">Noche Electrónica — Vol. 12</h4>
                  <p className="text-xs text-muted-foreground mb-4">Sábado 15 Abr · 23:00hs · Palermo, CABA</p>
                  <div className="flex justify-between items-center">
                    <span className="font-heading font-black text-xl text-primary">$8.500</span>
                    <Button size="sm" className="orange-gradient border-none font-bold">Comprar →</Button>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Tickets vendidos</div>
                  <div className="text-2xl font-heading font-black text-green-500">1,247</div>
                </div>
                <div className="glass rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Ingresos</div>
                  <div className="text-2xl font-heading font-black text-primary">$10.6M</div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-6 -right-6 glass p-4 rounded-2xl shadow-xl border-primary/20 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Antifraude</div>
                  <div className="text-sm font-bold text-green-500">Activo</div>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-6 -left-6 glass p-4 rounded-2xl shadow-xl border-primary/20 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Venta</div>
                  <div className="text-sm font-bold text-primary">+3 tickets</div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Events Section */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <Badge variant="outline" className="mb-4 border-primary/20 text-primary uppercase tracking-[0.2em] font-bold">Destacados</Badge>
              <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tight">
                Eventos <span className="orange-text-gradient">Imperdibles</span>
              </h2>
            </div>
            <Link to="/eventos">
              <Button variant="ghost" className="text-primary font-bold hover:bg-primary/5">
                Ver todos los eventos
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredEvents.length > 0 ? (
              featuredEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Link to={`/evento/${event.id}`}>
                    <Card className="glass rounded-[2rem] border-white/5 overflow-hidden group hover:border-primary/30 transition-all">
                      <div className="relative h-64 overflow-hidden">
                        <img 
                          src={event.image || `https://picsum.photos/seed/${event.id}/800/600`} 
                          alt={event.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 left-4">
                          <Badge className="orange-gradient border-none font-bold uppercase tracking-widest text-[10px] px-3 py-1">
                            {event.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-widest mb-3">
                          <Calendar className="w-4 h-4" />
                          {event.date?.toDate().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                        </div>
                        <h3 className="text-xl font-heading font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">{event.title}</h3>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-6">
                          <MapPin className="w-4 h-4" />
                          {event.venue}
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-white/5">
                          <div className="text-xl font-heading font-black text-primary">${event.price.toLocaleString('es-AR')}</div>
                          <Button size="sm" className="orange-gradient border-none font-bold rounded-xl px-4">
                            Tickets
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))
            ) : (
              [1, 2, 3].map(i => (
                <div key={i} className="h-[400px] rounded-[2rem] bg-white/5 animate-pulse" />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-background/50" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <Badge variant="outline" className="mb-4 border-primary/20 text-primary uppercase tracking-[0.2em] font-bold">Funcionalidades</Badge>
            <h2 className="text-4xl md:text-5xl font-heading font-black mb-6 tracking-tight">
              Todo lo que la competencia cobra de más, nosotros lo incluimos
            </h2>
            <p className="text-muted-foreground text-lg">
              Construido desde cero pensando en organizadores argentinos. Sin sorpresas, sin costos ocultos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Ticket, title: "Comisiones más bajas", desc: "Desde 1.9% + cargo fijo. Hasta 5x más barato que Ticketek y Passline. Vos decidís quién absorbe el cargo." },
              { icon: Zap, title: "Compra en 30 segundos", desc: "Sin registro obligatorio. Checkout express con Mercado Pago, tarjetas, transferencia y crypto." },
              { icon: Shield, title: "Control de accesos con API", desc: "API REST completa para integrar con apps de terceros. QR dinámicos, validación en tiempo real." },
              { icon: BarChart3, title: "Analytics en tiempo real", desc: "Dashboard con ventas, conversión, demografía y proyecciones. Datos que te ayudan a vender más." },
              { icon: Globe, title: "White label opcional", desc: "Vendé con tu propia marca, dominio y colores. Tu evento, tu identidad. La tecnología corre por nuestra cuenta." },
              { icon: Shield, title: "Anti-reventa inteligente", desc: "QR dinámicos que cambian cada 30 segundos. Transferencia segura entre personas. Eliminamos las reventas." }
            ].map((f, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="glass p-8 rounded-3xl border-white/5 hover:border-primary/20 transition-all group"
              >
                <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                  <f.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-heading font-bold mb-3">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <Badge variant="outline" className="mb-4 border-primary/20 text-primary uppercase tracking-[0.2em] font-bold">Precios</Badge>
            <h2 className="text-4xl md:text-5xl font-heading font-black mb-6 tracking-tight">
              Transparentes. Sin letra chica.
            </h2>
            <p className="text-muted-foreground text-lg">
              Solo pagás cuando vendés. Sin costos de setup, sin mínimos, sin contratos.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Starter */}
            <Card className="glass p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
              <div className="mb-8">
                <h4 className="text-2xl font-heading font-bold mb-2">Starter</h4>
                <p className="text-sm text-muted-foreground">Para eventos chicos y productoras que arrancan.</p>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-heading font-black">3.5%</span>
                <span className="text-muted-foreground font-medium">por venta</span>
              </div>
              <p className="text-xs text-muted-foreground mb-8">+ $50 ARS por ticket · Sin mínimos</p>
              <ul className="space-y-4 mb-10">
                {["Hasta 500 tickets", "Mercado Pago + Transf", "QR de acceso básico", "Dashboard de ventas"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 hover:border-primary hover:text-primary">Empezar gratis</Button>
            </Card>

            {/* Pro */}
            <Card className="glass p-10 rounded-[2.5rem] border-primary/30 relative overflow-hidden bg-primary/5 scale-105 shadow-2xl shadow-primary/10">
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-bl-2xl">
                Más Popular
              </div>
              <div className="mb-8">
                <h4 className="text-2xl font-heading font-bold mb-2">Pro</h4>
                <p className="text-sm text-muted-foreground">Para organizadores regulares y productoras.</p>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-heading font-black text-primary">2.5%</span>
                <span className="text-muted-foreground font-medium">por venta</span>
              </div>
              <p className="text-xs text-muted-foreground mb-8">+ $30 ARS por ticket · Tickets ilimitados</p>
              <ul className="space-y-4 mb-10">
                {["Tickets ilimitados", "Todos los medios de pago", "Control de accesos completo", "Analytics avanzados", "Soporte prioritario 24/7"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-foreground font-medium">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="w-full h-12 rounded-xl orange-gradient border-none font-bold shadow-lg shadow-primary/20">Elegir Pro</Button>
            </Card>

            {/* Enterprise */}
            <Card className="glass p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden group">
              <div className="mb-8">
                <h4 className="text-2xl font-heading font-bold mb-2">Enterprise</h4>
                <p className="text-sm text-muted-foreground">Para festivales y grandes productoras.</p>
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-5xl font-heading font-black">1.9%</span>
                <span className="text-muted-foreground font-medium">por venta</span>
              </div>
              <p className="text-xs text-muted-foreground mb-8">Cargo fijo negociable · Volumen custom</p>
              <ul className="space-y-4 mb-10">
                {["Todo lo de Pro", "API completa de accesos", "White label premium", "Gerente de cuenta dedicado", "SLA garantizado 99.9%"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 hover:border-primary hover:text-primary">Contactar ventas</Button>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div 
            whileInView={{ scale: [0.95, 1], opacity: [0, 1] }}
            className="orange-gradient rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-primary/30"
          >
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[100px]" />
              <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-white rounded-full blur-[100px]" />
            </div>
            
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-heading font-black text-white mb-6 tracking-tighter">
                ¿Listo para revolucionar tus eventos?
              </h2>
              <p className="text-white/80 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-medium">
                Registrate gratis y empezá a vender en minutos. Sin compromisos, sin costos de setup.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/crear-evento">
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-black h-16 px-10 text-xl rounded-2xl shadow-xl">
                    Crear mi cuenta gratis
                  </Button>
                </Link>
                <Link to="/contacto">
                  <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 font-bold h-16 px-10 text-xl rounded-2xl">
                    Contactar ventas
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
