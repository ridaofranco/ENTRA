import { cn } from '@/src/lib/utils';
import { useLang, setLang, type Lang } from '@/src/lib/i18n';

/**
 * Switcher discreto ES/EN para el header y footer públicos. El idioma queda
 * guardado en localStorage (`entra_lang`) y todas las pantallas del flujo de
 * compra re-renderizan al instante vía useLang().
 */
export function LangSwitcher({ className }: { className?: string }) {
  const lang = useLang();

  const boton = (l: Lang, label: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={cn(
        'px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest transition-colors',
        lang === l ? 'text-primary' : 'text-muted-foreground hover:text-white'
      )}
    >
      {label}
    </button>
  );

  return (
    <div className={cn('flex items-center font-sans select-none', className)}>
      {boton('es', 'ES')}
      <span className="text-white/20 text-[10px]">/</span>
      {boton('en', 'EN')}
    </div>
  );
}
