import * as React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Mail, MessageSquare, Instagram, Twitter, MapPin, Send } from 'lucide-react';

export default function Contact() {
  return (
    <div className="pt-40 pb-20 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
        {/* Left: Info */}
        <div className="space-y-12">
          <div>
            <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tighter uppercase mb-6">
              Hablemos de tu <span className="orange-text-gradient">Próximo Evento</span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Estamos acá para ayudarte a que tu evento sea un éxito. Escribinos y nuestro equipo se pondrá en contacto con vos en menos de 24hs.
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-6 group">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Email Directo</div>
                <a href="mailto:contacto@somosder.com.ar" className="text-xl font-bold hover:text-primary transition-colors">contacto@somosder.com.ar</a>
              </div>
            </div>

            <div className="flex items-center gap-6 group">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Oficinas</div>
                <div className="text-xl font-bold">Palermo Soho, CABA, Argentina</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {[Instagram, Twitter].map((Icon, i) => (
              <Button key={i} variant="outline" size="icon" className="w-14 h-14 rounded-2xl border-white/10 hover:border-primary hover:text-primary transition-all">
                <Icon className="w-6 h-6" />
              </Button>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <Card className="glass p-10 rounded-[3rem] border-white/5">
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre</label>
                <Input placeholder="Tu nombre" className="bg-white/5 border-white/10 h-14 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</label>
                <Input type="email" placeholder="tu@email.com" className="bg-white/5 border-white/10 h-14 rounded-2xl" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Asunto</label>
              <Input placeholder="¿En qué podemos ayudarte?" className="bg-white/5 border-white/10 h-14 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mensaje</label>
              <Textarea placeholder="Contanos más detalles..." className="bg-white/5 border-white/10 min-h-[150px] rounded-2xl" />
            </div>
            <Button className="w-full h-16 orange-gradient border-none font-bold text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all">
              <Send className="w-5 h-5 mr-2" />
              Enviar Mensaje
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
