import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, Mail, ShieldCheck, Ticket, Sparkles, HelpCircle } from 'lucide-react';
import { WhatsAppIcon } from '@/src/components/icons/WhatsAppIcon';

const whatsappNumber = '5491171540675';
const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hola!%20Necesito%20ayuda%20con%20una%20entrada%20de%20ENTRÁ`;

const faqs = [
  { 
    q: '¿Cómo entro a mi evento?', 
    a: 'Con el QR de tu entrada, que podés mostrar directo desde tu celular. Lo tenés siempre disponible en tu mail de confirmación, WhatsApp, o ingresando directamente con tu acceso a ENTRÁ.' 
  },
  { 
    q: 'No me llegó la entrada, ¿qué hago?', 
    a: 'La entrega de las entradas por mail y WhatsApp es inmediata. Si no la ves en tu bandeja, revisá siempre la carpeta de Spam o Correo no deseado. Si pasaron más de 10 minutos o ingresaste mal tu correo, contactanos por WhatsApp con tu nombre y DNI, y te la re-enviamos al toque.' 
  },
  { 
    q: '¿Puedo transferir mi entrada a un amigo?', 
    a: 'Sí, de forma 100% oficial y segura desde tu sección de perfil. Cuando transferís una entrada por ENTRÁ, el sistema invalida tu código anterior y genera un QR totalmente nuevo para tu amigo. Se terminaron los engaños de la reventa con PDFs duplicados.' 
  },
  { 
    q: '¿Qué métodos de pago puedo usar?', 
    a: 'Podés pagar de forma segura con dinero en cuenta, transferencia, tarjetas de débito o crédito a través de Mercado Pago. El precio final es siempre claro, sin sorpresas de cargos ocultos al checkout.' 
  },
  { 
    q: 'Soy organizador, ¿cómo publico un evento?', 
    a: 'Es extremadamente fácil. Escribinos a organizadores@entratickets.com o mandanos un mensaje por WhatsApp. Te activamos tu cuenta oficial para empezar a emitir entradas, trackear ventas en tiempo real y gestionar la permanencia en segundos.' 
  }
];

export default function Ayuda() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="pb-24 pt-32 bg-[#09090b] text-foreground min-h-screen relative overflow-hidden">
      {/* Background visual support */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        
        {/* Hero Section */}
        <div className="text-center mb-20">
          <span className="block text-[10px] font-sans font-bold tracking-[0.3em] uppercase text-primary">
            SOPORTE OFICIAL · ENTRÁ
          </span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-heading font-black tracking-tighter uppercase mt-6" style={{ lineHeight: '1.05' }}>
            Resolución <span className="orange-text-gradient">al toque.</span>
          </h1>
          <p className="text-lg text-muted-foreground/80 font-sans max-w-xl mx-auto leading-relaxed mt-8">
            Sin bots automáticos que repiten lo mismo sin entender nada. Detrás de ENTRÁ hay personas reales listas para resolver tus consultas sobre accesos.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto h-14 px-8 orange-gradient border-none text-white font-heading font-black text-xs uppercase tracking-wide rounded-xl transition-all hover:brightness-110 flex items-center justify-center gap-2.5">
                <WhatsAppIcon className="w-4 h-4" />
                WhatsApp Directo
              </Button>
            </a>
            <a href="mailto:soporte@entratickets.com" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-14 px-8 bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.06] text-white font-heading font-black text-xs uppercase tracking-wide rounded-xl transition-all flex items-center justify-center gap-2.5">
                <Mail className="w-4 h-4 text-primary" />
                Soporte por Mail
              </Button>
            </a>
          </div>
        </div>

        {/* Benefits banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            {
              icon: <ShieldCheck className="w-5 h-5 text-primary" />,
              title: "Transparencia Total",
              desc: "Compras 100% encriptadas y directas. Sin intermediarios ni comisiones fantasma."
            },
            {
              icon: <Ticket className="w-5 h-5 text-primary" />,
              title: "QR Auténtico",
              desc: "Acceso intransferible e incorruptible. Tu pase oficial se convalida al ingreso."
            },
            {
              icon: <Sparkles className="w-5 h-5 text-primary" />,
              title: "Transferencias",
              desc: "Pasale la entrada a cualquier mail de forma automática. El sistema invalida el QR viejo."
            }
          ].map((item, i) => (
            <Card key={i} className="border border-white/5 bg-white/[0.01] rounded-3xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                {item.icon}
              </div>
              <h4 className="font-heading font-black text-sm uppercase text-white tracking-wider">{item.title}</h4>
              <p className="text-xs text-muted-foreground/85 leading-relaxed font-sans">{item.desc}</p>
            </Card>
          ))}
        </div>

        {/* FAQs */}
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2 mb-10">
            <HelpCircle className="w-6 h-6 text-primary mx-auto mb-2 opacity-50" />
            <h2 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight">
              Preguntas Frecuentes
            </h2>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-sans font-bold">
              Las consultas más usuales respondidas claro
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div key={idx} className="group">
                  <Card className={`rounded-[1.5rem] overflow-hidden border transition-all ${isOpen ? 'border-[#ff5c00]/30 bg-white/[0.02]' : 'border-white/5 bg-white/[0.01] hover:border-white/10'}`}>
                    <button
                      onClick={() => setOpenIdx(isOpen ? null : idx)}
                      className="w-full text-left p-6 flex justify-between items-center gap-4 hover:bg-white/[0.01] transition-colors focus:outline-none"
                    >
                      <span className="font-heading font-black text-sm sm:text-base uppercase tracking-tight text-white">{faq.q}</span>
                      <ChevronDown className={`w-5 h-5 text-primary transition-transform flex-shrink-0 duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                        >
                          <div className="px-6 pb-6 pt-1 border-t border-white/5 text-muted-foreground/90 leading-relaxed font-sans text-xs sm:text-sm">
                            <p>{faq.a}</p>
                            {faq.q.includes('organizador') && (
                              <div className="mt-4">
                                <Link to="/productores" className="text-primary hover:underline font-heading font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                                  Sección Productores &rarr;
                                </Link>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="max-w-2xl mx-auto text-center mt-20 p-8 border border-white/5 bg-white/[0.01] rounded-[2rem] space-y-4">
          <p className="text-xs font-sans tracking-[0.2em] font-extrabold uppercase text-primary">¿No encontraste lo que buscabas?</p>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans max-w-md mx-auto">
            Mandanos capturas o el mail con el que compraste, te resolvemos el problema en minutos. Te esperamos adentro.
          </p>
          <div className="pt-2">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-11 px-6 bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 text-xs font-heading font-black uppercase tracking-wide rounded-xl transition-all">
                Contactar a soporte en directo
              </Button>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
