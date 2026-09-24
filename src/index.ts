import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { sucursalesRouter } from './routes/sucursales.js';
import { productosRouter } from './routes/productos.js';
import { kardexRouter } from './routes/kardex.js';
import { clientesRouter } from './routes/clientes.js';
import { ventasRouter } from './routes/ventas.js';
import { getPortalHtml } from './portal.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad y serialización
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Portal visual de bienvenida y estado del sistema
app.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(getPortalHtml());
});

// Índice y catálogo de la API
app.get('/api', (_req, res) => {
  res.status(200).json({
    name: 'DIREMOR SAC API',
    version: '1.0.0',
    description: 'Sistema en Línea de Gestión Administrativo Comercial integrado a Contabilidad',
    paas: 'Coolify (Docker Containerized)',
    status: 'online',
    endpoints: {
      health: 'GET /api/health',
      auth: 'POST /api/auth/login, GET /api/auth/me',
      sucursales: 'GET /api/sucursales',
      productos: 'GET /api/productos, POST /api/productos, GET /api/productos/:codigo/stock',
      kardex: 'POST /api/kardex/movimientos, GET /api/kardex/:codigo_producto, GET /api/kardex/stock-critico',
      clientes: 'GET /api/clientes, POST /api/clientes, GET /api/clientes/generico, GET /api/clientes/:id/evaluacion-credito',
      ventas: 'GET /api/ventas, POST /api/ventas, GET /api/ventas/:id, POST /api/ventas/:id/anular'
    }
  });
});

// Registro de Rutas API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/sucursales', sucursalesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/kardex', kardexRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/ventas', ventasRouter);

// Manejador de rutas no encontradas
app.use((_req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada.',
    hint: 'Para ver la documentación e inicio del sistema ingresa a / o consulta /api/health' 
  });
});

// Inicio del servidor
const server = app.listen(PORT, () => {
  console.log(`[DIREMOR SAC API]: Servidor escuchando en el puerto ${PORT}`);
  console.log(`[Entorno]: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Healthcheck]: http://localhost:${PORT}/api/health`);
});

// Manejo de apagado elegante (Graceful Shutdown)
process.on('SIGTERM', () => {
  console.log('[DIREMOR SAC API]: Señal SIGTERM recibida, cerrando servidor...');
  server.close(() => {
    console.log('[DIREMOR SAC API]: Proceso finalizado limpiamente.');
  });
});

export default app;
