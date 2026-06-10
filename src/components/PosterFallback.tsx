/**
 * Fondo de marca para eventos sin flyer cargado. Evita que la tarjeta o el
 * banner se vean negros/rotos: glow naranja sutil + logo oficial tenue.
 */
export default function PosterFallback({ className = '' }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      style={{
        background:
          'radial-gradient(ellipse at 50% 28%, rgba(255,92,0,0.18), rgba(9,9,11,0) 62%), linear-gradient(180deg, #151517 0%, #0a0a0b 100%)',
      }}
      aria-hidden="true"
    >
      <img
        src="/entra-logo.png"
        alt=""
        className="w-1/2 max-w-[180px] opacity-[0.12] select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
}
