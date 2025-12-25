/**
 * Generate a unique transaction ID
 */
export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `TXN${timestamp}${randomStr}`.toUpperCase();
};

/**
 * Generate a unique merchant ID
 */
export const generateMerchantId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `MCH${timestamp}${randomStr}`.toUpperCase();
};

/**
 * Format currency (INR)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

/**
 * Calculate fee based on percentage
 */
export const calculateFee = (amount: number, feePercentage: number): number => {
  return Math.round((amount * feePercentage) / 100 * 100) / 100;
};

/**
 * Sleep utility for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

