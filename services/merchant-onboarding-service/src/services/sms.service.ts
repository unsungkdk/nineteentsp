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
    logger.info(`[SMS Service] Message: ${message}`);
    logger.info(`[SMS Service] API URL: ${config.sms.apiUrl}`);

    // Send SMS via API
    const response = await axios.get(apiUrl, {
      timeout: 10000, // 10 second timeout
    });

    logger.info(`[SMS Service] SMS sent successfully to ${mobile}`);
    logger.info(`[SMS Service] API response: ${JSON.stringify(response.data)}`);

    // Check if response indicates success
    if (response.status === 200) {
      logger.info(`[SMS Service] OTP SMS sent successfully to ${mobile}`);
    } else {
      logger.warn(`[SMS Service] Unexpected response status: ${response.status}`);
    }
  } catch (error: any) {
    logger.error(`[SMS Service] Failed to send OTP SMS to ${mobile}`);
    logger.error(`[SMS Service] Error type: ${error?.constructor?.name || 'Unknown'}`);
    logger.error(`[SMS Service] Error message: ${error?.message || 'No message'}`);
    logger.error(`[SMS Service] Error stack: ${error?.stack || 'No stack trace'}`);
    
    // Log API response if available
    if (error?.response) {
      logger.error(`[SMS Service] API response error: ${JSON.stringify(error.response.data)}`);
    }
    
    throw new Error(`Failed to send SMS: ${error?.message || 'Unknown error'}`);
  }
};

