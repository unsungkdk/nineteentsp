import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import {
  extractIpAddress,
  maskSensitiveData,
  generateSessionId,
  getActionTypeFromPath,
  AuditLogData,
  AuditAlertHelper,
  SuspiciousActivityType,
} from '@tsp/common';
import { logger } from '@tsp/common';

const prisma = new PrismaClient();

// In-memory queue for non-blocking audit log insertion
const auditLogQueue: AuditLogData[] = [];
let queueProcessing = false;

/**
 * Process audit log queue (non-blocking batch insertion)
 */
const processAuditQueue = async (): Promise<void> => {
  if (queueProcessing || auditLogQueue.length === 0) {
    return;
  }

  queueProcessing = true;

  try {
    // Process in batches of 100
    const batch = auditLogQueue.splice(0, 100);

    if (batch.length > 0) {
      // Insert batch into database
      await prisma.auditLog.createMany({
        data: batch.map((log) => ({
          sessionId: log.sessionId,
          userId: log.userId,
          merchantId: log.merchantId,
          email: log.email,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent || null,
          requestMethod: log.requestMethod,
          requestPath: log.requestPath,
          requestQuery: log.requestQuery || null,
          requestBody: log.requestBody || null,
          responseStatus: log.responseStatus,
          responseTimeMs: log.responseTimeMs || null,
          routeName: log.routeName || null,
          actionType: log.actionType || null,
          metadata: log.metadata || null,
        })),
      });

      logger.debug(`[Audit] Inserted ${batch.length} audit logs to database`);

      // Check for suspicious activities and alert
      await checkSuspiciousActivities(batch);
    }
  } catch (error: any) {
    logger.error(`[Audit] Error inserting audit logs: ${error.message}`, error);
  } finally {
    queueProcessing = false;

    // Process remaining items if any
    if (auditLogQueue.length > 0) {
      // Schedule next batch (non-blocking)
      setImmediate(() => processAuditQueue());
    }
  }
};

/**
 * Check for suspicious activities in audit logs
 */
const checkSuspiciousActivities = async (logs: AuditLogData[]): Promise<void> => {
  try {
    // Group by IP address
    const ipGroups: Record<string, AuditLogData[]> = {};
    for (const log of logs) {
      if (!ipGroups[log.ipAddress]) {
        ipGroups[log.ipAddress] = [];
      }
      ipGroups[log.ipAddress].push(log);
    }

    // Check for multiple failed login attempts
    for (const [ip, ipLogs] of Object.entries(ipGroups)) {
      const failedLogins = ipLogs.filter(
        (log) => log.actionType === 'signin' && log.responseStatus === 401
      );

      if (failedLogins.length >= 5) {
        const activity = await AuditAlertHelper.checkFailedLoginAttempts(ip, failedLogins.length, 15);
        if (activity) {
          await AuditAlertHelper.logSuspiciousActivity(activity);
        }
      }

      // Check for rate limit violations
      const rateLimitViolations = ipLogs.filter((log) => log.responseStatus === 429);
      if (rateLimitViolations.length >= 20) {
        const endpoint = rateLimitViolations[0]?.requestPath || 'unknown';
        const activity = await AuditAlertHelper.checkRateLimitAbuse(ip, rateLimitViolations.length, endpoint);
        if (activity) {
          await AuditAlertHelper.logSuspiciousActivity(activity);
        }
      }
    }
  } catch (error: any) {
    logger.error(`[Audit] Error checking suspicious activities: ${error.message}`);
  }
};

/**
 * Audit logging middleware
 * Non-blocking: Queues logs for batch insertion
 * Uses Fastify hooks: onRequest (setup) + onResponse (capture response)
 */
export const auditMiddlewareOnRequest = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Skip audit logging for health check and docs
  if (request.url === '/health' || request.url.startsWith('/api-docs') || request.url === '/redoc') {
    return;
  }

  // Generate session ID if not exists
  let sessionId = (request.headers['x-session-id'] as string) || generateSessionId();
  if (!request.headers['x-session-id']) {
    reply.header('X-Session-Id', sessionId);
  }

  // Store in request for later use
  (request as any).sessionId = sessionId;
  (request as any).auditStartTime = Date.now();
};

export const auditMiddlewareOnResponse = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  // Skip audit logging for health check and docs
  if (request.url === '/health' || request.url.startsWith('/api-docs') || request.url === '/redoc') {
    return;
  }

  const startTime = (request as any).auditStartTime || Date.now();
  const sessionId = (request as any).sessionId || generateSessionId();
  const responseTime = Date.now() - startTime;
  const responseStatus = reply.statusCode || 200;

  // Extract IP address from headers
  const ipAddress = extractIpAddress(request.headers);

  // Get user info from request (if authenticated)
  const user = (request as any).user; // From auth middleware

  // Extract request details
  const requestPath = request.url.split('?')[0];
  const requestQuery = Object.keys(request.query || {}).length > 0 ? request.query : undefined;
  const maskedBody = request.body ? maskSensitiveData(request.body) : undefined;

  // Determine action type
  const actionType = getActionTypeFromPath(requestPath, request.method) || undefined;

  // Extract location from request body for sign-in requests
  const metadata: any = {
    url: request.url,
  };

  // Add location to metadata for sign-in requests (location is mandatory for merchant sign-in)
  if (actionType === 'signin' && request.body && typeof request.body === 'object') {
    const body = request.body as any;
    if (body.latitude !== undefined && body.longitude !== undefined && body.location) {
      metadata.location = {
        latitude: body.latitude,
        longitude: body.longitude,
        location: body.location, // City/state name
      };
    }
  }

  // Create audit log entry (non-blocking - add to queue)
  const auditLog: AuditLogData = {
    sessionId,
    userId: user?.userId ? parseInt(user.userId) : undefined,
    merchantId: user?.merchantId || undefined,
    email: user?.email || undefined,
    ipAddress,
    userAgent: request.headers['user-agent'] || undefined,
    requestMethod: request.method,
    requestPath,
    requestQuery,
    requestBody: maskedBody,
    responseStatus,
    responseTimeMs: responseTime,
    routeName: (request.routerPath || request.url.split('?')[0]) || undefined,
    actionType,
    metadata,
  };

  // Add to queue (non-blocking)
  auditLogQueue.push(auditLog);

  // Trigger queue processing (if not already processing)
  if (!queueProcessing) {
    // Use setImmediate for non-blocking execution
    setImmediate(() => processAuditQueue());
  }
};

