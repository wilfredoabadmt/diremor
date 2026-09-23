import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const sucursalesRouter = Router();

// GET /api/sucursales - Lista todas las sucursales activas
sucursalesRouter.get('/', authenticateToken, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id_sucursal, codigo, nombre, ciudad, direccion, telefono, es_matriz, activo FROM sucursales WHERE activo = TRUE ORDER BY id_sucursal ASC'
    );
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error al consultar sucursales]:', error.message);
    res.status(500).json({ error: 'Error al obtener sucursales.' });
  }
});

// GET /api/almacenes - Lista los almacenes (filtrables por sucursal)
sucursalesRouter.get('/almacenes', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sucursalId = req.query['sucursal_id'] ? Number(req.query['sucursal_id']) : req.user?.id_sucursal;
    const result = await query(
      'SELECT id_almacen, id_sucursal, codigo, nombre, tipo, activo FROM almacenes WHERE id_sucursal = $1 AND activo = TRUE ORDER BY id_almacen ASC',
      [sucursalId]
    );
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error al consultar almacenes]:', error.message);
    res.status(500).json({ error: 'Error al obtener almacenes.' });
  }
});
