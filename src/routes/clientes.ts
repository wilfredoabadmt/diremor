import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const clientesRouter = Router();

// Todos los endpoints de clientes requieren autenticación JWT
clientesRouter.use(authenticateToken);

// =====================================================================
// 1. CLIENTE GENÉRICO (VENTAS DE MOSTRADOR / POS)
// =====================================================================

// GET /api/clientes/generico
clientesRouter.get('/generico', async (_req: Request, res: Response) => {
  try {
    let result = await query(
      "SELECT id_cliente, razon_social, tipo_documento, nit_ci, limite_credito, bloqueo_mora, estado FROM clientes WHERE nit_ci = '0' LIMIT 1"
    );

    if (result.rows.length === 0) {
      // Auto-inicializar cliente comodín de forma idempotente
      result = await query(
        `INSERT INTO clientes (razon_social, tipo_documento, nit_ci, direccion, limite_credito, bloqueo_mora, estado)
         VALUES ('CONTROL DE MOSTRADOR / SIN NOMBRE', 'NIT', '0', 'S/D', 0.00, FALSE, 'ACTIVO')
         RETURNING id_cliente, razon_social, tipo_documento, nit_ci, limite_credito, bloqueo_mora, estado`
      );
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener cliente genérico.', detalle: error.message });
  }
});

// =====================================================================
// 2. PADRÓN DE CLIENTES (CRUD Y BÚSQUEDA)
// =====================================================================

// GET /api/clientes
clientesRouter.get('/', async (req: Request, res: Response) => {
  const { q, estado = 'ACTIVO', bloqueo_mora, limit = '50', offset = '0' } = req.query;

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (estado !== 'all') {
      conditions.push(`estado = $${paramIndex++}`);
      values.push(estado);
    }

    if (bloqueo_mora !== undefined) {
      conditions.push(`bloqueo_mora = $${paramIndex++}`);
      values.push(bloqueo_mora === 'true');
    }

    if (q && typeof q === 'string' && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(`(razon_social ILIKE $${paramIndex} OR nit_ci ILIKE $${paramIndex})`);
      values.push(term);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        id_cliente,
        razon_social,
        tipo_documento,
        nit_ci,
        direccion,
        telefono,
        zona,
        limite_credito,
        bloqueo_mora,
        estado,
        created_at
      FROM clientes
      ${whereClause}
      ORDER BY razon_social ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(Number(limit), Number(offset));
    const result = await query(sql, values);
    res.status(200).json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al listar clientes.', detalle: error.message });
  }
});

// GET /api/clientes/:id
clientesRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT 
        id_cliente,
        razon_social,
        tipo_documento,
        nit_ci,
        direccion,
        telefono,
        zona,
        limite_credito,
        bloqueo_mora,
        estado,
        created_at,
        updated_at
      FROM clientes
      WHERE id_cliente = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al consultar cliente.', detalle: error.message });
  }
});

// POST /api/clientes
clientesRouter.post('/', requireRole('ADMIN', 'VENTAS_POS', 'ALMACEN'), async (req: Request, res: Response) => {
  const {
    razon_social,
    tipo_documento = 'NIT',
    nit_ci,
    direccion = null,
    telefono = null,
    zona = null,
    limite_credito = 0.00,
    estado = 'ACTIVO'
  } = req.body;

  if (!razon_social || !nit_ci) {
    res.status(400).json({ error: 'razon_social y nit_ci son campos obligatorios.' });
    return;
  }

  const tiposValidos = ['NIT', 'CI', 'CEX', 'PAS'];
  const docTypeUpper = tipo_documento.trim().toUpperCase();
  if (!tiposValidos.includes(docTypeUpper)) {
    res.status(400).json({ error: `tipo_documento no válido. Opciones permitidas: ${tiposValidos.join(', ')}` });
    return;
  }

  const limite = Number(limite_credito);
  if (isNaN(limite) || limite < 0) {
    res.status(400).json({ error: 'El límite de crédito no puede ser negativo.' });
    return;
  }

  try {
    const sql = `
      INSERT INTO clientes (
        razon_social,
        tipo_documento,
        nit_ci,
        direccion,
        telefono,
        zona,
        limite_credito,
        bloqueo_mora,
        estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, $8)
      RETURNING *
    `;

    const values = [
      razon_social.trim(),
      docTypeUpper,
      nit_ci.trim(),
      direccion ? direccion.trim() : null,
      telefono ? telefono.trim() : null,
      zona ? zona.trim() : null,
      limite,
      estado.trim().toUpperCase()
    ];

    const result = await query(sql, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al registrar cliente.', detalle: error.message });
  }
});

// PUT /api/clientes/:id
clientesRouter.put('/:id', requireRole('ADMIN', 'VENTAS_POS'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    razon_social,
    tipo_documento,
    nit_ci,
    direccion,
    telefono,
    zona,
    estado
  } = req.body;

  try {
    const sql = `
      UPDATE clientes SET
        razon_social = COALESCE($2, razon_social),
        tipo_documento = COALESCE($3, tipo_documento),
        nit_ci = COALESCE($4, nit_ci),
        direccion = COALESCE($5, direccion),
        telefono = COALESCE($6, telefono),
        zona = COALESCE($7, zona),
        estado = COALESCE($8, estado),
        updated_at = CURRENT_TIMESTAMP
      WHERE id_cliente = $1
      RETURNING *
    `;

    const values = [
      id,
      razon_social ? razon_social.trim() : null,
      tipo_documento ? tipo_documento.trim().toUpperCase() : null,
      nit_ci ? nit_ci.trim() : null,
      direccion !== undefined ? direccion : null,
      telefono !== undefined ? telefono : null,
      zona !== undefined ? zona : null,
      estado ? estado.trim().toUpperCase() : null
    ];

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar cliente.', detalle: error.message });
  }
});

