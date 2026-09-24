import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'DiremorSAC_SecureJWTKey_ChangeInProduction2026';

export interface AuthenticatedUser {
  id_usuario: number;
  username: string;
  nombre_completo: string;
  rol: string;
  id_sucursal: number;
  sucursal_nombre: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.get('authorization') || (req.headers['authorization'] as string) || (req.headers['x-access-token'] as string);
  let token: string | undefined;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ') || authHeader.startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  } else if (req.query && req.query.token) {
    token = String(req.query.token);
  }

  if (!token) {
    console.warn('[AUTH WARNING] No token found. Received headers:', Object.keys(req.headers));
    res.status(401).json({ error: 'Acceso no autorizado: Token de sesión no provisto.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.warn('[AUTH ERROR] JWT verify failed:', err.message);
      res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado.' });
      return;
    }
    req.user = decoded as AuthenticatedUser;
    next();
  });
}

export function requireRole(...allowedRoles: (string | string[])[]) {
  const flatRoles = allowedRoles.flat();
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    if (!flatRoles.includes(req.user.rol) && req.user.rol !== 'ADMIN') {
      res.status(403).json({ 
        error: `Acceso denegado: Se requiere rol [${flatRoles.join(', ')}]. Tu rol actual es [${req.user.rol}].` 
      });
      return;
    }

    next();
  };
}
