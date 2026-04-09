import { collection, getDocs, addDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/src/lib/firebase';

export const demoEvents = [
  {
    title: 'Bresh — La Fiesta Más Linda del Mundo',
    description: 'Vuelve la Bresh a Buenos Aires. Una noche de hits, glitter y la mejor energía.',
    date: Timestamp.fromDate(new Date('2026-04-18T23:59:00Z')),
    location: 'Palermo, CABA',
    venue: 'GEBA Sede Jorge Newbery',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=1000',
    category: 'Festivales',
    organizerId: 'system',
    tickets: [
      { type: 'General', price: 45000, available: 2000 },
      { type: 'VIP', price: 85000, available: 500 }
    ]
  },
  {
    title: 'Divididos — 35 Años',
    description: 'La Aplanadora del Rock vuelve al Estadio Obras para un show histórico.',
    date: Timestamp.fromDate(new Date('2026-05-22T21:00:00Z')),
    location: 'Núñez, CABA',
    venue: 'Estadio Obras Sanitarias',
    price: 65000,
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=1000',
    category: 'Música',
    organizerId: 'system',
    tickets: [
      { type: 'Campo', price: 65000, available: 3000 },
      { type: 'Platea Alta', price: 95000, available: 1000 }
    ]
  },
  {
    title: 'Cazzu — Nena Trampa Tour',
    description: 'La jefa del trap presenta su nuevo álbum en un show imperdible.',
    date: Timestamp.fromDate(new Date('2026-06-05T20:30:00Z')),
    location: 'Villa Crespo, CABA',
    venue: 'Movistar Arena',
    price: 55000,
    image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?auto=format&fit=crop&q=80&w=1000',
    category: 'Música',
    organizerId: 'system',
    tickets: [
      { type: 'Campo', price: 55000, available: 5000 },
      { type: 'Platea Baja', price: 110000, available: 2000 }
    ]
  },
  {
    title: 'Loud — Electronic Music Festival',
    description: 'El festival de música electrónica más grande de la región llega a Buenos Aires.',
    date: Timestamp.fromDate(new Date('2026-07-12T18:00:00Z')),
    location: 'Costanera Sur, CABA',
    venue: 'Mandarine Park',
    price: 38000,
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000',
    category: 'Festivales',
    organizerId: 'system',
    tickets: [
      { type: 'General', price: 38000, available: 10000 },
      { type: 'VIP Backstage', price: 95000, available: 200 }
    ]
  }
];

export async function seedEventsIfMissing() {
  try {
    const eventsCol = collection(db, 'events');
    const snapshot = await getDocs(eventsCol);
    const existingEvents = snapshot.docs.map(doc => doc.data().title);
    
    const missingEvents = demoEvents.filter(e => !existingEvents.includes(e.title));
    
    if (missingEvents.length === 0) return false;

    // Only attempt to seed if authenticated. Guests can't write to DB.
    if (!auth.currentUser) {
      console.log("Guest user: Skipping event seeding (requires authentication)");
      return false;
    }
    
    for (const event of missingEvents) {
      await addDoc(eventsCol, event);
    }
    
    return true;
  } catch (error) {
    // If it's a permission error, we just ignore it as it's expected for guests
    if (error instanceof Error && error.message.includes('insufficient permissions')) {
      return false;
    }
    console.error("Error seeding events:", error);
    return false;
  }
}
