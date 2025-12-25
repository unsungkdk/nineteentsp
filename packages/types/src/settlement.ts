export enum SettlementStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export interface Settlement {
  id: string;
  merchantId: string;
  settlementId: string;
  startDate: Date;
  endDate: Date;
  totalTransactions: number;
  totalAmount: number;
  totalFees: number;
  netAmount: number;
  status: SettlementStatus;
  settlementFileUrl?: string;
  processedAt?: Date;
  createdAt: Date;
}

