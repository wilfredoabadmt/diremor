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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Acceso no autorizado: Token de sesión no provisto.' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(401).json({ error: 'Acceso denegado: Token inválido o expirado.' });
      return;
    }
    req.user = decoded as AuthenticatedUser;
    next();
  });
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    if (!allowedRoles.includes(req.user.rol) && req.user.rol !== 'ADMIN') {
      res.status(403).json({ 
        error: `Acceso denegado: Se requiere rol [${allowedRoles.join(', ')}]. Tu rol actual es [${req.user.rol}].` 
      });
      return;
    }

    next();
  };
}
