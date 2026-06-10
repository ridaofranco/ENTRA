import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export interface LegalSection {
  heading: string;
  body: string[]; // cada string es un párrafo
}

interface LegalPageProps {
  kicker: string;
  title: string;
  highlight: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}

export default function LegalPage({ kicker, title, highlight, intro, updated, sections }: LegalPageProps) {
  return (
    <div className="pb-24 pt-32 bg-[#09090b] text-foreground min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-60 pointer-events-none z-0" />

      <div className="max-w-3xl mx-auto px-6 relative z-10">
        <div className="mb-14">
          <span className="block text-[10px] font-sans font-bold tracking-[0.3em] uppercase text-primary">
            {kicker}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black tracking-tighter uppercase mt-5" style={{ lineHeight: '1.05' }}>
            {title} <span className="orange-text-gradient">{highlight}</span>
          </h1>
          <p className="text-base text-muted-foreground/80 font-sans leading-relaxed mt-6">{intro}</p>
          <p className="text-xs text-muted-foreground/60 font-sans mt-4 uppercase tracking-widest">Última actualización: {updated}</p>
        </div>

        <div className="space-y-10">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-heading font-black uppercase tracking-tight text-white mb-3">
                <span className="text-primary mr-2">{String(i + 1).padStart(2, '0')}</span>{s.heading}
              </h2>
              <div className="space-y-3">
                {s.body.map((p, j) => (
                  <p key={j} className="text-sm text-muted-foreground leading-relaxed font-sans">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground/60 font-sans">¿Dudas sobre estos términos? Escribinos.</p>
          <Link to="/contacto">
            <Button variant="outline" className="h-12 px-7 rounded-xl bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06] hover:border-white/20 transition-all font-heading font-black uppercase tracking-wide text-xs">
              Contacto
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
