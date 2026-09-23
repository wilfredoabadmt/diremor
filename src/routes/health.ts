import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();

  if (dbHealth.connected) {
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      latencyMs: dbHealth.latencyMs,
      timestamp: new Date().toISOString(),
      service: 'diremor-sac-api',
      version: '1.0.0'
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: dbHealth.error,
      timestamp: new Date().toISOString(),
      service: 'diremor-sac-api'
    });
  }
});
