export interface PayInRequest {
  merchantId: string;
  amount: number;
  paymentMethod: string;
  customerDetails: {
    name: string;
    email?: string;
    phone: string;
  };
  metadata?: Record<string, any>;
}

export interface PayoutRequest {
  merchantId: string;
  amount: number;
  beneficiaryAccount: {
    accountNumber: string;
    ifsc: string;
    name: string;
  };
  referenceId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  transactionId: string;
  status: string;
  amount: number;
  fee: number;
  netAmount: number;
  referenceId?: string;
}

