import { PrismaClient } from '@prisma/client';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  JWTPayload, 
  logger 
} from '@tsp/common';
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError, 
  ConflictError,
  ForbiddenError,
  UnprocessableEntityError,
  AppError
} from '@tsp/common';
import { sendOtpEmail as sendBrevoEmail } from './email.service';
import { sendOtpSms as sendSmsOtp } from './sms.service';
import { getRedisClient } from './redis.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

// MFA Session interface
// For first-time login: tracks both email and SMS OTP verification
// For subsequent logins (MFA): tracks only SMS OTP verification
interface MfaSession {
  merchantId: number;
  email: string;
  mobile: string;
  emailOtpVerified: boolean; // For first-time login
  smsOtpVerified: boolean; // For both first-time and MFA
  isMfaOnly: boolean; // true = MFA login, false = first-time activation
  expiresAt: number; // Unix timestamp
  attempts: number; // Max 3 attempts per OTP
}

export interface SignUpInput {
  name: string;
  email: string;
  mobile: string;
  password: string;
  state?: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SendOtpInput {
  email: string;
  otpType: 'email' | 'mobile' | 'sms';
}

export interface VerifyOtpInput {
  email?: string; // Optional if mfaSessionToken is provided (legacy support)
  mfaSessionToken?: string; // MFA session token from sign-in (SMS OTP only)
  otp: string;
  otpType: 'email' | 'mobile' | 'sms'; // MFA sessions only accept 'sms' or 'mobile'
}

export interface PasswordResetRequestInput {
  email: string;
}

export interface PasswordResetVerifyInput {
  email: string;
  otp: string;
  newPassword: string;
}

export interface LogoutInput {
  // No input required - logout only needs authentication token
}

/**
 * Generate a 6-digit OTP
 */
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate MFA session token
 */
const generateMfaSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Mask mobile number for display
 */
const maskMobile = (mobile: string): string => {
  if (mobile.length < 4) return '****';
  return `${mobile.substring(0, 4)}****${mobile.substring(mobile.length - 3)}`;
};


/**
 * Send OTP via Email using Brevo
 */
const sendOtpEmail = async (email: string, otp: string, name?: string): Promise<void> => {
  await sendBrevoEmail(email, otp, name);
};

export const authService = {
  /**
   * Sign up a new merchant
   */
  async signUp(input: SignUpInput) {
    // Check if email already exists
    const existingMerchant = await prisma.merchantsMaster.findUnique({
      where: { email: input.email },
    });

    if (existingMerchant) {
      throw new ConflictError('Email already registered');
    }

    // Check if mobile already exists
    const existingMobile = await prisma.merchantsMaster.findFirst({
      where: { mobile: input.mobile },
    });

    if (existingMobile) {
      throw new ConflictError('Mobile number already registered');
    }

    // Generate unique 8-digit numeric merchant ID
    let nineteenMerchantId: string = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      // Generate 8-digit number (10000000 to 99999999)
      const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
      
      // Check if ID already exists
      const existing = await prisma.merchantsMaster.findUnique({
        where: { nineteenMerchantId: randomId },
      });
      
      if (!existing) {
        nineteenMerchantId = randomId;
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique || !nineteenMerchantId) {
      throw new Error('Failed to generate unique merchant ID after multiple attempts');
    }

    // Hash password
    const hashedPassword = await hashPassword(input.password);

    // Create merchant - account is inactive until both email and mobile are verified
    const merchant = await prisma.merchantsMaster.create({
      data: {
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        password: hashedPassword,
        state: input.state,
        nineteenMerchantId,
        kycVerified: false,
        isActive: false, // Account inactive until both email and mobile are verified
        isSettlementActive: false,
        is2faActive: false,
        isMobileVerified: false,
        isEmailVerified: false,
      },
      select: {
        id: true,
        email: true,
        mobile: true,
        nineteenMerchantId: true,
        name: true,
        kycVerified: true,
        isActive: true,
        isMobileVerified: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      merchant: {
        id: merchant.id,
        merchantId: merchant.nineteenMerchantId,
        email: merchant.email,
        name: merchant.name,
        kycVerified: merchant.kycVerified,
      },
    };
  },

  /**
   * Sign in merchant
   * MFA is ALWAYS required - no access without phone and email verification
   */
  async signIn(input: SignInInput) {
    // Find merchant by email
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        mobile: true,
        password: true,
        nineteenMerchantId: true,
        name: true,
        kycVerified: true,
        isActive: true,
        is2faActive: true,
        isMobileVerified: true,
        isEmailVerified: true,
      },
    });

    // Case 0a: Merchant not found
    if (!merchant) {
      logger.warn(`[Auth Service] Sign-in attempt with non-existent email: ${input.email}`);
      throw new UnauthorizedError('Invalid email or password'); // 401 - Don't reveal if email exists
    }

    // Verify password
    const isPasswordValid = await comparePassword(input.password, merchant.password);

    // Case 0b: Invalid password
    if (!isPasswordValid) {
      logger.warn(`[Auth Service] Invalid password attempt for email: ${input.email}`);
      throw new UnauthorizedError('Invalid email or password'); // 401 - Generic error for security
    }

    // Check account status
    const mfaEnabled = merchant.is2faActive;
    const phoneVerified = merchant.isMobileVerified;
    const emailVerified = merchant.isEmailVerified;
    const accountActive = merchant.isActive;

    // Case 0c: Account suspended/disabled (if explicitly disabled after being active)
    // Note: Inactive accounts can still sign in to complete verification (Case 1)
    // This check would be for accounts that were previously active but then disabled
    // For now, we'll allow inactive accounts to proceed to verification
    
    // Case 1: First-time login - Account not activated or not fully verified
    // Require BOTH email AND mobile verification to activate account
    if (!accountActive || !emailVerified || !phoneVerified) {
      logger.info(`[Auth Service] First-time login for ${input.email}. Account active: ${accountActive}, Email verified: ${emailVerified}, Phone verified: ${phoneVerified}`);

      // Generate session token
      const mfaSessionToken = generateMfaSessionToken();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Create session in Redis for first-time activation
      const redisClient = await getRedisClient();
      const mfaSession: MfaSession = {
        merchantId: merchant.id,
        email: merchant.email,
        mobile: merchant.mobile,
        emailOtpVerified: emailVerified, // Already verified if true
        smsOtpVerified: phoneVerified, // Already verified if true
        isMfaOnly: false, // This is first-time activation
        expiresAt,
        attempts: 0,
      };

      await redisClient.setEx(
        `mfa:session:${mfaSessionToken}`,
        600, // 10 minutes TTL
        JSON.stringify(mfaSession)
      );

      logger.info(`[Auth Service] Created first-time activation session for ${input.email}. Token: ${mfaSessionToken.substring(0, 8)}...`);

      // Send email OTP if not verified
      if (!emailVerified) {
        const emailOtp = generateOtp();
        const emailOtpExpiresAt = new Date();
        emailOtpExpiresAt.setMinutes(emailOtpExpiresAt.getMinutes() + 10);

        await prisma.merchantOtp.create({
          data: {
            email: merchant.email,
            otp: emailOtp,
            expiresAt: emailOtpExpiresAt,
            otpType: 'email',
            isUsed: false,
          },
        });

        try {
          await sendOtpEmail(merchant.email, emailOtp, merchant.name);
          logger.info(`[Auth Service] Email OTP sent to ${merchant.email} for first-time activation`);
        } catch (error: any) {
          logger.error(`[Auth Service] Failed to send email OTP:`, error);
        }
      }

      // Send SMS OTP if not verified
      if (!phoneVerified) {
        const mobileOtp = generateOtp();
        const mobileOtpExpiresAt = new Date();
        mobileOtpExpiresAt.setMinutes(mobileOtpExpiresAt.getMinutes() + 10);

        await prisma.merchantOtp.create({
          data: {
            email: merchant.email,
            otp: mobileOtp,
            expiresAt: mobileOtpExpiresAt,
            otpType: 'sms',
            mobile: merchant.mobile,
            isUsed: false,
          },
        });

        try {
          await sendSmsOtp(merchant.mobile, mobileOtp, merchant.name);
          logger.info(`[Auth Service] SMS OTP sent to ${merchant.mobile} for first-time activation`);
        } catch (error: any) {
          logger.error(`[Auth Service] Failed to send SMS OTP:`, error);
          // SMS service failure - treat as temporary service unavailability
          throw new AppError(
            503,
            'SMS service temporarily unavailable. Please try again later or contact support.'
          );
        }
      }

      return {
        success: true,
        requiresOtp: true,
        message: 'Please verify both your email and mobile number to activate your account.',
        mfaSessionToken,
        maskedMobile: maskMobile(merchant.mobile),
        needsEmailVerification: !emailVerified,
        needsMobileVerification: !phoneVerified,
        isMobileVerified: phoneVerified,
        isEmailVerified: emailVerified,
      };
    }

    // Case 2: Subsequent login - Account activated, MFA enabled
    // Only require SMS OTP for MFA
    if (accountActive && mfaEnabled && emailVerified && phoneVerified) {
      logger.info(`[Auth Service] MFA login for ${input.email}. MFA enabled: ${mfaEnabled}`);

      // Generate MFA session token
      const mfaSessionToken = generateMfaSessionToken();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Create MFA session in Redis (SMS OTP only)
      const redisClient = await getRedisClient();
      const mfaSession: MfaSession = {
        merchantId: merchant.id,
        email: merchant.email,
        mobile: merchant.mobile,
        emailOtpVerified: true, // Not needed for MFA, but set to true
        smsOtpVerified: false, // Needs SMS OTP verification
        isMfaOnly: true, // This is MFA-only login
        expiresAt,
        attempts: 0,
      };

      await redisClient.setEx(
        `mfa:session:${mfaSessionToken}`,
        600, // 10 minutes TTL
        JSON.stringify(mfaSession)
      );

      logger.info(`[Auth Service] Created MFA session for ${input.email}. Token: ${mfaSessionToken.substring(0, 8)}...`);

      // Send SMS OTP for MFA
      const mobileOtp = generateOtp();
      const mobileOtpExpiresAt = new Date();
      mobileOtpExpiresAt.setMinutes(mobileOtpExpiresAt.getMinutes() + 10);

      await prisma.merchantOtp.create({
        data: {
      email: merchant.email,
          otp: mobileOtp,
          expiresAt: mobileOtpExpiresAt,
          otpType: 'sms',
          mobile: merchant.mobile,
          isUsed: false,
        },
      });

      try {
        await sendSmsOtp(merchant.mobile, mobileOtp, merchant.name);
        logger.info(`[Auth Service] SMS OTP sent to ${merchant.mobile} for MFA login`);
      } catch (error: any) {
        logger.error(`[Auth Service] Failed to send SMS OTP:`, error);
        // SMS service failure - treat as temporary service unavailability
        throw new AppError(
          503,
          'SMS service temporarily unavailable. Please try again later or contact support.'
        );
      }

    return {
      success: true,
        requiresOtp: true,
        message: 'OTP verification required. OTP sent to your registered mobile number.',
        mfaSessionToken,
        maskedMobile: maskMobile(merchant.mobile),
        needsEmailVerification: false,
        needsMobileVerification: true,
        isMobileVerified: true,
        isEmailVerified: true,
      };
    }

    // Case 3: Unexpected/invalid account state
    // This should not happen in normal flow, but handle it gracefully
    logger.error(`[Auth Service] Unexpected state reached for ${input.email}. Account active: ${accountActive}, MFA enabled: ${mfaEnabled}, Email verified: ${emailVerified}, Phone verified: ${phoneVerified}`);
    throw new UnprocessableEntityError(
      'Account is in an invalid state. Please contact support for assistance.'
    ); // 422 - Valid request format but invalid state
  },

