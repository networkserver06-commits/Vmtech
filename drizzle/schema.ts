export type User = {
  id: number;
  openId: string;
  accountId: string | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  passwordHash?: string | null;
  emailVerified?: boolean;
  role: string;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = Partial<Omit<User, "id" | "createdAt" | "updatedAt">> & Pick<User, "openId">;
export type ApiKey = { id: number; userId: number; name: string; keyPrefix: string; keyHash: string; isActive: boolean; lastUsedAt: Date | null; createdAt: Date };
export type Till = { id: number; userId: number; tillNumber: string; name: string; location: string | null; isActive: boolean; createdAt: Date };
export type Transaction = { id: number; userId: number; tillId: number | null; checkoutRequestId: string; merchantRequestId: string | null; mpesaReceipt: string | null; accountReference: string; phoneNumber: string; amount: string; platformFee: string; netAmount: string | null; feeChargedAt: Date | null; status: string; failureReason: string | null; createdAt: Date };
export type WalletTransaction = { id: number; walletId: number; amount: string; type: string; reference: string; description: string; createdAt: Date };
export type WalletDeposit = { id: number; userId: number; checkoutRequestId: string; merchantRequestId: string | null; phoneNumber: string; amount: string; status: string; mpesaReceipt: string | null; failureReason: string | null; createdAt: Date; settledAt: Date | null };
export type Payout = { id: number; userId: number; recipientPhone: string; amount: string; commandId: string; originatorConversationId: string | null; conversationId: string | null; mpesaReceipt: string | null; status: string; failureReason: string | null; createdAt: Date };
