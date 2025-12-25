import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword, generateToken, JWTPayload } from '@tsp/common';
import { ValidationError, NotFoundError, UnauthorizedError, ConflictError } from '@tsp/common';

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
 * Send OTP via SMS (placeholder - will be replaced with actual API)
 */
const sendOtpSms = async (mobile: string, otp: string): Promise<void> => {
  // TODO: Integrate with SMS API when provided
  console.log(`[SMS] Sending OTP ${otp} to ${mobile}`);
  // Placeholder: await smsApi.send(mobile, `Your OTP is ${otp}`);
};

/**
 * Send OTP via Email using Brevo (placeholder - will be replaced with actual API)
 */
const sendOtpEmail = async (email: string, otp: string): Promise<void> => {
  // TODO: Integrate with Brevo API when provided
  console.log(`[Email] Sending OTP ${otp} to ${email}`);
  // Placeholder: await brevoApi.sendEmail(email, 'OTP Verification', `Your OTP is ${otp}`);
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

    // Generate unique merchant ID
    const nineteenMerchantId = `MERCH${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Hash password
    const hashedPassword = await hashPassword(input.password);

    // Create merchant
    const merchant = await prisma.merchantsMaster.create({
      data: {
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        password: hashedPassword,
        state: input.state,
        nineteenMerchantId,
        kycVerified: false,
        isActive: true,
        isSettlementActive: false,
        is2faActive: false,
      },
      select: {
        id: true,
        email: true,
        mobile: true,
        nineteenMerchantId: true,
        name: true,
        kycVerified: true,
        isActive: true,
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
    });

    if (!merchant) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is active
    if (!merchant.isActive) {
      throw new UnauthorizedError('Account is inactive. Please contact support.');
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
        name: merchant.name,
        kycVerified: merchant.kycVerified,
        isActive: merchant.isActive,
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
      await sendOtpEmail(input.email, otp);
    } else if (input.otpType === 'mobile' || input.otpType === 'sms') {
      await sendOtpSms(merchant.mobile, otp);
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
        name: merchant.name,
        kycVerified: merchant.kycVerified,
        isActive: merchant.isActive,
      },
    };
  },
};

