import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '10m'; // 10 minutes for sliding session
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

export interface JWTPayload {
  userId: string;
  merchantId: string; // nineteen_merchant_id
  role: string;
  email: string;
  kycVerified: boolean;
  isActive: boolean;
  iat?: number;
  exp?: number;
}

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

/**
 * Check if token should be refreshed (within 2 minutes of expiry)
 * Returns true if token should be refreshed
 */
export const shouldRefreshToken = (payload: JWTPayload): boolean => {
  if (!payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = payload.exp - now;
  // Refresh if less than 2 minutes remaining
  return timeUntilExpiry < 120;
};

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

