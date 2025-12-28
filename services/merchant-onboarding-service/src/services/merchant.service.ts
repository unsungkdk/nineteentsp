import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '@tsp/common';

const prisma = new PrismaClient();

export const merchantService = {
  /**
   * Get merchant profile with all fields from merchant_profile table
   */
  async getMerchantProfile(merchantId: string) {
    const merchant = await prisma.merchantsMaster.findUnique({
      where: { nineteenMerchantId: merchantId },
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
            incorporationDate: true,
            gst: true,
            businessAddress: true,
            registrationNumber: true,
            mccCodes: true,
            directorDetails: true,
            shareholdingPatterns: true,
            uboDetails: true,
            accountDetails: true,
            whitelistedIps: true,
            apDetails: true,
            averageTicketSize: true,
            averageVolume: true,
            expectedTurnover: true,
            turnoverDoneTillDate: true,
            numberOfTransactionsDone: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!merchant) {
      throw new NotFoundError('Merchant');
    }

    // Normalize profile to ensure all fields are present (even if null)
    const profileData: any = merchant.profile || {};
    
    const merchantWithProfile = {
      ...merchant,
      profile: {
        typeOfEntity: profileData.typeOfEntity ?? null,
        pan: profileData.pan ?? null,
        incorporationDate: profileData.incorporationDate ?? null,
        gst: profileData.gst ?? null,
        businessAddress: profileData.businessAddress ?? null,
        registrationNumber: profileData.registrationNumber ?? null,
        // Prisma automatically deserializes JSON/JSONB fields, so use them directly
        // If they exist in DB, Prisma returns the actual objects/arrays; if null/undefined, use null
        mccCodes: profileData.mccCodes !== undefined ? profileData.mccCodes : null,
        directorDetails: profileData.directorDetails !== undefined ? profileData.directorDetails : null,
        shareholdingPatterns: profileData.shareholdingPatterns !== undefined ? profileData.shareholdingPatterns : null,
        uboDetails: profileData.uboDetails !== undefined ? profileData.uboDetails : null,
        accountDetails: profileData.accountDetails !== undefined ? profileData.accountDetails : null,
        whitelistedIps: profileData.whitelistedIps !== undefined ? profileData.whitelistedIps : null,
        apDetails: profileData.apDetails !== undefined ? profileData.apDetails : null,
        averageTicketSize: profileData.averageTicketSize != null ? Number(profileData.averageTicketSize) : null,
        averageVolume: profileData.averageVolume != null ? Number(profileData.averageVolume) : null,
        expectedTurnover: profileData.expectedTurnover != null ? Number(profileData.expectedTurnover) : null,
        turnoverDoneTillDate: profileData.turnoverDoneTillDate != null ? Number(profileData.turnoverDoneTillDate) : null,
        numberOfTransactionsDone: profileData.numberOfTransactionsDone ?? 0,
        createdAt: profileData.createdAt ?? null,
        updatedAt: profileData.updatedAt ?? null,
      },
    };

    return {
      success: true,
      merchant: merchantWithProfile,
    };
  },
};

