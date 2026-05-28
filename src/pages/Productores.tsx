import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Smartphone, Check, Lock, ChevronDown,
  BarChart3, HelpCircle, ArrowRight, Layers
} from 'lucide-react';
import { WhatsAppIcon } from '@/src/components/icons/WhatsAppIcon';

const whatsappNumber = '5491171540675';
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hola!%20Quiero%20vender%20mis%20eventos%20con%20ENTRÁ`;

// Real-time door control logs mockup simulation
const initialLogs = [
  { id: '1', name: 'Facundo R.', ticket: 'ENTRÁ-0491', status: 'VALIDADO', time: 'hace 2s' },
  { id: '2', name: 'Martina G.', ticket: 'ENTRÁ-1280', status: 'VALIDADO', time: 'hace 15s' },
  { id: '3', name: 'Julián M.', ticket: 'ENTRÁ-0922', status: 'VALIDADO', time: 'hace 45s' },
];

export default function Productores() {
  const [logs, setLogs] = useState(initialLogs);

  // Simple clean simulation of alive logs for B2B feeling
  useEffect(() => {
    const timer = setInterval(() => {
      const names = ['Sofía L.', 'Valentin P.', 'Camila T.', 'Lucas M.', 'Felipe N.', 'Clara S.'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomTicket = `ENTRÁ-${Math.floor(1000 + Math.random() * 9000)}`;
      
      setLogs(prev => [
        { 
          id: Date.now().toString(), 
          name: randomName, 
          ticket: randomTicket, 
          status: 'VALIDADO', 
          time: 'ahora' 
        },
        ...prev.slice(0, 3)
      ]);
    }, 7000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#09090b] text-foreground min-h-screen pb-20 pt-28">
      {/* 1. HERO — Technical, operational & premium */}
      <section className="max-w-7xl mx-auto px-6 mb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left info column */}
          <div className="lg:col-span-7">
            <span className="block text-[10px] font-sans font-black tracking-[0.3em] uppercase text-primary">
              PARA PRODUCTORES
            </span>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '0.9' }}>
              Control total <br />
              <span className="orange-text-gradient">del acceso.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground font-sans max-w-xl leading-relaxed mt-8">
              Cobrás el 100% de cada entrada, validás en la puerta en tiempo real y tu data es tuya. Sin intermediarios ni trabas de setup.
            </p>

            <div className="flex flex-wrap gap-4 mt-8">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button className="h-14 px-10 orange-gradient border-none font-bold text-lg rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform font-sans uppercase tracking-wider">
                  Producir con ENTRÁ
                </Button>
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="h-14 px-10 rounded-xl border-white/10 font-bold text-lg hover:bg-white/5 transition-colors font-sans gap-2 text-white">
                  <WhatsAppIcon className="w-5 h-5" />
                  Hablar por WhatsApp
                </Button>
              </a>
            </div>
          </div>
          {/* Right visual terminal simulation column (Operation real - scan counts) */}
          <div className="lg:col-span-5">
            <div className="glass rounded-[2rem] border-white/10 p-6 relative overflow-hidden bg-white/[0.01]">
              <div className="flex justify-between items-center pb-4 border-b border-white/5 mb-6">
                <div>
                  <h4 className="font-heading font-bold uppercase text-xs tracking-wider text-white">CONTROL DE PUERTA</h4>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">PUERTA 1 · DISPOSITIVOS ACTIVOS</p>
                </div>
                <Badge className="bg-primary/10 text-primary border-primary/20 uppercase tracking-widest text-[9px] font-mono">
                  Sincronizado
                </Badge>
              </div>

              {/* Metrics visualizer block */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-sans font-bold">Acreditados</p>
                  <p className="text-3xl font-heading font-black text-white mt-1">128</p>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-sans font-bold">Capacidad</p>
                  <p className="text-3xl font-heading font-black text-primary mt-1">64%</p>
                </div>
              </div>

              {/* Dynamic checkins logs feed */}
              <div className="space-y-3">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono font-bold mb-1">Registro en vivo:</p>
                <div className="divide-y divide-white/5 font-mono text-xs">
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <div>
                            <p className="font-bold text-white leading-none mb-1">{log.name}</p>
                            <p className="text-[9px] text-muted-foreground/60">{log.ticket}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-950/20 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {log.status}
                          </span>
                          <p className="text-[8px] text-muted-foreground/40 mt-1">{log.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUÉ TE DA (concreto, sin épica) */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-white/5">
        <div className="mb-16">
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans">Propuesta de Valor</span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '1.15' }}>
            Infraestructura para operar sin fallas.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "Control de acceso en tiempo real.",
              desc: "Escaneás cada QR en la puerta desde el celular. Validás una vez. Sabés quién entró y cuándo."
            },
            {
              title: "Menos fraude.",
              desc: "QR único por entrada que se invalida al transferirse. No se clona, no se revende trucho."
            },
            {
              title: "Cobros claros.",
              desc: "Vos cobrás el 100% de tu precio. Los costos los paga el comprador, a la vista, sin sorpresas."
            },
            {
              title: "Tu data, tuya.",
              desc: "Quién compró, cuándo y qué. Exportable. No queda atrapada en la ticketera del evento."
            },
            {
              title: "Todo en un solo lugar.",
              desc: "Crear evento, cupos, descuentos, cortesías, control de puerta. Simple y sin vueltas."
            },
            {
              title: "Tu marca, no la nuestra.",
              desc: "White Label premium. Tus compradores te compran a vos directo, reforzando tu propia identidad."
            }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass p-8 rounded-3xl border-white/5 hover:border-primary/20 transition-all duration-300 h-full flex flex-col justify-between space-y-6 bg-white/[0.01]">
                <div className="space-y-4">
                  <h3 className="font-heading font-black text-xl text-white uppercase tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                    {item.desc}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 3. CÓMO EMPEZÁS (Vertical, clean step design, high background contrast) */}
      <section className="bg-black py-24 border-y border-white/5 my-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-sans">PROCESO</span>
            <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '1.15' }}>
              Cómo empezás.
            </h2>
            <p className="text-muted-foreground font-sans text-sm max-w-sm leading-relaxed mt-6">
              Diseñado para no perder tiempo en setups complejos ni llamadas eternas. Arrancás y listo.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {[
              "Te creamos tu cuenta de organizador.",
              "Cargás tu evento.",
              "Compartís el link — tu público compra sin crearse cuenta.",
              "Cobrás y controlás la puerta."
            ].map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-6 items-start p-6 rounded-2xl bg-white/[0.01] border border-white/5"
              >
                <span className="font-heading font-black text-4xl text-primary leading-none">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <p className="font-heading font-bold text-lg md:text-xl text-white pt-1">
                  {step}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PRECIOS EXPLICADO & BENEFICIOS LISTS (Clean, transparent, premium) */}
      <section className="max-w-7xl mx-auto px-6 py-16 space-y-16">
        <div className="text-center max-w-2xl mx-auto">
          <span className="block text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-sans">CONTRATO CLARO</span>
          <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '1.15' }}>
            Vos cobrás el 100%. Siempre.
          </h2>
          <p className="text-muted-foreground font-sans text-sm leading-relaxed mt-6">
            Sin costos ocultos ni cargos sorpresa. El precio que fijás es el que recibís en tu bolsillo, limpio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Prices visual layout */}
          <Card className="glass p-8 rounded-3xl border-white/5 bg-white/[0.01] space-y-6">
            <h3 className="text-lg font-heading font-bold text-primary uppercase tracking-wider">
              Estructura Transparente
            </h3>
            <ul className="space-y-4 text-sm text-muted-foreground font-sans font-medium">
              <li className="flex gap-3 items-start">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span><strong>El organizador cobra el 100%:</strong> Ponés tu entrada al precio que querés y recibís ese precio exacto, completo. La comisión no sale de tu bolsillo.</span>
              </li>
              <li className="flex gap-3 items-start">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span><strong>El comprador ve todo antes de pagar:</strong> Los costos de servicio y procesamiento los paga el comprador, con el desglose a la vista en el checkout. Cero cargos sorpresa.</span>
              </li>
              <li className="flex gap-3 items-start">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span><strong>Sin sorpresas, sin letra chica:</strong> Lo que ve el comprador es lo que paga. Lo que ponés vos es lo que cobrás.</span>
              </li>
            </ul>
          </Card>

          {/* Included Features layout */}
          <Card className="glass p-8 rounded-3xl border-white/5 bg-white/[0.01] space-y-6">
            <h3 className="text-lg font-heading font-bold text-primary uppercase tracking-wider font-sans">
              Qué incluye, sin costo extra
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground font-sans">
              {[
                "Publicación ilimitada",
                "Emisión de QR libre",
                "Control de acceso integrado",
                "Stock en vivo y real",
                "Descuentos y cortesías",
                "Transferencia oficial",
                "Exportar base de datos",
                "Soporte por WhatsApp"
              ].map((feat, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 5. CTA — minimal, bold, huge text */}
      <section className="bg-black py-32 border-t border-white/5 text-center px-6">
        <div className="max-w-4xl mx-auto">
          <Badge className="orange-gradient border-none font-bold uppercase tracking-widest text-[10px] px-4 py-1.5 font-sans">
            COMENZAR AHORA
          </Badge>
          <h2 className="text-4xl md:text-6xl font-heading font-black tracking-tighter uppercase text-white mt-6" style={{ lineHeight: '1.15' }}>
            Producí con ENTRÁ.
          </h2>
          <p className="text-muted-foreground font-sans text-sm max-w-md mx-auto leading-relaxed mt-6">
            Te creamos tu cuenta de organizador sin costo. Cobrás el 100% neto de cada entrada desde el primer día.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button className="h-16 px-10 orange-gradient border-none font-bold text-lg rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform font-sans uppercase tracking-[0.1em]">
                Quiero vender entradas
              </Button>
            </a>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="h-16 px-10 rounded-xl border-white/10 font-bold text-lg hover:bg-white/5 transition-colors font-sans gap-2 text-white">
                <WhatsAppIcon className="w-5 h-5" />
                Hablar por WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
