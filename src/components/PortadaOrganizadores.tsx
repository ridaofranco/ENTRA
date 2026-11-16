import { PORTADA, type Enlace } from '@/src/lib/portada';

// Bloque para quien organiza: qué es ENTRÁ, cómo se cobra, pasos, tipos de evento, ciudades y
// preguntas frecuentes. El texto vive en src/lib/portada.ts, que también usa el build para
// escribir el mismo contenido en el HTML (buscadores e IA que no corren JavaScript).
// Sin animaciones de entrada a propósito: un bloque que arranca en opacidad 0 no lo lee un
// buscador si no llega a hacer scroll.
// Los destinos son páginas estáticas de public/ (guías y blog): van con <a>, no con <Link>.

const kicker = 'block text-[10px] font-bold text-primary uppercase tracking-[0.2em] font-sans';
const h3 = 'font-heading font-black text-lg text-white uppercase tracking-tight';
const tarjeta = 'rounded-3xl border border-white/5 bg-white/[0.01] p-6 md:p-8';
const enlace = 'text-primary hover:underline';

function Chips({ items }: { items: Enlace[] }) {
  return (
    <ul className="flex flex-wrap gap-2 mt-5">
      {items.map((e) => (
        <li key={e.href}>
          <a
            href={e.href}
            className="inline-block rounded-full border border-white/10 px-3.5 py-2 text-sm font-sans text-white/80 hover:border-primary/40 hover:text-primary transition-colors"
          >
            {e.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Tipos de evento, ciudades y guías: los enlaces a /vender-entradas y sus páginas. */
function EnlacesVender() {
  const p = PORTADA;
  return (
    <>
      <div>
        <h3 className={h3}>{p.tiposTitulo}</h3>
        <Chips items={p.tipos} />
      </div>

      <div>
        <h3 className={h3}>{p.ciudadesTitulo}</h3>
        <p className="text-sm text-muted-foreground font-sans leading-loose mt-4">
          {p.ciudadesIntro}{' '}
          {p.ciudades.map((c, i) => (
            <span key={c.href}>
              <a href={c.href} className="text-white/80 hover:text-primary transition-colors">{c.texto}</a>
              {i < p.ciudades.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      </div>

      <div>
        <h3 className={h3}>{p.guiasTitulo}</h3>
        <ul className="mt-4 space-y-2.5 text-sm font-sans">
          {p.guias.map((g) => (
            <li key={g.href}>
              <a href={g.href} className={enlace}>{g.texto} &rarr;</a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function PortadaOrganizadores({ variante }: { variante: 'home' | 'productores' }) {
  const p = PORTADA;

  if (variante === 'productores') {
    return (
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-white/5 space-y-12">
        <EnlacesVender />
      </section>
    );
  }

  return (
    <section className="border-t border-white/5 bg-[#0b0b0d] px-6 py-20">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="max-w-3xl">
          <span className={kicker}>{p.kicker}</span>
          <h2 className="text-3xl md:text-5xl font-heading font-black tracking-tighter uppercase text-white mt-5" style={{ lineHeight: '1.15' }}>
            {p.titulo}
          </h2>
          <p className="text-muted-foreground font-sans text-base leading-relaxed mt-6">{p.intro}</p>
          <p className="mt-5 text-sm font-sans">
            <a href={p.enlaceVender.href} className={enlace}>{p.enlaceVender.texto} &rarr;</a>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={tarjeta}>
            <h3 className={h3}>{p.cobroTitulo}</h3>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground font-sans leading-relaxed">
              {p.cobro.map((c) => (
                <li key={c} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={tarjeta}>
            <h3 className={h3}>{p.pasosTitulo}</h3>
            <ol className="mt-5 space-y-3 text-sm text-muted-foreground font-sans leading-relaxed">
              {p.pasos.map((paso, i) => (
                <li key={paso} className="flex gap-3">
                  <span className="font-heading font-black text-primary w-5 flex-shrink-0">{i + 1}</span>
                  <span>{paso}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm font-sans">
              <a href={p.enlacePasos.href} className={enlace}>{p.enlacePasos.texto} &rarr;</a>
            </p>
          </div>
        </div>

        <div>
          <h3 className={h3}>{p.incluyeTitulo}</h3>
          <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5 text-sm text-muted-foreground font-sans">
            {p.incluye.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <EnlacesVender />

        <div className="max-w-3xl">
          <h3 className={h3}>{p.preguntasTitulo}</h3>
          <div className="mt-4 border-t border-white/10">
            {p.preguntas.map((f) => (
              <details key={f.q} className="border-b border-white/10 py-4 group">
                <summary className="cursor-pointer font-heading font-bold text-base text-white marker:text-primary">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-muted-foreground font-sans leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
