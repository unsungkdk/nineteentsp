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
 * Extract IP address from headers (Nginx reverse proxy) with socket fallback
 */
export const extractIpAddress = (
  headers: Record<string, string | string[] | undefined>,
  socket?: { remoteAddress?: string }
): string => {
  // Priority order for IP detection (Nginx reverse proxy)
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ip = ips.split(',')[0].trim();
    if (ip && ip !== '') {
      return ip;
    }
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    const ip = Array.isArray(realIp) ? realIp[0] : realIp;
    if (ip && ip !== '') {
      return ip;
    }
  }

  const cfConnectingIp = headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    const ip = Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    if (ip && ip !== '') {
      return ip;
    }
  }

  // Fallback to socket remote address if available
  if (socket?.remoteAddress) {
    // Handle IPv6-mapped IPv4 addresses (::ffff:127.0.0.1 -> 127.0.0.1)
    const ip = socket.remoteAddress.replace(/^::ffff:/, '');
    if (ip && ip !== '') {
      return ip;
    }
  }

  // Last resort fallback
  logger.warn('[Audit] Could not extract IP from headers or socket, using unknown');
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

