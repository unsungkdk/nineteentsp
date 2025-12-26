import * as SibApiV3Sdk from 'sib-api-v3-sdk';
import { config } from '../config';
import { logger } from '@tsp/common';

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = config.brevo.apiKey;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

/**
 * Send OTP email using Brevo
 */
export const sendOtpEmail = async (email: string, otp: string, name?: string): Promise<void> => {
  if (!config.brevo.apiKey) {
    logger.warn('Brevo API key not configured. Email will not be sent.');
    console.log(`[Email] OTP ${otp} for ${email} (Brevo not configured)`);
    return;
  }

  try {
    const logoUrl = 'https://raw.githubusercontent.com/unsungkdk/nineteenpay/main/!9%20Light%20logo.png';
    
    // HTML email template with logo and footer
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP Verification - NineteenPay</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 30px 20px; background-color: #ffffff;">
              <img src="${logoUrl}" alt="NineteenPay Logo" style="max-width: 200px; height: auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">OTP Verification</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${name ? `Hello ${name},` : 'Hello,'}
              </p>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your One-Time Password (OTP) for verification is:
              </p>
              
              <!-- OTP Box -->
              <div style="background-color: #f8f9fa; border: 2px dashed #007bff; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; margin: 0;">
                  ${otp}
                </p>
              </div>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                <strong>Important:</strong> This OTP is valid for 10 minutes only. Do not share this OTP with anyone.
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                If you did not request this OTP, please ignore this email or contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e9ecef;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom: 20px;">
                    <p style="color: #333333; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">NineteenPay</p>
                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                      Transaction Service Provider for Banks and Payment Aggregators in India
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 20px; border-top: 1px solid #e9ecef;">
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0 0 5px 0;">
                      <strong>Website:</strong> <a href="https://tsp.nineteenpay.com" style="color: #007bff; text-decoration: none;">https://tsp.nineteenpay.com</a>
                    </p>
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0 0 5px 0;">
                      <strong>Support:</strong> <a href="mailto:support@nineteenpay.com" style="color: #007bff; text-decoration: none;">support@nineteenpay.com</a>
                    </p>
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0;">
                      This is an automated email. Please do not reply to this message.
                    </p>
                    <p style="color: #999999; font-size: 11px; line-height: 1.6; margin: 15px 0 0 0;">
                      © ${new Date().getFullYear()} NineteenPay. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Plain text version
    const textContent = `
OTP Verification - NineteenPay

${name ? `Hello ${name},` : 'Hello,'}

Your One-Time Password (OTP) for verification is: ${otp}

Important: This OTP is valid for 10 minutes only. Do not share this OTP with anyone.

If you did not request this OTP, please ignore this email or contact our support team.

---
NineteenPay
Transaction Service Provider for Banks and Payment Aggregators in India

Website: https://tsp.nineteenpay.com
Support: support@nineteenpay.com

© ${new Date().getFullYear()} NineteenPay. All rights reserved.
    `;

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = 'Your OTP for NineteenPay Verification';
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.textContent = textContent;
    sendSmtpEmail.sender = {
      name: config.brevo.senderName,
      email: config.brevo.senderEmail,
    };
    sendSmtpEmail.to = [{ email, name: name || email }];

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    logger.info(`OTP email sent successfully to ${email}`);
  } catch (error: any) {
    logger.error('Failed to send OTP email via Brevo:', error);
    throw new Error(`Failed to send email: ${error.message || 'Unknown error'}`);
  }
};

