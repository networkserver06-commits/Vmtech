import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, apiKeys, payouts, transactions, users, wallets } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "accountId"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOverviewData(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      balance: 128450,
      collections: 482920,
      payouts: 128450,
      successRate: 98.7,
      activeKeys: 2,
      accountId: "10482910",
      transactions: [],
    };
  }
  const [wallet, collectionRows, payoutRows, keyRows, recent] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(payouts).where(eq(payouts.userId, userId)),
    db.select().from(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))),
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(10),
  ]);
  const collectionTotal = collectionRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const payoutTotal = payoutRows.reduce((sum, row) => sum + Number(row.amount), 0);
  const successful = [...collectionRows, ...payoutRows].filter((row) => row.status === "SUCCESS").length;
  const total = collectionRows.length + payoutRows.length;
  const user = await getUserById(userId);
  return {
    balance: Number(wallet[0]?.balance ?? 0),
    collections: collectionTotal,
    payouts: payoutTotal,
    successRate: total ? Math.round((successful / total) * 1000) / 10 : 100,
    activeKeys: keyRows.length,
    accountId: user?.accountId ?? "10482910",
    transactions: recent,
  };
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function insertApiKey(input: { userId: number; name: string; keyHash: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(apiKeys).values({ userId: input.userId, name: input.name, keyHash: input.keyHash, keyPrefix: "sk_live_" });
  return result;
}

export async function insertTransaction(input: { userId: number; checkoutRequestId: string; merchantRequestId?: string; accountReference: string; phoneNumber: string; amount: number; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(transactions).values({ ...input, amount: input.amount.toFixed(2), status: input.status ?? "PENDING" });
}

export async function listCollections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
}

export async function createCollection(input: { userId: number; checkoutRequestId: string; accountReference: string; phoneNumber: string; amount: number; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(transactions).values({ userId: input.userId, checkoutRequestId: input.checkoutRequestId, accountReference: input.accountReference, phoneNumber: input.phoneNumber, amount: input.amount.toFixed(2), status: input.status ?? "PENDING" });
  return result;
}

export async function updateCollection(userId: number, id: number, input: { phoneNumber: string; amount: number; accountReference: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.update(transactions).set({ phoneNumber: input.phoneNumber, amount: input.amount.toFixed(2), accountReference: input.accountReference }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function deleteCollection(userId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
}

export async function listPayouts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payouts).where(eq(payouts.userId, userId)).orderBy(desc(payouts.createdAt));
}

export async function createPayout(input: { userId: number; recipientPhone: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment"; status?: string }) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(payouts).values({ userId: input.userId, recipientPhone: input.recipientPhone, amount: input.amount.toFixed(2), commandId: input.commandId, status: input.status ?? "PENDING" });
}

export async function updatePayout(userId: number, id: number, input: { recipientPhone: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment" }) {
  const db = await getDb();
  if (!db) return null;
  return db.update(payouts).set({ recipientPhone: input.recipientPhone, amount: input.amount.toFixed(2), commandId: input.commandId }).where(and(eq(payouts.id, id), eq(payouts.userId, userId)));
}

export async function deletePayout(userId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(payouts).where(and(eq(payouts.id, id), eq(payouts.userId, userId)));
}
