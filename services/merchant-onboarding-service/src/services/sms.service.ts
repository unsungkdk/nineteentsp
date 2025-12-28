import axios from 'axios';
import { config } from '../config';
import { logger } from '@tsp/common';

/**
 * Truncate name to 10 alphabetic characters only
 */
const truncateName = (name: string): string => {
  // Remove all non-alphabetic characters and take first 10 characters
  const alphabeticOnly = name.replace(/[^a-zA-Z]/g, '');
  return alphabeticOnly.substring(0, 10).toUpperCase();
};

/**
 * Send OTP SMS using SMS API
 */
export const sendOtpSms = async (mobile: string, otp: string, name?: string): Promise<void> => {
  logger.info(`[SMS Service] Starting OTP SMS send to ${mobile}`);
  
  if (!config.sms.apiKey) {
    logger.warn('[SMS Service] SMS API key not configured. SMS will not be sent.');
    console.log(`[SMS] OTP ${otp} for ${mobile} (SMS API not configured)`);
    return;
  }

  try {
    // Truncate name to 10 alphabetic characters if provided
    const truncatedName = name ? truncateName(name) : '';
    const merchantName = truncatedName || 'User';

    // Construct SMS message
    const message = `Hi ${merchantName} your OTP for account verification on Nineteen Pay is ${otp} Please do not share this OTP with anyone. – Team Nineteen Pay`;

    // Construct API URL with query parameters
    const params = new URLSearchParams({
      key: config.sms.apiKey,
      route: config.sms.route,
      type: config.sms.type,
      sender: config.sms.sender,
      number: mobile,
      sms: message,
      templateid: config.sms.templateId,
    });

    const apiUrl = `${config.sms.apiUrl}?${params.toString()}`;

    logger.info(`[SMS Service] Sending SMS to ${mobile}`);
    logger.info(`[SMS Service] Merchant name (truncated): ${merchantName}`);
    logger.info(`[SMS Service] Message: ${message}`);
    logger.info(`[SMS Service] API URL: ${config.sms.apiUrl}`);
    logger.info(`[SMS Service] Request parameters: route=${config.sms.route}, type=${config.sms.type}, sender=${config.sms.sender}, templateId=${config.sms.templateId}`);

    // Send SMS via API
    const response = await axios.get(apiUrl, {
      timeout: 10000, // 10 second timeout
    });

    // Log full response details
    logger.info(`[SMS Service] ===== SMS API Response =====`);
    logger.info(`[SMS Service] Status Code: ${response.status}`);
    logger.info(`[SMS Service] Status Text: ${response.statusText}`);
    logger.info(`[SMS Service] Response Headers: ${JSON.stringify(response.headers)}`);
    logger.info(`[SMS Service] Response Data Type: ${typeof response.data}`);
    logger.info(`[SMS Service] Response Data: ${JSON.stringify(response.data, null, 2)}`);
    
    // Handle different response data types
    if (typeof response.data === 'number') {
      logger.info(`[SMS Service] Response Data (numeric): ${response.data} - This appears to be a Message ID/Transaction ID`);
      logger.info(`[SMS Service] ✅ SMS successfully queued/sent with Message ID: ${response.data}`);
    } else if (typeof response.data === 'string') {
      logger.info(`[SMS Service] Response Data (raw string): ${response.data}`);
      // Check if it looks like a numeric string (message ID)
      if (/^\d+$/.test(response.data.trim())) {
        logger.info(`[SMS Service] ✅ SMS successfully queued/sent with Message ID: ${response.data.trim()}`);
      } else {
        try {
          const parsedData = JSON.parse(response.data);
          logger.info(`[SMS Service] Response Data (parsed JSON): ${JSON.stringify(parsedData, null, 2)}`);
        } catch (e) {
          logger.info(`[SMS Service] Response Data is not valid JSON, treating as plain text`);
        }
      }
    } else if (typeof response.data === 'object' && response.data !== null) {
      logger.info(`[SMS Service] Response Data (object): ${JSON.stringify(response.data, null, 2)}`);
    }
    
    logger.info(`[SMS Service] ===== End SMS API Response =====`);

    // Check if response indicates success
    if (response.status === 200) {
      logger.info(`[SMS Service] OTP SMS sent successfully to ${mobile} - Status 200 OK`);
    } else {
      logger.warn(`[SMS Service] Unexpected response status: ${response.status} - Expected 200`);
    }
  } catch (error: any) {
    logger.error(`[SMS Service] ===== SMS API Error =====`);
    logger.error(`[SMS Service] Failed to send OTP SMS to ${mobile}`);
    logger.error(`[SMS Service] Error type: ${error?.constructor?.name || 'Unknown'}`);
    logger.error(`[SMS Service] Error message: ${error?.message || 'No message'}`);
    
    // Log full error response if available
    if (error?.response) {
      logger.error(`[SMS Service] Error Response Status: ${error.response.status}`);
      logger.error(`[SMS Service] Error Response Status Text: ${error.response.statusText}`);
      logger.error(`[SMS Service] Error Response Headers: ${JSON.stringify(error.response.headers)}`);
      logger.error(`[SMS Service] Error Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
      
      // Try to parse if error response data is a string
      if (typeof error.response.data === 'string') {
        logger.error(`[SMS Service] Error Response Data (raw string): ${error.response.data}`);
        try {
          const parsedErrorData = JSON.parse(error.response.data);
          logger.error(`[SMS Service] Error Response Data (parsed JSON): ${JSON.stringify(parsedErrorData, null, 2)}`);
        } catch (e) {
          logger.error(`[SMS Service] Error Response Data is not valid JSON`);
        }
      }
    }
    
    // Log request details if available
    if (error?.config) {
      logger.error(`[SMS Service] Request URL: ${error.config.url}`);
      logger.error(`[SMS Service] Request Method: ${error.config.method}`);
      logger.error(`[SMS Service] Request Headers: ${JSON.stringify(error.config.headers)}`);
    }
    
    logger.error(`[SMS Service] Error stack: ${error?.stack || 'No stack trace'}`);
    logger.error(`[SMS Service] ===== End SMS API Error =====`);
    
    throw new Error(`Failed to send SMS: ${error?.message || 'Unknown error'}`);
  }
};

