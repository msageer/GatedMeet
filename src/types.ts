export type UserRole = 'creator' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  bio?: string;
  pricing?: {
    price: number;
    currency: string;
    duration: number;
  };
  availability?: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }>;
  walletAddress?: string;
  platformFeeTier: number;
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  referralBonuses?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Booking {
  id?: string;
  creatorId: string;
  clientEmail: string;
  clientName: string;
  clientDetails?: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'paid' | 'confirmed' | 'cancelled';
  paymentType: 'fiat' | 'crypto';
  amount: number;
  platformFee: number;
  meetingLink?: string;
  transactionId?: string;
  createdAt: string;
}

export interface Transaction {
  id?: string;
  bookingId: string;
  userId: string;
  amount: number;
  type: 'payment' | 'payout';
  status: 'success' | 'failed' | 'pending';
  method: string;
  timestamp: string;
}

export interface PayoutRequest {
  id?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: any;
}
