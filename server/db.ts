import type { User } from "../drizzle/schema";
import { asRows, execute, getTurso, type TursoRow } from "./turso";

const now = () => new Date().toISOString();
const userFromRow = (row: TursoRow) => ({ ...row, isSuspended: Boolean(row.isSuspended), createdAt: new Date(String(row.createdAt)), updatedAt: new Date(String(row.updatedAt)), lastSignedIn: new Date(String(row.lastSignedIn)) }) as unknown as User;

export async function getDb() { return getTurso(); }

export async function upsertUser(user: { openId: string; accountId?: string | null; name?: string | null; email?: string | null; loginMethod?: string | null; role?: string; lastSignedIn?: Date }) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getTurso();
  if (!db) return;
  const existing = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE openId = ? LIMIT 1", args: [user.openId] }))[0];
  let accountId = user.accountId ?? (existing?.accountId as string | undefined);
  if (!existing && !accountId) {
    const max = asRows<TursoRow>(await db.execute("SELECT MAX(CAST(accountId AS INTEGER)) AS maxAccountId FROM users"))[0]?.maxAccountId;
    accountId = String(Number(max ?? 0) + 1);
  }
  const signedIn = (user.lastSignedIn ?? new Date()).toISOString();
  await db.execute({ sql: `INSERT INTO users (openId, accountId, name, email, loginMethod, role, lastSignedIn, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(openId) DO UPDATE SET accountId=excluded.accountId, name=excluded.name, email=excluded.email, loginMethod=excluded.loginMethod, role=excluded.role, lastSignedIn=excluded.lastSignedIn, updatedAt=excluded.updatedAt`, args: [user.openId, accountId ?? null, user.name ?? null, user.email ?? null, user.loginMethod ?? null, user.role ?? "user", signedIn, now()] });
  const saved = asRows<TursoRow>(await db.execute({ sql: "SELECT id FROM users WHERE openId = ?", args: [user.openId] }))[0];
  if (saved) await db.execute({ sql: "INSERT OR IGNORE INTO wallets (userId) VALUES (?)", args: [Number(saved.id)] });
}

export async function getUserByOpenId(openId: string) {
  const db = await getTurso(); if (!db) return undefined;
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE openId = ? LIMIT 1", args: [openId] }))[0];
  return row ? userFromRow(row) : undefined;
}

export async function getUserById(id: number) {
  const db = await getTurso(); if (!db) return undefined;
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE id = ? LIMIT 1", args: [id] }))[0];
  return row ? userFromRow(row) : undefined;
}

export async function getOverviewData(userId: number) {
  const db = await getTurso();
  if (!db) return { balance: 0, collections: 0, payouts: 0, successRate: 100, activeKeys: 0, accountId: "1", transactions: [] };
  const [wallet, collections, payoutRows, keys, recentCollections, recentPayouts] = await Promise.all([
    db.execute({ sql: "SELECT balance FROM wallets WHERE userId = ? LIMIT 1", args: [userId] }),
    db.execute({ sql: "SELECT * FROM transactions WHERE userId = ?", args: [userId] }),
    db.execute({ sql: "SELECT * FROM payouts WHERE userId = ?", args: [userId] }),
    db.execute({ sql: "SELECT id FROM apiKeys WHERE userId = ? AND isActive = 1", args: [userId] }),
    db.execute({ sql: "SELECT *, 'collection' AS kind FROM transactions WHERE userId = ? ORDER BY datetime(createdAt) DESC LIMIT 10", args: [userId] }),
    db.execute({ sql: "SELECT *, 'payout' AS kind FROM payouts WHERE userId = ? ORDER BY datetime(createdAt) DESC LIMIT 10", args: [userId] }),
  ]);
  const collectionRows = asRows<TursoRow>(collections); const payoutList = asRows<TursoRow>(payoutRows);
  const total = collectionRows.length + payoutList.length; const successful = [...collectionRows, ...payoutList].filter((row) => row.status === "SUCCESS").length;
  const user = await getUserById(userId);
  const activity = [...asRows<TursoRow>(recentCollections), ...asRows<TursoRow>(recentPayouts)].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
  return { balance: Number(asRows<TursoRow>(wallet)[0]?.balance ?? 0), collections: collectionRows.reduce((sum, row) => sum + Number(row.amount), 0), payouts: payoutList.reduce((sum, row) => sum + Number(row.amount), 0), successRate: total ? Math.round((successful / total) * 1000) / 10 : 100, activeKeys: keys.rows.length, accountId: user?.accountId ?? "1", transactions: activity };
}

