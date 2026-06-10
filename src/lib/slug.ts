// Genera URLs lindas con el nombre del evento, sin necesidad de guardar un campo
// nuevo ni tocar reglas: la URL es `nombre-del-evento-<docId>` y la página extrae
// el id del final. Los links viejos (solo id) siguen funcionando.

export function slugify(input: string): string {
  const noAccents = (input || 'evento')
    .toString()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), ''); // quitar acentos
  const base = noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base || 'evento';
}

// Path público del evento: /evento/nombre-del-evento-<id>
export function eventPath(event: { id: string; title?: string } | null | undefined): string {
  if (!event || !event.id) return '/eventos';
  const s = slugify(event.title || 'evento');
  return `/evento/${s}-${event.id}`;
}

// Dado el parámetro de la URL (slug-id o id puro), devuelve el docId real.
// Los IDs de Firestore no contienen guiones, así que el id es siempre el último segmento.
export function resolveEventId(param: string | undefined): string {
  if (!param) return '';
  const parts = param.split('-');
  return parts[parts.length - 1] || param;
}
