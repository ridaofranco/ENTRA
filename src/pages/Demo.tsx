import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Ticket, QrCode, Calendar, ScanLine, Mail, DollarSign,
  ShieldCheck, Smartphone, Users, CheckCircle2, ArrowRight
} from 'lucide-react';
import { WhatsAppIcon } from '@/src/components/icons/WhatsAppIcon';

// Cambiá esto por el link del evento de ejemplo que publiques (ej: '/evento/abc123').
// Por defecto manda a la cartelera, donde va a aparecer el evento demo.
const DEMO_EVENT_PATH = '/eventos';

const whatsappNumber = '5491171540675';
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hola!%20Vi%20la%20demo%20de%20ENTR%C3%81%20y%20quiero%20saber%20m%C3%A1s`;

const features = [
  { icon: Calendar, title: 'Eventos de varios días', desc: 'Festivales y ciclos multi-jornada. El asistente elige a qué días va. Un QR por día o un solo QR para todo el evento — vos decidís.' },
  { icon: DollarSign, title: 'Gratis o pago', desc: 'Cobrás con tarjeta o lo dejás como reserva sin cargo. Si es pago, vos cobrás el 100% — los costos los paga el comprador, a la vista.' },
  { icon: QrCode, title: 'QR único antifraude', desc: 'Cada entrada tiene un QR único que no se clona. Si la persona no puede ir, la transfiere de forma oficial y el QR anterior deja de existir.' },
  { icon: ScanLine, title: 'Control de acceso en la mano', desc: 'Validás en la puerta desde el celular: escáner de QR o búsqueda por apellido/DNI/mail. El ticket se quema y no se puede reusar.' },
  { icon: Mail, title: 'Mail + PDF de marca', desc: 'Al comprar, le llega el mail con el QR y el ticket en PDF, con tu estética. Profesional, no parece improvisado.' },
  { icon: Smartphone, title: 'Sin fricción', desc: 'El público compra en segundos, sin crearse cuenta. Pensado mobile-first, porque casi todos compran desde el celular.' },
];

const steps = [
  { n: '01', title: 'Creás tu evento', desc: 'Cargás fecha(s), horarios, entradas y precios (o lo dejás gratis). Listo en minutos.' },
  { n: '02', title: 'Compartís el link', desc: 'Tu público entra, elige los días y reserva o compra. Le llega el QR al instante.' },
  { n: '03', title: 'Controlás la puerta', desc: 'Escaneás los QR desde el celular en tiempo real. Sabés quién entró, cuándo y a qué jornada.' },
];

export default function Demo() {
  return (
    <div className="bg-[#09090b] text-foreground min-h-screen">

      {/* HERO */}
      <section className="relative pt-36 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block text-[10px] font-sans font-black tracking-[0.3em] uppercase text-primary mb-6">
              Demo · ENTRÁ
            </span>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-heading font-black tracking-tighter uppercase leading-[0.95]">
              La ticketera que<br /><span className="orange-text-gradient">controlás vos.</span>
            </h1>
            <p className="text-lg text-muted-foreground font-sans max-w-2xl mx-auto leading-relaxed mt-8">
              Vendé o reservá entradas, validá en la puerta y quedate con tu data y tu plata. Eventos de uno o varios días, gratis o pagos, con QR antifraude. Así funciona ENTRÁ:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
              <Link to={DEMO_EVENT_PATH} className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-14 px-10 orange-gradient border-none text-white rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                  Probar la demo en vivo
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto h-14 px-10 rounded-xl bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide gap-2.5">
                  <WhatsAppIcon className="w-5 h-5" />
                  Quiero ENTRÁ
                </Button>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="mb-12">
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">Qué incluye</span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase mt-5" style={{ lineHeight: '1.1' }}>
            Todo lo que necesitás<br />para tu evento.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <Card className="glass p-7 rounded-3xl border-white/5 h-full bg-white/[0.01]">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-black text-lg text-white uppercase tracking-tight mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-sans">{f.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-black py-24 border-y border-white/5 my-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-14">
            <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-sans">Cómo funciona</span>
            <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '1.1' }}>
              Tres pasos. Nada más.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-7 rounded-3xl bg-white/[0.02] border border-white/5">
                <span className="font-heading font-black text-4xl orange-text-gradient leading-none">{s.n}</span>
                <h3 className="font-heading font-black text-xl text-white uppercase tracking-tight mt-5 mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-sans">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PRUEBA EN VIVO */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <Card className="glass rounded-[2.5rem] border-white/10 p-10 md:p-14 text-center bg-white/[0.01]">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <Ticket className="w-8 h-8" />
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-black tracking-tighter uppercase text-white" style={{ lineHeight: '1.1' }}>
            Probalo vos mismo.
          </h2>
          <p className="text-muted-foreground font-sans leading-relaxed mt-5 max-w-xl mx-auto">
            Entrá a un evento de ejemplo, elegí tus días, reservá tu lugar y mirá cómo te llega el QR. Es la misma experiencia que va a tener tu público.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-xs text-muted-foreground font-sans">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Sin registro obligatorio</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> QR al instante</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Multi-día y gratis</span>
          </div>
          <div className="mt-10">
            <Link to={DEMO_EVENT_PATH}>
              <Button className="h-14 px-10 orange-gradient border-none text-white rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide">
                Abrir evento demo
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </Card>
      </section>

      {/* CONFIANZA */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: 'Antifraude', desc: 'QR único, no clonable, con transferencia oficial.' },
            { icon: Users, title: 'Tu data, tuya', desc: 'Quién compró, cuándo y a qué día. Exportable.' },
            { icon: DollarSign, title: 'Cobrás el 100%', desc: 'La comisión la paga el comprador, no vos.' },
          ].map((b, i) => (
            <div key={i} className="flex items-start gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <b.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-black text-white uppercase text-sm tracking-tight">{b.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-sans leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-black py-28 border-t border-white/5 text-center px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-heading font-black tracking-tighter uppercase text-white" style={{ lineHeight: '1.05' }}>
            ¿Lo querés para<br />tu evento?
          </h2>
          <p className="text-muted-foreground font-sans leading-relaxed mt-6 max-w-md mx-auto">
            Te lo dejamos andando en minutos. Escribinos y coordinamos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-16 px-12 orange-gradient border-none text-white text-lg rounded-xl transition-all hover:brightness-110 font-heading font-black uppercase tracking-wide gap-2.5">
                <WhatsAppIcon className="w-5 h-5" />
                Hablar por WhatsApp
              </Button>
            </a>
            <Link to="/productores" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-16 px-12 rounded-xl bg-white/[0.03] border border-white/10 text-white text-lg hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide">
                Ver para productores
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
