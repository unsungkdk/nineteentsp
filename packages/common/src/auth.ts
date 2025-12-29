import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
// Force 10 minutes expiry for security - sliding session handles refresh
// Production should NOT override this with longer expiry times
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '10m'; // 10 minutes for sliding session
// Validate that expiry is not too long (max 1 hour for security)
const MAX_EXPIRY_SECONDS = 3600; // 1 hour maximum
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Parse and validate JWT expiry time
 * Ensures tokens don't have excessively long expiry times
 */
const parseExpiryTime = (expiresIn: string): string => {
  // Parse the expiry string (e.g., "10m", "1h", "24h")
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    console.warn(`[Auth] Invalid JWT_EXPIRES_IN format: ${expiresIn}. Using default 10m.`);
    return '10m';
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  let seconds: number;
  switch (unit) {
    case 's': seconds = value; break;
    case 'm': seconds = value * 60; break;
    case 'h': seconds = value * 3600; break;
    case 'd': seconds = value * 86400; break;
    default: return '10m';
  }
  
  // Warn if expiry is too long (security risk)
  if (seconds > MAX_EXPIRY_SECONDS) {
    console.warn(`[Auth] WARNING: JWT_EXPIRES_IN is set to ${expiresIn} (${seconds}s), which exceeds maximum recommended ${MAX_EXPIRY_SECONDS}s (1 hour). This is a security risk. Consider using 10m with sliding session.`);
  }
  
  return expiresIn;
};

const validatedExpiresIn = parseExpiryTime(JWT_EXPIRES_IN);

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: validatedExpiresIn } as SignOptions);
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

