import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword, generateToken, JWTPayload, logger } from '@tsp/common';
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '@tsp/common';
import { sendOtpEmail as sendBrevoEmail } from './email.service';
import { sendOtpSms as sendSmsOtp } from './sms.service';

const prisma = new PrismaClient();

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
  email: string;
  otp: string;
  otpType: 'email' | 'mobile' | 'sms';
}

/**
 * Generate a 6-digit OTP
 */
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    if (!merchant) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await comparePassword(input.password, merchant.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // If 2FA is enabled, require OTP verification
    if (merchant.is2faActive) {
      return {
        success: true,
        requiresOtp: true,
        message: 'OTP verification required',
        isMobileVerified: merchant.isMobileVerified,
        isEmailVerified: merchant.isEmailVerified,
        isActive: merchant.isActive,
      };
    }

    // Generate JWT token
    const token = generateToken({
      userId: merchant.id.toString(),
      merchantId: merchant.nineteenMerchantId || '',
      role: 'merchant',
      email: merchant.email,
      kycVerified: merchant.kycVerified,
      isActive: merchant.isActive,
    });

    return {
      success: true,
      token,
      merchant: {
        id: merchant.id,
        merchantId: merchant.nineteenMerchantId,
        email: merchant.email,
        mobile: merchant.mobile,
        name: merchant.name,
        kycVerified: merchant.kycVerified,
        isActive: merchant.isActive,
        isMobileVerified: merchant.isMobileVerified,
        isEmailVerified: merchant.isEmailVerified,
      },
    };
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
   */
  async verifyOtp(input: VerifyOtpInput) {
    // Find valid OTP
    const otpRecord = await prisma.merchantOtp.findFirst({
      where: {
        email: input.email,
        otp: input.otp,
        otpType: input.otpType,
        isUsed: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
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
      where: { email: input.email },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    // Update verification status based on OTP type
    const updateData: any = {};
    if (input.otpType === 'email') {
      updateData.isEmailVerified = true;
    } else if (input.otpType === 'mobile' || input.otpType === 'sms') {
      updateData.isMobileVerified = true;
    }

    // Check if both email and mobile are verified (or will be after this update)
    const willBeEmailVerified = input.otpType === 'email' ? true : merchant.isEmailVerified;
    const willBeMobileVerified = (input.otpType === 'mobile' || input.otpType === 'sms') ? true : merchant.isMobileVerified;

    // Activate account if both verifications are complete
    if (willBeEmailVerified && willBeMobileVerified) {
      updateData.isActive = true;
      logger.info(`[Auth Service] Both email and mobile verified for ${input.email}. Activating account.`);
    }

    // Update merchant verification status
    const updatedMerchant = await prisma.merchantsMaster.update({
      where: { email: input.email },
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
  },
};

