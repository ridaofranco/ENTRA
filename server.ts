import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API v1 - Events
  const mockEvents = [
    {
      id: '1',
      title: 'Noche Electrónica — Vol. 12',
      description: 'Una noche única con los mejores DJs de la escena local e internacional. Prepárate para una experiencia inmersiva de sonido y luces.',
      date: '2026-04-15T23:00:00Z',
      location: 'Palermo, CABA',
      venue: 'Niceto Club',
      price: 8500,
      image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=1000',
      category: 'Música',
      tickets: [
        { type: 'General', price: 8500, available: 500 },
        { type: 'VIP', price: 15000, available: 100 }
      ]
    },
    {
      id: '2',
      title: 'Festival de Cine Independiente',
      description: 'Lo mejor del cine de autor en una semana a pura proyección. Charlas con directores y talleres exclusivos.',
      date: '2026-05-10T18:00:00Z',
      location: 'Recoleta, CABA',
      venue: 'Centro Cultural Recoleta',
      price: 3200,
      image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&q=80&w=1000',
      category: 'Cine',
      tickets: [
        { type: 'Entrada General', price: 3200, available: 200 }
      ]
    },
    {
      id: '3',
      title: 'Superclásico — Final de Copa',
      description: 'El partido más esperado del año. Viví la pasión del fútbol argentino en una final histórica.',
      date: '2026-06-20T16:00:00Z',
      location: 'Núñez, CABA',
      venue: 'Estadio Monumental',
      price: 25000,
      image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1000',
      category: 'Deportes',
      tickets: [
        { type: 'Popular', price: 25000, available: 10000 },
        { type: 'Platea Alta', price: 45000, available: 5000 },
        { type: 'Platea Baja VIP', price: 85000, available: 1000 }
      ]
    }
  ];

  app.get('/api/v1/events', (req, res) => {
    res.json({
      status: 'success',
      data: mockEvents,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/v1/events', (req, res) => {
    const newEvent = {
      id: Math.random().toString(36).substr(2, 9),
      ...req.body,
      timestamp: new Date().toISOString()
    };
    mockEvents.push(newEvent);
    res.status(201).json({
      status: 'success',
      data: newEvent,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/v1/checkin', (req, res) => {
    const { ticket_qr, gate_id } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
        timestamp: new Date().toISOString()
      });
    }

    // Mock validation
    res.json({
      status: 'success',
      data: {
        valid: true,
        attendee: "Franco Ridao",
        ticket_type: "VIP",
        checked_in_at: new Date().toISOString(),
        gate: gate_id || "Puerta Principal",
        capacity: {
          total: 2000,
          checked_in: 1247,
          remaining: 753
        }
      },
      timestamp: new Date().toISOString()
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
