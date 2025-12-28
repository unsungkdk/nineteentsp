import { logger } from './logger';

/**
 * Mask sensitive data in request body
 */
export const maskSensitiveData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const masked: any = Array.isArray(data) ? [] : {};
  const sensitiveFields = ['password', 'token', 'otp', 'pin', 'secret', 'apiKey', 'authorization'];

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some((field) => lowerKey.includes(field))) {
      masked[key] = '***MASKED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
};

/**
 * Extract IP address from headers (Nginx reverse proxy)
 */
export const extractIpAddress = (headers: Record<string, string | string[] | undefined>): string => {
  // Priority order for IP detection (Nginx reverse proxy)
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return ips.split(',')[0].trim();
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  const cfConnectingIp = headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
  }

  // Fallback - should not happen with Nginx reverse proxy
  logger.warn('[Audit] Could not extract IP from headers, using unknown');
  return 'unknown';
};

/**
 * Generate session ID
 */
export const generateSessionId = (): string => {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Determine action type from route path
 */
export const getActionTypeFromPath = (path: string, method: string): string | null => {
  const lowerPath = path.toLowerCase();
  const lowerMethod = method.toLowerCase();

  // Auth actions
  if (lowerPath.includes('/auth/signup') || lowerPath.includes('/auth/register')) {
    return 'signup';
  }
  if (lowerPath.includes('/auth/signin') || lowerPath.includes('/auth/login')) {
    return 'signin';
  }
  if (lowerPath.includes('/auth/send-otp')) {
    return 'send_otp';
  }
  if (lowerPath.includes('/auth/verify-otp')) {
    return 'verify_otp';
  }
  if (lowerPath.includes('/auth/logout')) {
    return 'logout';
  }

  // Merchant actions
  if (lowerPath.includes('/merchant') && lowerMethod === 'get') {
    return 'get_merchant';
  }
  if (lowerPath.includes('/merchant') && lowerMethod === 'put') {
    return 'update_merchant';
  }

  // Default: use route name if available
  return null;
};

/**
 * Audit log data structure
 */
export interface AuditLogData {
  sessionId: string;
  userId?: number;
  merchantId?: string;
  email?: string;
  ipAddress: string;
  userAgent?: string;
  requestMethod: string;
  requestPath: string;
  requestQuery?: any;
  requestBody?: any;
  responseStatus: number;
  responseTimeMs?: number;
  routeName?: string;
  actionType?: string;
  metadata?: any;
}

