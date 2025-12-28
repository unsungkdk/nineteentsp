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
  ForbiddenError,
  AppError
} from '@tsp/common';
import { sendOtpSms } from './sms.service';

const prisma = new PrismaClient();

export interface AdminSignInInput {
  email: string;
  password: string;
}

export interface UpdateMerchantProfileInput {
  typeOfEntity?: string;
  pan?: string;
  incorporationDate?: string; // ISO date string
  gst?: string;
  businessAddress?: string;
  registrationNumber?: string;
  mccCodes?: any;
  directorDetails?: any;
  shareholdingPatterns?: any;
  uboDetails?: any;
  accountDetails?: any;
  whitelistedIps?: any;
  apDetails?: any;
  averageTicketSize?: number;
  averageVolume?: number;
  expectedTurnover?: number;
  turnoverDoneTillDate?: number;
  numberOfTransactionsDone?: number;
}

export interface AdminPasswordResetRequestInput {
  email: string;
}

export interface AdminPasswordResetVerifyInput {
  email: string;
  otp: string;
  newPassword: string;
}

/**
 * Generate a 6-digit OTP
 */
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Mask mobile number for display
 */
const maskMobile = (mobile: string): string => {
  if (mobile.length < 7) return mobile;
  return mobile.substring(0, 4) + '****' + mobile.substring(mobile.length - 3);
};

