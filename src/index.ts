import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { sucursalesRouter } from './routes/sucursales.js';
import { productosRouter } from './routes/productos.js';
import { kardexRouter } from './routes/kardex.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad y serialización
app.use(helmet());
app.use(cors());
app.use(express.json());

// Registro de Rutas API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/sucursales', sucursalesRouter);
app.use('/api/productos', productosRouter);
app.use('/api/kardex', kardexRouter);

// Manejador de rutas no encontradas
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
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
