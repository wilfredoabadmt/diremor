import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'DiremorSAC_SecureJWTKey_ChangeInProduction2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Debe proveer nombre de usuario y contraseña.' });
    return;
  }

  try {
    const userQuery = `
      SELECT 
        u.id_usuario,
        u.username,
        u.password_hash,
        u.nombre_completo,
        u.activo,
        r.codigo as rol,
        s.id_sucursal,
        s.nombre as sucursal_nombre
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      JOIN sucursales s ON u.id_sucursal = s.id_sucursal
      WHERE u.username = $1
      LIMIT 1
    `;
    const result = await query(userQuery, [username]);

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const user = result.rows[0];

    if (!user.activo) {
      res.status(403).json({ error: 'El usuario se encuentra inactivo. Contacte al administrador.' });
      return;
    }

    // Verificar contraseña (soporta hashes bcrypt)
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    // Actualizar última fecha de acceso
    await query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1', [user.id_usuario]);

    // Generar token JWT con claims de usuario y sucursal
    const payload = {
      id_usuario: user.id_usuario,
      username: user.username,
      nombre_completo: user.nombre_completo,
      rol: user.rol,
      id_sucursal: user.id_sucursal,
      sucursal_nombre: user.sucursal_nombre
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });

    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id_usuario: user.id_usuario,
        username: user.username,
        nombre_completo: user.nombre_completo,
        rol: user.rol,
        id_sucursal: user.id_sucursal,
        sucursal_nombre: user.sucursal_nombre
      }
    });
  } catch (error: any) {
    console.error('[Error en Login]:', error.message);
    res.status(500).json({ error: 'Error interno al procesar autenticación.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  res.status(200).json({ user: req.user });
});
