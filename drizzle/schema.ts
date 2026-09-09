import { boolean, decimal, index, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  accountId: varchar("accountId", { length: 16 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  isSuspended: boolean("isSuspended").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  balance: decimal("balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("KES").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ userIdx: index("wallets_user_idx").on(table.userId) }));

export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  reference: varchar("reference", { length: 64 }).notNull().unique(),
  description: text("description").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ walletIdx: index("wallet_transactions_wallet_idx").on(table.walletId) }));

export const mpesaConfigs = mysqlTable("mpesaConfigs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  shortcode: varchar("shortcode", { length: 32 }).default("4208798").notNull(),
  passkeyEncrypted: text("passkeyEncrypted").notNull(),
  consumerKeyEncrypted: text("consumerKeyEncrypted").notNull(),
  consumerSecretEncrypted: text("consumerSecretEncrypted").notNull(),
  b2cInitiatorName: varchar("b2cInitiatorName", { length: 128 }),
  b2cInitiatorPasswordEncrypted: text("b2cInitiatorPasswordEncrypted"),
  environment: varchar("environment", { length: 20 }).default("SANDBOX").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("mpesa_configs_user_idx").on(table.userId) }));

export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 16 }).default("sk_live_").notNull(),
  keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
  isActive: boolean("isActive").default(true).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("api_keys_user_idx").on(table.userId) }));

export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  checkoutRequestId: varchar("checkoutRequestId", { length: 128 }).notNull().unique(),
  merchantRequestId: varchar("merchantRequestId", { length: 128 }),
  mpesaReceipt: varchar("mpesaReceipt", { length: 64 }),
  accountReference: varchar("accountReference", { length: 64 }).notNull(),
  phoneNumber: varchar("phoneNumber", { length: 32 }).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("transactions_user_idx").on(table.userId), statusIdx: index("transactions_status_idx").on(table.status) }));

export const payouts = mysqlTable("payouts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recipientPhone: varchar("recipientPhone", { length: 32 }).notNull(),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  commandId: varchar("commandId", { length: 32 }).default("BusinessPayment").notNull(),
  originatorConversationId: varchar("originatorConversationId", { length: 128 }).unique(),
  conversationId: varchar("conversationId", { length: 128 }),
  mpesaReceipt: varchar("mpesaReceipt", { length: 64 }),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  failureReason: text("failureReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("payouts_user_idx").on(table.userId) }));

export const webhookEndpoints = mysqlTable("webhookEndpoints", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  secretEncrypted: text("secretEncrypted").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("webhook_endpoints_user_idx").on(table.userId) }));

export const webhookLogs = mysqlTable("webhookLogs", {
  id: int("id").autoincrement().primaryKey(),
  webhookEndpointId: int("webhookEndpointId").notNull(),
  statusCode: int("statusCode").notNull(),
  payload: text("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ endpointIdx: index("webhook_logs_endpoint_idx").on(table.webhookEndpointId) }));

export const systemSettings = mysqlTable("systemSettings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("audit_logs_user_idx").on(table.userId) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