// =====================================================================
// 3. GESTIÓN FINANCIERA: LÍMITES DE CRÉDITO Y BLOQUEO POR MORA
// =====================================================================

// PATCH /api/clientes/:id/credito
clientesRouter.patch('/:id/credito', requireRole('ADMIN', 'CONTABILIDAD'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limite_credito, bloqueo_mora } = req.body;

  if (limite_credito === undefined && bloqueo_mora === undefined) {
    res.status(400).json({ error: 'Debe especificar limite_credito o bloqueo_mora.' });
    return;
  }

  if (limite_credito !== undefined && (isNaN(Number(limite_credito)) || Number(limite_credito) < 0)) {
    res.status(400).json({ error: 'El límite de crédito debe ser un número mayor o igual a cero.' });
    return;
  }

  try {
    const sql = `
      UPDATE clientes SET
        limite_credito = COALESCE($2, limite_credito),
        bloqueo_mora = COALESCE($3, bloqueo_mora),
        updated_at = CURRENT_TIMESTAMP
      WHERE id_cliente = $1
      RETURNING id_cliente, razon_social, nit_ci, limite_credito, bloqueo_mora, updated_at
    `;

    const values = [
      id,
      limite_credito !== undefined ? Number(limite_credito) : null,
      bloqueo_mora !== undefined ? Boolean(bloqueo_mora) : null
    ];

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    res.status(200).json({
      mensaje: 'Parámetros crediticios actualizados exitosamente.',
      cliente: result.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar crédito del cliente.', detalle: error.message });
  }
});

// GET /api/clientes/:id/evaluacion-credito
clientesRouter.get('/:id/evaluacion-credito', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { monto = '0' } = req.query;

  const montoSolicitado = Number(monto);
  if (isNaN(montoSolicitado) || montoSolicitado < 0) {
    res.status(400).json({ error: 'El monto solicitado debe ser un número válido mayor o igual a cero.' });
    return;
  }

  try {
    const clientRes = await query(
      'SELECT id_cliente, razon_social, nit_ci, limite_credito, bloqueo_mora, estado FROM clientes WHERE id_cliente = $1',
      [id]
    );

    if (clientRes.rows.length === 0) {
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    const cliente = clientRes.rows[0];

    if (cliente.estado !== 'ACTIVO') {
      res.status(200).json({
        id_cliente: cliente.id_cliente,
        razon_social: cliente.razon_social,
        apto_para_credito: false,
        motivo_rechazo: 'Cliente inactivo en el sistema.'
      });
      return;
    }

    if (cliente.bloqueo_mora) {
      res.status(200).json({
        id_cliente: cliente.id_cliente,
        razon_social: cliente.razon_social,
        apto_para_credito: false,
        motivo_rechazo: 'Cliente bloqueado por mora en cuentas por cobrar pendientes.'
      });
      return;
    }

    const limiteAutorizado = Number(cliente.limite_credito);

    // Por ahora, evaluamos el monto contra el límite autorizado configurado
    if (montoSolicitado > limiteAutorizado) {
      res.status(200).json({
        id_cliente: cliente.id_cliente,
        razon_social: cliente.razon_social,
        apto_para_credito: false,
        limite_autorizado: limiteAutorizado,
        monto_solicitado: montoSolicitado,
        motivo_rechazo: `El monto solicitado (${montoSolicitado} Bs) excede el límite de crédito disponible (${limiteAutorizado} Bs).`
      });
      return;
    }

    res.status(200).json({
      id_cliente: cliente.id_cliente,
      razon_social: cliente.razon_social,
      apto_para_credito: true,
      limite_autorizado: limiteAutorizado,
      monto_solicitado: montoSolicitado,
      saldo_credito_restante: limiteAutorizado - montoSolicitado
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al evaluar crédito del cliente.', detalle: error.message });
  }
});
