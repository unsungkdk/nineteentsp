export enum TransactionType {
  PAY_IN = 'PAY_IN',
  PAYOUT = 'PAYOUT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  UPI = 'UPI',
  IMPS = 'IMPS',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  CARD = 'CARD',
}

export interface Transaction {
  id: string;
  transactionId: string;
  merchantId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  fee: number;
  netAmount: number;
  paymentMethod: PaymentMethod;
  referenceId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

