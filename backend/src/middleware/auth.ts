import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

export interface UserPayload {
  id: string;
  email?: string;
  enrollmentNumber?: string;
  fullName: string;
  role: 'admin' | 'teacher' | 'student';
  classId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Access denied. No authorization bearer token provided.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as UserPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(403).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Authorization token is invalid or has expired.',
    });
    return;
  }
}

export function requireRole(allowedRoles: Array<'admin' | 'teacher' | 'student'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: `Insufficient permissions. Access restricted to: ${allowedRoles.join(', ')}.`,
      });
      return;
    }

    next();
  };
}

export const requireTeacherOrAdmin = requireRole(['admin', 'teacher']);
export const requireStudent = requireRole(['student']);
