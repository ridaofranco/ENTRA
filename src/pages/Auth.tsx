import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Github, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Auth() {
  return (
    <div className="min-h-screen flex items-center justify-center pt-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-primary/20 group-hover:scale-110 transition-transform">
              E
            </div>
            <span className="font-heading font-black text-3xl tracking-tighter">
              ENTR<span className="text-primary">Á</span>
            </span>
          </Link>
          <h1 className="text-2xl font-heading font-bold mb-2">Bienvenido de nuevo</h1>
          <p className="text-muted-foreground">Gestioná tus eventos y entradas desde un solo lugar.</p>
        </div>

        <Card className="glass p-8 rounded-[2.5rem] border-white/10 shadow-2xl">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 rounded-xl mb-8">
              <TabsTrigger value="login" className="rounded-lg font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                Ingresar
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                Registrarse
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="tu@email.com" className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contraseña</label>
                    <button className="text-[10px] font-bold text-primary uppercase hover:underline">¿Olvidaste tu contraseña?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••••••" className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50" />
                  </div>
                </div>
              </div>

              <Button className="w-full h-14 orange-gradient border-none font-black text-lg rounded-xl shadow-lg shadow-primary/20">
                Iniciar Sesión
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-transparent px-4 text-muted-foreground">O continuar con</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-12 border-white/10 hover:border-primary/50 rounded-xl font-bold">
                  <Github className="w-4 h-4 mr-2" />
                  Google
                </Button>
                <Button variant="outline" className="h-12 border-white/10 hover:border-primary/50 rounded-xl font-bold">
                  <User className="w-4 h-4 mr-2" />
                  Apple
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="register" className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Franco Ridao" className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="tu@email.com" className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Mínimo 8 caracteres" className="bg-white/5 border-white/10 h-12 pl-12 rounded-xl focus:ring-primary/50" />
                  </div>
                </div>
              </div>

              <Button className="w-full h-14 orange-gradient border-none font-black text-lg rounded-xl shadow-lg shadow-primary/20">
                Crear Cuenta
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>

              <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold px-4">
                Al registrarte, aceptás nuestros <a href="#" className="text-primary hover:underline">Términos de Servicio</a> y <a href="#" className="text-primary hover:underline">Privacidad</a>.
              </p>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </div>
  );
}
