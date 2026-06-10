import { useEffect, useRef } from 'react';

/**
 * Atmósfera del hero: glows naranjas que respiran lento (aurora) + brasas
 * muy sutiles flotando hacia arriba. Pensado para sentirse "en vivo" sin
 * romper la estética: bajo contraste, naranja de marca, viñeta para que el
 * texto quede nítido. Respeta prefers-reduced-motion.
 */
export default function HeroAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type Ember = { x: number; y: number; r: number; vy: number; vx: number; a: number; tw: number; t: number };
    let embers: Ember[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(10, Math.min(22, Math.floor(w / 70)));
      embers = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        vy: -(0.04 + Math.random() * 0.15),
        vx: (Math.random() - 0.5) * 0.06,
        a: 0.05 + Math.random() * 0.16,
        tw: 0.6 + Math.random() * 1.1,
        t: Math.random() * Math.PI * 2,
      }));
    };
    resize();

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.shadowColor = 'rgba(255,92,0,0.45)';
      ctx.shadowBlur = 5;
      for (const e of embers) {
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        e.t += 0.002 * dt;
        if (e.y < -12) { e.y = h + 12; e.x = Math.random() * w; }
        if (e.x < -12) e.x = w + 12;
        else if (e.x > w + 12) e.x = -12;
        const tw = (Math.sin(e.t * e.tw) + 1) / 2;
        const alpha = e.a * (0.35 + 0.65 * tw);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 122, 40, ${alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <style>{`
        @keyframes entraDriftA { 0%,100%{ transform: translate3d(-5%,-3%,0) scale(1);} 50%{ transform: translate3d(4%,3%,0) scale(1.12);} }
        @keyframes entraDriftB { 0%,100%{ transform: translate3d(5%,2%,0) scale(1.06);} 50%{ transform: translate3d(-4%,-3%,0) scale(0.96);} }
        .entra-aurora { position:absolute; border-radius:9999px; filter: blur(72px); will-change: transform; }
        @media (prefers-reduced-motion: reduce){ .entra-aurora{ animation:none !important; } }
      `}</style>

      <div
        className="entra-aurora"
        style={{
          top: '-12%', left: '6%', width: '46vw', height: '46vw',
          background: 'radial-gradient(circle, rgba(255,92,0,0.16), rgba(255,92,0,0) 70%)',
          animation: 'entraDriftA 28s ease-in-out infinite',
        }}
      />
      <div
        className="entra-aurora"
        style={{
          bottom: '-18%', right: '2%', width: '42vw', height: '42vw',
          background: 'radial-gradient(circle, rgba(255,92,0,0.10), rgba(255,92,0,0) 70%)',
          animation: 'entraDriftB 34s ease-in-out infinite',
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(9,9,11,0) 42%, rgba(9,9,11,0.55) 100%)' }}
      />
    </div>
  );
}
