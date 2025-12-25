export enum MerchantStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum KYCStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface Merchant {
  id: string;
  merchantId: string;
  businessName: string;
  email: string;
  phone: string;
  status: MerchantStatus;
  kycStatus: KYCStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface KYCDocument {
  id: string;
  merchantId: string;
  documentType: string;
  documentNumber: string;
  documentUrl: string;
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

