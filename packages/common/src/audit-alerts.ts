import { logger } from './logger';

/**
 * Suspicious activity types
 */
export enum SuspiciousActivityType {
  MULTIPLE_FAILED_LOGINS = 'multiple_failed_logins',
  RATE_LIMIT_ABUSE = 'rate_limit_abuse',
  UNUSUAL_PATTERN = 'unusual_pattern',
  SUSPICIOUS_IP = 'suspicious_ip',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface SuspiciousActivity {
  activityType: SuspiciousActivityType;
  ipAddress: string;
  userId?: number;
  merchantId?: string;
  severity: Severity;
  description: string;
  metadata?: any;
}

/**
 * Real-time alerting helper
 * Monitors audit logs and detects suspicious patterns
 * This should be called after audit logs are written
 */
export class AuditAlertHelper {
  /**
   * Check for multiple failed login attempts from same IP
   */
  static async checkFailedLoginAttempts(
    ipAddress: string,
    failedAttempts: number,
    timeWindowMinutes: number = 15
  ): Promise<SuspiciousActivity | null> {
    if (failedAttempts >= 10) {
      return {
        activityType: SuspiciousActivityType.MULTIPLE_FAILED_LOGINS,
        ipAddress,
        severity: Severity.CRITICAL,
        description: `${failedAttempts} failed login attempts from IP ${ipAddress} in ${timeWindowMinutes} minutes`,
        metadata: { failedAttempts, timeWindowMinutes },
      };
    } else if (failedAttempts >= 5) {
      return {
        activityType: SuspiciousActivityType.MULTIPLE_FAILED_LOGINS,
        ipAddress,
        severity: Severity.HIGH,
        description: `${failedAttempts} failed login attempts from IP ${ipAddress} in ${timeWindowMinutes} minutes`,
        metadata: { failedAttempts, timeWindowMinutes },
      };
    }

    return null;
  }

  /**
   * Check for rate limit abuse
   */
  static async checkRateLimitAbuse(
    ipAddress: string,
    violations: number,
    endpoint: string
  ): Promise<SuspiciousActivity | null> {
    if (violations >= 50) {
      return {
        activityType: SuspiciousActivityType.RATE_LIMIT_ABUSE,
        ipAddress,
        severity: Severity.CRITICAL,
        description: `IP ${ipAddress} has ${violations} rate limit violations on ${endpoint}`,
        metadata: { violations, endpoint },
      };
    } else if (violations >= 20) {
      return {
        activityType: SuspiciousActivityType.RATE_LIMIT_ABUSE,
        ipAddress,
        severity: Severity.HIGH,
        description: `IP ${ipAddress} has ${violations} rate limit violations on ${endpoint}`,
        metadata: { violations, endpoint },
      };
    }

    return null;
  }

  /**
   * Log suspicious activity (should be sent to database and/or alerting system)
   */
  static async logSuspiciousActivity(activity: SuspiciousActivity): Promise<void> {
    logger.warn(`[Security Alert] ${activity.severity.toUpperCase()}: ${activity.activityType}`, {
      ipAddress: activity.ipAddress,
      severity: activity.severity,
      description: activity.description,
      metadata: activity.metadata,
    });

    // TODO: Insert into suspicious_activity_log table in database
    // This will be implemented in the service layer
  }
}

