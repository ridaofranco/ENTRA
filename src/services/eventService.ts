import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp, query, limit, where } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

export const demoEvents = [
  {
    title: 'Bresh — La Fiesta Más Linda del Mundo',
    description: 'Vuelve la Bresh a Buenos Aires. Una noche de hits, glitter y la mejor energía.',
    date: Timestamp.fromDate(new Date('2026-04-18T21:00:00')),
    venue: 'GEBA Sede Jorge Newbery',
    location: 'Palermo, CABA',
    category: 'Festivales',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=600&fit=crop',
    price: 45000,
    tickets: [
      { type: 'General', price: 45000, available: 2000 },
      { type: 'VIP', price: 85000, available: 500 },
    ],
    status: 'active',
    organizerId: 'demo',
    organizerName: 'DER Producciones',
    organizerEmail: 'ridaofrancorg@gmail.com',
    ticketsSold: 0,
    totalRevenue: 0,
  },
  {
    title: 'Divididos — 35 Años',
    description: 'Divididos celebra 35 años de rock argentino con un show histórico.',
    date: Timestamp.fromDate(new Date('2026-05-22T20:30:00')),
    venue: 'Estadio Obras Sanitarias',
    location: 'Núñez, CABA',
    category: 'Música',
    image: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&h=600&fit=crop',
    price: 35000,
    tickets: [
      { type: 'Campo', price: 35000, available: 5000 },
      { type: 'Platea Alta', price: 55000, available: 2000 },
      { type: 'Platea Baja', price: 75000, available: 1000 },
    ],
    status: 'active',
    organizerId: 'demo',
    organizerName: 'DER Producciones',
    organizerEmail: 'ridaofrancorg@gmail.com',
    ticketsSold: 0,
    totalRevenue: 0,
  },
  {
    title: 'Cazzu — Nena Trampa Tour',
    description: 'Cazzu presenta su nuevo tour en Buenos Aires. Trap, flow y actitud.',
    date: Timestamp.fromDate(new Date('2026-06-14T21:00:00')),
    venue: 'Movistar Arena',
    location: 'Villa Crespo, CABA',
    category: 'Música',
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=600&fit=crop',
    price: 40000,
    tickets: [
      { type: 'General', price: 40000, available: 3000 },
      { type: 'VIP', price: 90000, available: 800 },
    ],
    status: 'active',
    organizerId: 'demo',
    organizerName: 'DER Producciones',
    organizerEmail: 'ridaofrancorg@gmail.com',
    ticketsSold: 0,
    totalRevenue: 0,
  },
  {
    title: 'Noche Electrónica — Vol. 12',
    description: 'La mejor música electrónica con DJs internacionales. Techno, house y más.',
    date: Timestamp.fromDate(new Date('2026-04-15T23:00:00')),
    venue: 'Mandarine Park',
    location: 'Costanera Norte, CABA',
    category: 'Festivales',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=600&fit=crop',
    price: 8500,
    tickets: [
      { type: 'Early Bird', price: 8500, available: 500 },
      { type: 'General', price: 15000, available: 2000 },
      { type: 'VIP', price: 35000, available: 300 },
    ],
    status: 'active',
    organizerId: 'demo',
    organizerName: 'DER Producciones',
    organizerEmail: 'ridaofrancorg@gmail.com',
    ticketsSold: 0,
    totalRevenue: 0,
  },
];

/**
 * Removes duplicate events (same title appearing more than once).
 * Keeps the first occurrence, deletes the rest.
 */
export async function cleanupDuplicateEvents(): Promise<number> {
  try {
    const snapshot = await getDocs(collection(db, 'events'));
    const seen = new Map<string, string>(); // title -> first doc ID
    const toDelete: string[] = [];

    snapshot.docs.forEach((d) => {
      const title = d.data().title;
      if (seen.has(title)) {
        toDelete.push(d.id); // Duplicate — mark for deletion
      } else {
        seen.set(title, d.id);
      }
    });

    for (const id of toDelete) {
      await deleteDoc(doc(db, 'events', id));
    }

    if (toDelete.length > 0) {
      console.log(`[eventService] Cleaned up ${toDelete.length} duplicate event(s).`);
    }
    return toDelete.length;
  } catch (error) {
    console.error('[eventService] Error cleaning duplicates:', error);
    return 0;
  }
}

/**
 * Seeds demo events ONLY if the events collection is completely empty.
 * Also cleans up any duplicates that may exist from previous bad seeds.
 */
export async function seedEventsIfMissing(): Promise<void> {
  try {
    // First, clean up any duplicates
    await cleanupDuplicateEvents();

    // Then check if we need to seed
    const checkQuery = query(collection(db, 'events'), limit(1));
    const snapshot = await getDocs(checkQuery);

    if (!snapshot.empty) {
      console.log('[eventService] Events exist, skipping seed.');
      return;
    }

    console.log('[eventService] No events — seeding demo data...');
    for (const event of demoEvents) {
      await addDoc(collection(db, 'events'), {
        ...event,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }
    console.log(`[eventService] Seeded ${demoEvents.length} demo events.`);
  } catch (error) {
    console.error('[eventService] Error seeding events:', error);
  }
}