export const adminService = {
  /**
   * Admin sign in
   * Follows same standards as merchant sign-in but without MFA requirement for now
   */
  async signIn(input: AdminSignInInput) {
    // Find admin by email
    const admin = await prisma.admin.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        isActive: true,
        is2faActive: true,
        isMobileVerified: true,
        isEmailVerified: true,
      },
    });

    // Case 0a: Admin not found
    if (!admin) {
      logger.warn(`[Admin Service] Sign-in attempt with non-existent email: ${input.email}`);
      throw new UnauthorizedError('Invalid email or password'); // 401 - Don't reveal if email exists
    }

    // Verify password
    const isPasswordValid = await comparePassword(input.password, admin.password);

    // Case 0b: Invalid password
    if (!isPasswordValid) {
      logger.warn(`[Admin Service] Invalid password attempt for email: ${input.email}`);
      throw new UnauthorizedError('Invalid email or password'); // 401 - Generic error for security
    }

    // Check if admin is active
    if (!admin.isActive) {
      logger.warn(`[Admin Service] Sign-in attempt for inactive admin: ${input.email}`);
      throw new ForbiddenError('Admin account is disabled. Please contact support.');
    }

    // Update last login time
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = generateToken({
      userId: admin.id.toString(),
      merchantId: '', // Not applicable for admin
      role: admin.role,
      email: admin.email,
      kycVerified: true, // Admins are always verified
      isActive: admin.isActive,
    });

    logger.info(`[Admin Service] Admin signed in successfully: ${input.email}`);

    return {
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isActive: admin.isActive,
      },
    };
  },

  /**
   * Get all merchants with pagination
   */
  async getAllMerchants(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { nineteenMerchantId: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [merchants, total] = await Promise.all([
      prisma.merchantsMaster.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          nineteenMerchantId: true,
          kycVerified: true,
          isActive: true,
          isSettlementActive: true,
          is2faActive: true,
          isMobileVerified: true,
          isEmailVerified: true,
          state: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              typeOfEntity: true,
              pan: true,
              gst: true,
              averageTicketSize: true,
              averageVolume: true,
              expectedTurnover: true,
              turnoverDoneTillDate: true,
              numberOfTransactionsDone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.merchantsMaster.count({ where }),
    ]);

    return {
      success: true,
      merchants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Get merchant by ID with full profile
   */
  async getMerchantById(merchantId: string) {
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { nineteenMerchantId: merchantId },
      include: {
        profile: true,
      },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    return {
      success: true,
      merchant,
    };
  },

  /**
   * Update or create merchant profile
   */
  async updateMerchantProfile(merchantId: string, input: UpdateMerchantProfileInput) {
    // Verify merchant exists
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { nineteenMerchantId: merchantId },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    // Prepare update data
    const updateData: any = {};

    if (input.typeOfEntity !== undefined) updateData.typeOfEntity = input.typeOfEntity;
    if (input.pan !== undefined) updateData.pan = input.pan;
    if (input.incorporationDate !== undefined) {
      updateData.incorporationDate = new Date(input.incorporationDate);
    }
    if (input.gst !== undefined) updateData.gst = input.gst;
    if (input.businessAddress !== undefined) updateData.businessAddress = input.businessAddress;
    if (input.registrationNumber !== undefined) updateData.registrationNumber = input.registrationNumber;
    if (input.mccCodes !== undefined) updateData.mccCodes = input.mccCodes;
    if (input.directorDetails !== undefined) updateData.directorDetails = input.directorDetails;
    if (input.shareholdingPatterns !== undefined) updateData.shareholdingPatterns = input.shareholdingPatterns;
    if (input.uboDetails !== undefined) updateData.uboDetails = input.uboDetails;
    if (input.accountDetails !== undefined) updateData.accountDetails = input.accountDetails;
    if (input.whitelistedIps !== undefined) updateData.whitelistedIps = input.whitelistedIps;
    if (input.apDetails !== undefined) updateData.apDetails = input.apDetails;
    if (input.averageTicketSize !== undefined) updateData.averageTicketSize = input.averageTicketSize;
    if (input.averageVolume !== undefined) updateData.averageVolume = input.averageVolume;
    if (input.expectedTurnover !== undefined) updateData.expectedTurnover = input.expectedTurnover;
    if (input.turnoverDoneTillDate !== undefined) updateData.turnoverDoneTillDate = input.turnoverDoneTillDate;
    if (input.numberOfTransactionsDone !== undefined) updateData.numberOfTransactionsDone = input.numberOfTransactionsDone;

    // Upsert profile (create if doesn't exist, update if exists)
    const profile = await prisma.merchantProfile.upsert({
      where: { nineteenMerchantId: merchantId },
      update: updateData,
      create: {
        nineteenMerchantId: merchantId,
        ...updateData,
      },
    });

    logger.info(`[Admin Service] Merchant profile updated for ${merchantId}`);

    return {
      success: true,
      message: 'Merchant profile updated successfully',
      profile,
    };
  },

  /**
   * Disable merchant account
   */
  async disableMerchantAccount(merchantId: string) {
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { nineteenMerchantId: merchantId },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    if (!merchant.isActive) {
      return {
        success: true,
        message: 'Merchant account is already disabled',
        merchant: {
          id: merchant.id,
          merchantId: merchant.nineteenMerchantId,
          email: merchant.email,
          isActive: false,
        },
      };
    }

    const updatedMerchant = await prisma.merchantsMaster.update({
      where: { nineteenMerchantId: merchantId },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        email: true,
        nineteenMerchantId: true,
        isActive: true,
        kycVerified: true,
      },
    });

    logger.info(`[Admin Service] Merchant account disabled: ${merchantId}`);

    return {
      success: true,
      message: 'Merchant account disabled successfully',
      merchant: updatedMerchant,
    };
  },

  /**
   * Enable merchant account
   */
  async enableMerchantAccount(merchantId: string) {
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { nineteenMerchantId: merchantId },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    if (merchant.isActive) {
      return {
        success: true,
        message: 'Merchant account is already enabled',
        merchant: {
          id: merchant.id,
          merchantId: merchant.nineteenMerchantId,
          email: merchant.email,
          isActive: true,
        },
      };
    }

    const updatedMerchant = await prisma.merchantsMaster.update({
      where: { nineteenMerchantId: merchantId },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        nineteenMerchantId: true,
        isActive: true,
        kycVerified: true,
      },
    });

    logger.info(`[Admin Service] Merchant account enabled: ${merchantId}`);

    return {
      success: true,
      message: 'Merchant account enabled successfully',
      merchant: updatedMerchant,
    };
  },

  /**
   * Request admin password reset - sends SMS OTP
   */
  async requestPasswordReset(input: AdminPasswordResetRequestInput) {
    // Find admin by email
    const admin = await prisma.admin.findUnique({
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
    if (!admin) {
      logger.warn(`[Admin Service] Password reset requested for non-existent email: ${input.email}`);
      // Return success to prevent email enumeration attacks
      return {
        success: true,
        message: 'If the email exists, a password reset OTP has been sent to your registered mobile number.',
      };
    }

    // Check if account is active
    if (!admin.isActive) {
      logger.warn(`[Admin Service] Password reset requested for inactive admin: ${input.email}`);
      // Still return success to prevent account enumeration
      return {
        success: true,
        message: 'If the email exists, a password reset OTP has been sent to your registered mobile number.',
      };
    }

    // Check if mobile is available
    if (!admin.mobile) {
      logger.warn(`[Admin Service] Password reset requested for admin without mobile: ${input.email}`);
      throw new ValidationError('Mobile number not registered. Please contact support to reset your password.');
    }

    // Generate OTP
    const resetOtp = generateOtp();
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10); // 10 minutes expiry

    // Store OTP in database
    await prisma.adminOtp.create({
      data: {
        adminId: admin.id,
        email: admin.email,
        otp: resetOtp,
        expiresAt: otpExpiresAt,
        otpType: 'sms', // Password reset uses SMS only
        mobile: admin.mobile,
        isUsed: false,
      },
    });

    // Send SMS OTP
    try {
      await sendOtpSms(admin.mobile, resetOtp, admin.name);
      logger.info(`[Admin Service] Password reset OTP sent to ${admin.mobile} for ${input.email}`);
    } catch (error: any) {
      logger.error(`[Admin Service] Failed to send password reset SMS OTP:`, error);
      throw new AppError(
        503,
        'SMS service temporarily unavailable. Please try again later or contact support.'
      );
    }

    return {
      success: true,
      message: 'Password reset OTP has been sent to your registered mobile number.',
      maskedMobile: maskMobile(admin.mobile),
      expiresIn: 600, // 10 minutes in seconds
    };
  },

  /**
   * Verify admin password reset OTP and update password
   */
  async verifyPasswordReset(input: AdminPasswordResetVerifyInput) {
    // Validate new password
    if (input.newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Find admin
    const admin = await prisma.admin.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!admin) {
      throw new NotFoundError('Admin');
    }

    // Find valid OTP
    const otpRecord = await prisma.adminOtp.findFirst({
      where: {
        adminId: admin.id,
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
    await prisma.adminOtp.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Hash new password
    const hashedPassword = await hashPassword(input.newPassword);

    // Update password
    await prisma.admin.update({
      where: { email: input.email },
      data: { password: hashedPassword },
    });

    logger.info(`[Admin Service] Password reset successful for ${input.email}`);

    return {
      success: true,
      message: 'Password has been reset successfully. Please sign in with your new password.',
    };
  },
};

