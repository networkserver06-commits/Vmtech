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
export type Transaction = { id: number; userId: number; checkoutRequestId: string; merchantRequestId: string | null; mpesaReceipt: string | null; accountReference: string; phoneNumber: string; amount: string; status: string; failureReason: string | null; createdAt: Date };
export type Payout = { id: number; userId: number; recipientPhone: string; amount: string; commandId: string; originatorConversationId: string | null; conversationId: string | null; mpesaReceipt: string | null; status: string; failureReason: string | null; createdAt: Date };