export async function insertApiKey(input: { userId: number; name: string; keyHash: string }) { return execute({ sql: "INSERT INTO apiKeys (userId, name, keyHash, keyPrefix) VALUES (?, ?, ?, 'sk_live_')", args: [input.userId, input.name, input.keyHash] }); }
export async function listCollections(userId: number) { const result = await execute({ sql: "SELECT * FROM transactions WHERE userId = ? ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createCollection(input: { userId: number; checkoutRequestId: string; accountReference: string; phoneNumber: string; amount: number; status?: string }) { return execute({ sql: "INSERT INTO transactions (userId, checkoutRequestId, accountReference, phoneNumber, amount, status) VALUES (?, ?, ?, ?, ?, ?)", args: [input.userId, input.checkoutRequestId, input.accountReference, input.phoneNumber, input.amount.toFixed(2), input.status ?? "PENDING"] }); }
export async function insertTransaction(input: { userId: number; checkoutRequestId: string; merchantRequestId?: string; accountReference: string; phoneNumber: string; amount: number; status?: string }) { return execute({ sql: "INSERT INTO transactions (userId, checkoutRequestId, merchantRequestId, accountReference, phoneNumber, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [input.userId, input.checkoutRequestId, input.merchantRequestId ?? null, input.accountReference, input.phoneNumber, input.amount.toFixed(2), input.status ?? "PENDING"] }); }
export async function updateCollection(userId: number, id: number, input: { phoneNumber: string; amount: number; accountReference: string }) { return execute({ sql: "UPDATE transactions SET phoneNumber = ?, amount = ?, accountReference = ? WHERE id = ? AND userId = ?", args: [input.phoneNumber, input.amount.toFixed(2), input.accountReference, id, userId] }); }
export async function deleteCollection(userId: number, id: number) { return execute({ sql: "DELETE FROM transactions WHERE id = ? AND userId = ?", args: [id, userId] }); }
export async function listPayouts(userId: number) { const result = await execute({ sql: "SELECT * FROM payouts WHERE userId = ? ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createPayout(input: { userId: number; recipientPhone: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment"; status?: string }) { return execute({ sql: "INSERT INTO payouts (userId, recipientPhone, amount, commandId, status) VALUES (?, ?, ?, ?, ?)", args: [input.userId, input.recipientPhone, input.amount.toFixed(2), input.commandId, input.status ?? "PENDING"] }); }
export async function updatePayout(userId: number, id: number, input: { recipientPhone: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment" }) { return execute({ sql: "UPDATE payouts SET recipientPhone = ?, amount = ?, commandId = ? WHERE id = ? AND userId = ?", args: [input.recipientPhone, input.amount.toFixed(2), input.commandId, id, userId] }); }
export async function deletePayout(userId: number, id: number) { return execute({ sql: "DELETE FROM payouts WHERE id = ? AND userId = ?", args: [id, userId] }); }

export async function getWalletBalance(userId: number) { const result = await execute({ sql: "SELECT balance FROM wallets WHERE userId = ? LIMIT 1", args: [userId] }); return Number(result ? asRows<TursoRow>(result)[0]?.balance ?? 0 : 0); }
export async function createPayoutRecord(input: { userId: number; phoneNumber: string; amount: number; commandId: string; originatorConversationId?: string; conversationId?: string }) { return execute({ sql: "INSERT INTO payouts (userId, recipientPhone, amount, commandId, originatorConversationId, conversationId, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')", args: [input.userId, input.phoneNumber, input.amount.toFixed(2), input.commandId, input.originatorConversationId ?? null, input.conversationId ?? null] }); }

export async function listAdminUsers() { const result = await execute("SELECT u.*, COALESCE(w.balance, '0.00') AS balance FROM users u LEFT JOIN wallets w ON w.userId = u.id ORDER BY datetime(u.createdAt) DESC"); return result ? asRows<TursoRow>(result).map((row) => ({ ...userFromRow(row), balance: Number(row.balance ?? 0) })) : []; }
export async function setUserSuspended(userId: number, isSuspended: boolean) { return execute({ sql: "UPDATE users SET isSuspended = ?, updatedAt = ? WHERE id = ?", args: [isSuspended ? 1 : 0, now(), userId] }); }
export async function adjustWallet(input: { userId: number; amount: number; type: "CREDIT" | "DEBIT"; reason: string }) { const current = await getWalletBalance(input.userId); const next = Math.max(0, current + (input.type === "CREDIT" ? input.amount : -input.amount)); const db = await getTurso(); if (!db) return null; await db.batch([{ sql: "INSERT OR IGNORE INTO wallets (userId, balance) VALUES (?, '0.00')", args: [input.userId] }, { sql: "UPDATE wallets SET balance = ?, updatedAt = ? WHERE userId = ?", args: [next.toFixed(2), now(), input.userId] }, { sql: "INSERT INTO walletTransactions (walletId, amount, type, reference, description) SELECT id, ?, ?, ?, ? FROM wallets WHERE userId = ?", args: [(input.type === "CREDIT" ? input.amount : -input.amount).toFixed(2), input.type === "CREDIT" ? "ADMIN_ADJUSTMENT" : "DEBIT", generateAuditReference(), input.reason, input.userId] }], "write"); return { balance: next }; }
export async function writeAuditLog(input: { userId: number; action: string; details: unknown }) { return execute({ sql: "INSERT INTO auditLogs (userId, action, details) VALUES (?, ?, ?)", args: [input.userId, input.action, JSON.stringify(input.details)] }); }
export async function listAuditLogs() { const result = await execute("SELECT * FROM auditLogs ORDER BY datetime(createdAt) DESC LIMIT 100"); return result ? asRows<TursoRow>(result) : []; }
export async function getSystemSettings() { const result = await execute("SELECT * FROM systemSettings"); return result ? asRows<TursoRow>(result) : [{ settingKey: "PLATFORM_SHORTCODE", value: "4208798", description: "Primary M-PESA Paybill" }, { settingKey: "MAINTENANCE_MODE", value: "false", description: "Block new money movement requests" }]; }
export async function getStoredMpesaConfig(userId: number) { const result = await execute({ sql: "SELECT * FROM mpesaConfigs WHERE userId = ? LIMIT 1", args: [userId] }); return result ? asRows<TursoRow>(result)[0] : undefined; }
export async function saveMpesaConfig(input: { userId: number; shortcode: string; consumerKeyEncrypted: string; consumerSecretEncrypted: string; passkeyEncrypted: string; b2cInitiatorName?: string; b2cInitiatorPasswordEncrypted?: string | null; environment: string }) { return execute({ sql: `INSERT INTO mpesaConfigs (userId, shortcode, consumerKeyEncrypted, consumerSecretEncrypted, passkeyEncrypted, b2cInitiatorName, b2cInitiatorPasswordEncrypted, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET shortcode=excluded.shortcode, consumerKeyEncrypted=excluded.consumerKeyEncrypted, consumerSecretEncrypted=excluded.consumerSecretEncrypted, passkeyEncrypted=excluded.passkeyEncrypted, b2cInitiatorName=excluded.b2cInitiatorName, b2cInitiatorPasswordEncrypted=excluded.b2cInitiatorPasswordEncrypted, environment=excluded.environment`, args: [input.userId, input.shortcode, input.consumerKeyEncrypted, input.consumerSecretEncrypted, input.passkeyEncrypted, input.b2cInitiatorName ?? null, input.b2cInitiatorPasswordEncrypted ?? null, input.environment] }); }
export async function listWebhooks(userId: number) { const result = await execute({ sql: "SELECT id, userId, url, isActive, createdAt FROM webhookEndpoints WHERE userId = ? ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createWebhook(input: { userId: number; url: string; secretEncrypted: string }) { return execute({ sql: "INSERT INTO webhookEndpoints (userId, url, secretEncrypted) VALUES (?, ?, ?)", args: [input.userId, input.url, input.secretEncrypted] }); }
export async function deleteWebhook(userId: number, id: number) { return execute({ sql: "DELETE FROM webhookEndpoints WHERE id = ? AND userId = ?", args: [id, userId] }); }
export async function authenticateApiKey(keyHash: string) { const result = await execute({ sql: "SELECT a.*, u.* FROM apiKeys a JOIN users u ON u.id = a.userId WHERE a.keyHash = ? AND a.isActive = 1 LIMIT 1", args: [keyHash] }); const row = result ? asRows<TursoRow>(result)[0] : undefined; return row ? { keyId: Number(row.id), user: userFromRow(row) } : null; }
export async function markApiKeyUsed(keyId: number) { return execute({ sql: "UPDATE apiKeys SET lastUsedAt = ? WHERE id = ?", args: [now(), keyId] }); }
export async function updateStkCallback(input: { checkoutRequestId: string; success: boolean; failureReason?: string | null; receipt?: string | null }) { return execute({ sql: "UPDATE transactions SET status = ?, failureReason = ?, mpesaReceipt = ? WHERE checkoutRequestId = ?", args: [input.success ? "SUCCESS" : "FAILED", input.failureReason ?? null, input.receipt ?? null, input.checkoutRequestId] }); }
function generateAuditReference() { return `1AUD${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 64); }
