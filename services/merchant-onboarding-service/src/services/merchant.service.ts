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

    return {
      success: true,
      merchant,
    };
  },
};

