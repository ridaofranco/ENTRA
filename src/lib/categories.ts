import {
  Music, Mic2, PartyPopper, Disc3, Drama, Laugh, Trophy,
  Presentation, UtensilsCrossed, Palette, Baby, Tag, type LucideIcon
} from 'lucide-react';

export interface EventCategory {
  value: string;   // se guarda en event.category
  label: string;   // se muestra
  icon: LucideIcon;
}

// Categorías canónicas de ENTRÁ. El valor se guarda en el evento y alimenta el filtro.
export const EVENT_CATEGORIES: EventCategory[] = [
  { value: 'Música',        label: 'Música',            icon: Music },
  { value: 'Recital',       label: 'Recital',           icon: Mic2 },
  { value: 'Festival',      label: 'Festival',          icon: PartyPopper },
  { value: 'Fiesta',        label: 'Fiesta / Electrónica', icon: Disc3 },
  { value: 'Teatro',        label: 'Teatro',            icon: Drama },
  { value: 'Stand Up',      label: 'Stand Up / Comedia', icon: Laugh },
  { value: 'Deporte',       label: 'Deporte',           icon: Trophy },
  { value: 'Conferencia',   label: 'Conferencia / Charla', icon: Presentation },
  { value: 'Gastronomía',   label: 'Gastronomía',       icon: UtensilsCrossed },
  { value: 'Arte',          label: 'Arte y Cultura',    icon: Palette },
  { value: 'Infantil',      label: 'Infantil',          icon: Baby },
  { value: 'Otros',         label: 'Otros',             icon: Tag },
];

export const CATEGORY_VALUES = EVENT_CATEGORIES.map(c => c.value);

export function getCategoryIcon(value?: string): LucideIcon {
  const found = EVENT_CATEGORIES.find(c => c.value === value);
  return found ? found.icon : Tag;
}

export function getCategoryLabel(value?: string): string {
  const found = EVENT_CATEGORIES.find(c => c.value === value);
  return found ? found.label : (value || 'Otros');
}