  /**
   * Send OTP to email or mobile
   */
  async sendOtp(input: SendOtpInput) {
    // Find merchant
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { email: input.email },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    // Check if there's an active OTP (not expired, not used) created within the last 60 seconds
    const sixtySecondsAgo = new Date();
    sixtySecondsAgo.setSeconds(sixtySecondsAgo.getSeconds() - 60);

    const activeOtp = await prisma.merchantOtp.findFirst({
      where: {
        email: input.email,
        otpType: input.otpType,
        isUsed: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
        createdAt: {
          gte: sixtySecondsAgo, // Created within last 60 seconds
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (activeOtp) {
      const secondsRemaining = Math.ceil((60 - (new Date().getTime() - activeOtp.createdAt.getTime()) / 1000));
      throw new ValidationError(`Please wait ${secondsRemaining} seconds before requesting a new OTP`);
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    // Save OTP to database
    await prisma.merchantOtp.create({
      data: {
        email: input.email,
        otp,
        expiresAt,
        otpType: input.otpType,
        mobile: input.otpType === 'mobile' || input.otpType === 'sms' ? merchant.mobile : null,
        isUsed: false,
      },
    });

    // Send OTP via appropriate channel
    if (input.otpType === 'email') {
      logger.info(`[Auth Service] Sending OTP email to ${input.email} for merchant ${merchant.name}`);
      try {
        await sendOtpEmail(input.email, otp, merchant.name);
        logger.info(`[Auth Service] OTP email sent successfully to ${input.email}`);
      } catch (error: any) {
        logger.error(`[Auth Service] Failed to send OTP email to ${input.email}:`, error);
        throw error;
      }
    } else if (input.otpType === 'mobile' || input.otpType === 'sms') {
      logger.info(`[Auth Service] Sending OTP SMS to ${merchant.mobile} for merchant ${merchant.name}`);
      try {
        await sendSmsOtp(merchant.mobile, otp, merchant.name);
        logger.info(`[Auth Service] OTP SMS sent successfully to ${merchant.mobile}`);
      } catch (error: any) {
        logger.error(`[Auth Service] Failed to send OTP SMS to ${merchant.mobile}:`, error);
        throw error;
      }
    }

    return {
      success: true,
      message: `OTP sent to ${input.otpType}`,
      expiresIn: 600, // 10 minutes in seconds
    };
  },

  /**
   * Verify OTP and return token
   * MFA sessions only accept SMS OTP (not email OTP)
   * Supports both MFA session token and email-based verification (legacy)
   */
  async verifyOtp(input: VerifyOtpInput) {
    let merchantEmail: string;
    let mfaSession: MfaSession | null = null;

    // If mfaSessionToken is provided, get session from Redis
    if (input.mfaSessionToken) {
      const redisClient = await getRedisClient();
      const sessionData = await redisClient.get(`mfa:session:${input.mfaSessionToken}`);

      if (!sessionData) {
        throw new UnauthorizedError('Invalid or expired MFA session');
      }

      mfaSession = JSON.parse(sessionData) as MfaSession;

      // Check if session is expired
      if (Date.now() > mfaSession.expiresAt) {
        await redisClient.del(`mfa:session:${input.mfaSessionToken}`);
        throw new UnauthorizedError('MFA session has expired. Please sign in again.');
      }

      // Check attempts limit
      if (mfaSession.attempts >= 3) {
        await redisClient.del(`mfa:session:${input.mfaSessionToken}`);
        throw new UnauthorizedError('Too many failed attempts. Please sign in again.');
      }

      // MFA-only sessions only accept SMS OTP, not email OTP
      if (mfaSession.isMfaOnly && input.otpType === 'email') {
        throw new ValidationError('MFA verification only accepts SMS OTP. Please use otpType: "sms" or "mobile".');
      }

      merchantEmail = mfaSession.email;
    } else if (input.email) {
      merchantEmail = input.email;
    } else {
      throw new ValidationError('Either email or mfaSessionToken is required');
    }

    // Find valid OTP
    const otpRecord = await prisma.merchantOtp.findFirst({
      where: {
        email: merchantEmail,
        otp: input.otp,
        otpType: input.otpType,
        isUsed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      // Increment attempts if MFA session exists
      if (mfaSession && input.mfaSessionToken) {
        const redisClient = await getRedisClient();
        mfaSession.attempts += 1;
        await redisClient.setEx(
          `mfa:session:${input.mfaSessionToken}`,
          Math.floor((mfaSession.expiresAt - Date.now()) / 1000),
          JSON.stringify(mfaSession)
        );
      }
      throw new UnauthorizedError('Invalid OTP');
    }

    // Check if OTP is expired
    if (new Date() > otpRecord.expiresAt) {
      throw new UnauthorizedError('OTP has expired');
    }

    // Mark OTP as used
    await prisma.merchantOtp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Get merchant
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { email: merchantEmail },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    // If MFA session exists, handle verification based on session type
    if (mfaSession && input.mfaSessionToken) {
      const redisClient = await getRedisClient();

      // Case 1: MFA-only login (subsequent logins) - Only SMS OTP
      if (mfaSession.isMfaOnly) {
        // MFA sessions only accept SMS OTP (already validated above)
        if (input.otpType === 'mobile' || input.otpType === 'sms') {
          mfaSession.smsOtpVerified = true;

          // SMS OTP verified for MFA - generate JWT immediately
          const updatedMerchant = await prisma.merchantsMaster.findUnique({
            where: { email: merchantEmail },
            select: {
              id: true,
              email: true,
              mobile: true,
              nineteenMerchantId: true,
              name: true,
              kycVerified: true,
              isActive: true,
              isMobileVerified: true,
              isEmailVerified: true,
              is2faActive: true,
            },
          });

          if (!updatedMerchant) {
            throw new NotFoundError('Merchant');
          }

          // Delete MFA session from Redis
          await redisClient.del(`mfa:session:${input.mfaSessionToken}`);

          logger.info(`[Auth Service] SMS OTP verified for MFA login. ${merchantEmail}`);

          // Generate JWT token
          const token = generateToken({
            userId: updatedMerchant.id.toString(),
            merchantId: updatedMerchant.nineteenMerchantId || '',
            role: 'merchant',
            email: updatedMerchant.email,
            kycVerified: updatedMerchant.kycVerified,
            isActive: updatedMerchant.isActive,
          });

          return {
            success: true,
            token,
            merchant: {
              id: updatedMerchant.id,
              merchantId: updatedMerchant.nineteenMerchantId,
              email: updatedMerchant.email,
              mobile: updatedMerchant.mobile,
              name: updatedMerchant.name,
              kycVerified: updatedMerchant.kycVerified,
              isActive: updatedMerchant.isActive,
              isMobileVerified: updatedMerchant.isMobileVerified,
              isEmailVerified: updatedMerchant.isEmailVerified,
            },
          };
        }
      } 
      // Case 2: First-time activation - Both email AND SMS OTP required
      else {
        // Update session based on OTP type
        if (input.otpType === 'email') {
          mfaSession.emailOtpVerified = true;
        } else if (input.otpType === 'mobile' || input.otpType === 'sms') {
          mfaSession.smsOtpVerified = true;
        }

        // Check if both OTPs are verified
        const allVerified = mfaSession.emailOtpVerified && mfaSession.smsOtpVerified;

        if (allVerified) {
          // Both verified - activate account, enable MFA, verify both
          const updatedMerchant = await prisma.merchantsMaster.update({
            where: { email: merchantEmail },
            data: {
              isActive: true, // Activate account
              is2faActive: true, // Enable MFA
              isEmailVerified: true,
              isMobileVerified: true,
            },
            select: {
              id: true,
              email: true,
              mobile: true,
              nineteenMerchantId: true,
              name: true,
              kycVerified: true,
              isActive: true,
              isMobileVerified: true,
              isEmailVerified: true,
              is2faActive: true,
            },
          });

          // Delete session from Redis
          await redisClient.del(`mfa:session:${input.mfaSessionToken}`);

          logger.info(`[Auth Service] Both email and SMS OTP verified. Account activated and MFA enabled for ${merchantEmail}`);

          // Generate JWT token
          const token = generateToken({
            userId: updatedMerchant.id.toString(),
            merchantId: updatedMerchant.nineteenMerchantId || '',
            role: 'merchant',
            email: updatedMerchant.email,
            kycVerified: updatedMerchant.kycVerified,
            isActive: updatedMerchant.isActive,
          });

          return {
            success: true,
            token,
            merchant: {
              id: updatedMerchant.id,
              merchantId: updatedMerchant.nineteenMerchantId,
              email: updatedMerchant.email,
              mobile: updatedMerchant.mobile,
              name: updatedMerchant.name,
              kycVerified: updatedMerchant.kycVerified,
              isActive: updatedMerchant.isActive,
              isMobileVerified: updatedMerchant.isMobileVerified,
              isEmailVerified: updatedMerchant.isEmailVerified,
            },
          };
        } else {
          // Not both verified yet - update session and ask for the other OTP
          await redisClient.setEx(
            `mfa:session:${input.mfaSessionToken}`,
            Math.floor((mfaSession.expiresAt - Date.now()) / 1000),
            JSON.stringify(mfaSession)
          );

          // Update merchant verification status for the verified OTP
          const updateData: any = {};
          if (input.otpType === 'email') {
            updateData.isEmailVerified = true;
          } else if (input.otpType === 'mobile' || input.otpType === 'sms') {
            updateData.isMobileVerified = true;
          }

          await prisma.merchantsMaster.update({
            where: { email: merchantEmail },
            data: updateData,
          });

          // Determine which OTP is still needed
          const needsEmail = !mfaSession.emailOtpVerified;
          const needsSms = !mfaSession.smsOtpVerified;

          return {
            success: true,
            message: needsEmail && needsSms
              ? 'Please verify both email and mobile OTP to activate your account.'
              : needsEmail
              ? 'Email OTP verified. Please verify mobile OTP to activate your account.'
              : 'Mobile OTP verified. Please verify email OTP to activate your account.',
            requiresOtp: true,
            mfaSessionToken: input.mfaSessionToken,
            emailOtpVerified: mfaSession.emailOtpVerified,
            smsOtpVerified: mfaSession.smsOtpVerified,
            needsEmailVerification: needsEmail,
            needsMobileVerification: needsSms,
          };
        }
      }
    } else {
      // Legacy flow without MFA session (for backward compatibility with send-otp endpoint)
    const updateData: any = {};
    if (input.otpType === 'email') {
      updateData.isEmailVerified = true;
    } else if (input.otpType === 'mobile' || input.otpType === 'sms') {
      updateData.isMobileVerified = true;
    }

    // Check if both email and mobile are verified (or will be after this update)
    const willBeEmailVerified = input.otpType === 'email' ? true : merchant.isEmailVerified;
    const willBeMobileVerified = (input.otpType === 'mobile' || input.otpType === 'sms') ? true : merchant.isMobileVerified;

      // Activate account and enable MFA if both verifications are complete
    if (willBeEmailVerified && willBeMobileVerified) {
      updateData.isActive = true;
        updateData.is2faActive = true;
        logger.info(`[Auth Service] Both email and mobile verified for ${merchantEmail}. Activating account and enabling MFA.`);
    }

    // Update merchant verification status
    const updatedMerchant = await prisma.merchantsMaster.update({
        where: { email: merchantEmail },
      data: updateData,
      select: {
        id: true,
        email: true,
        mobile: true,
        nineteenMerchantId: true,
        name: true,
        kycVerified: true,
        isActive: true,
        isMobileVerified: true,
        isEmailVerified: true,
      },
    });

      // Only generate token if both are verified
      if (willBeEmailVerified && willBeMobileVerified) {
    const token = generateToken({
      userId: updatedMerchant.id.toString(),
      merchantId: updatedMerchant.nineteenMerchantId || '',
      role: 'merchant',
      email: updatedMerchant.email,
      kycVerified: updatedMerchant.kycVerified,
      isActive: updatedMerchant.isActive,
    });

    return {
      success: true,
      token,
      merchant: {
        id: updatedMerchant.id,
        merchantId: updatedMerchant.nineteenMerchantId,
        email: updatedMerchant.email,
        mobile: updatedMerchant.mobile,
        name: updatedMerchant.name,
        kycVerified: updatedMerchant.kycVerified,
        isActive: updatedMerchant.isActive,
        isMobileVerified: updatedMerchant.isMobileVerified,
        isEmailVerified: updatedMerchant.isEmailVerified,
      },
    };
      } else {
        return {
          success: true,
          message: input.otpType === 'email'
            ? 'Email OTP verified. Please verify mobile OTP to complete verification.'
            : 'Mobile OTP verified. Please verify email OTP to complete verification.',
          requiresOtp: true,
        };
      }
    }
  },

  /**
   * Request password reset - sends SMS OTP
   */
  async requestPasswordReset(input: PasswordResetRequestInput) {
    // Find merchant by email
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        mobile: true,
        name: true,
        isActive: true,
      },
    });

    // Don't reveal if email exists - return success either way (security best practice)
    if (!merchant) {
      logger.warn(`[Auth Service] Password reset requested for non-existent email: ${input.email}`);
      // Return success to prevent email enumeration attacks
      return {
        success: true,
        message: 'If the email exists, a password reset OTP has been sent to your registered mobile number.',
      };
    }

    // Check if account is active
    if (!merchant.isActive) {
      logger.warn(`[Auth Service] Password reset requested for inactive account: ${input.email}`);
      // Still return success to prevent account enumeration
      return {
        success: true,
        message: 'If the email exists, a password reset OTP has been sent to your registered mobile number.',
      };
    }

    // Generate OTP
    const resetOtp = generateOtp();
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10); // 10 minutes expiry

    // Store OTP in database with type 'password_reset'
    await prisma.merchantOtp.create({
      data: {
        email: merchant.email,
        otp: resetOtp,
        expiresAt: otpExpiresAt,
        otpType: 'sms', // Password reset uses SMS only
        mobile: merchant.mobile,
        isUsed: false,
      },
    });

    // Send SMS OTP
    try {
      await sendSmsOtp(merchant.mobile, resetOtp, merchant.name);
      logger.info(`[Auth Service] Password reset OTP sent to ${merchant.mobile} for ${input.email}`);
    } catch (error: any) {
      logger.error(`[Auth Service] Failed to send password reset SMS OTP:`, error);
      throw new AppError(
        503,
        'SMS service temporarily unavailable. Please try again later or contact support.'
      );
    }

    return {
      success: true,
      message: 'Password reset OTP has been sent to your registered mobile number.',
      maskedMobile: maskMobile(merchant.mobile),
      expiresIn: 600, // 10 minutes in seconds
    };
  },

  /**
   * Verify password reset OTP and update password
   */
  async verifyPasswordReset(input: PasswordResetVerifyInput) {
    // Validate new password
    if (input.newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Find merchant
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        mobile: true,
        isActive: true,
      },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    // Find valid OTP
    const otpRecord = await prisma.merchantOtp.findFirst({
      where: {
        email: input.email,
        otp: input.otp,
        otpType: 'sms',
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new UnauthorizedError('Invalid or expired OTP. Please request a new password reset.');
    }

    // Mark OTP as used
    await prisma.merchantOtp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Hash new password
    const hashedPassword = await hashPassword(input.newPassword);

    // Update password
    await prisma.merchantsMaster.update({
      where: { email: input.email },
      data: { password: hashedPassword },
    });

    logger.info(`[Auth Service] Password reset successful for ${input.email}`);

    // Invalidate all existing sessions (optional - can be implemented with Redis token blacklist)
    // For now, we just update the password

    return {
      success: true,
      message: 'Password has been reset successfully. Please sign in with your new password.',
    };
  },

  /**
   * Logout user
   * Note: Actual token invalidation should be handled via Redis token blacklist
   * or by setting token expiry. This endpoint confirms logout action.
   */
  async logout(userId: number, email: string) {
    // Find merchant
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
      },
    });

    if (!merchant || merchant.id !== userId) {
      throw new UnauthorizedError('Invalid user session');
    }

    logger.info(`[Auth Service] User logged out: ${email}`);

    // Note: Actual token invalidation should be handled via Redis token blacklist
    // or by setting token expiry. This endpoint confirms logout action.

    return {
      success: true,
      message: 'Logged out successfully',
    };
  },
};

