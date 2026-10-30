import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITIO, metaDeRuta } from '@/src/lib/routeMeta';

// Pone título, descripción, canonical y robots de cada ruta (tabla en src/lib/routeMeta.ts).
// Antes todas las pantallas de la app compartían el título de la home y no tenían canonical.
function setMeta(selector: string, crear: () => HTMLElement, attr: string, valor: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (valor === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = crear();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, valor);
}

export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = metaDeRuta(pathname);
    document.title = meta.title;
    setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', meta.description);
    const canonical = meta.noindex ? null : SITIO + (meta.canonical ?? pathname.replace(/\/+$/, ''));
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', canonical);
    setMeta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', meta.noindex ? 'noindex' : null);
  }, [pathname]);

  return null;
}
