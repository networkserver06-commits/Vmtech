CREATE TABLE `apiKeys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`keyPrefix` varchar(16) NOT NULL DEFAULT 'sk_live_',
	`keyHash` varchar(128) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `apiKeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `apiKeys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `mpesaConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`shortcode` varchar(32) NOT NULL DEFAULT '4208798',
	`passkeyEncrypted` text NOT NULL,
	`consumerKeyEncrypted` text NOT NULL,
	`consumerSecretEncrypted` text NOT NULL,
	`b2cInitiatorName` varchar(128),
	`b2cInitiatorPasswordEncrypted` text,
	`environment` varchar(20) NOT NULL DEFAULT 'SANDBOX',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mpesaConfigs_id` PRIMARY KEY(`id`),
	CONSTRAINT `mpesaConfigs_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`recipientPhone` varchar(32) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`commandId` varchar(32) NOT NULL DEFAULT 'BusinessPayment',
	`originatorConversationId` varchar(128),
	`conversationId` varchar(128),
	`mpesaReceipt` varchar(64),
	`status` varchar(20) NOT NULL DEFAULT 'PENDING',
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `payouts_originatorConversationId_unique` UNIQUE(`originatorConversationId`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`checkoutRequestId` varchar(128) NOT NULL,
	`merchantRequestId` varchar(128),
	`mpesaReceipt` varchar(64),
	`accountReference` varchar(64) NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'PENDING',
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_checkoutRequestId_unique` UNIQUE(`checkoutRequestId`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` decimal(14,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_id` PRIMARY KEY(`id`),
	CONSTRAINT `wallets_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `webhookEndpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`url` varchar(500) NOT NULL,
	`secretEncrypted` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhookEndpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhookLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookEndpointId` int NOT NULL,
	`statusCode` int NOT NULL,
	`payload` text NOT NULL,
	`status` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhookLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(32) NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `accountId` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_accountId_unique` UNIQUE(`accountId`);--> statement-breakpoint
CREATE INDEX `api_keys_user_idx` ON `apiKeys` (`userId`);--> statement-breakpoint
CREATE INDEX `mpesa_configs_user_idx` ON `mpesaConfigs` (`userId`);--> statement-breakpoint
CREATE INDEX `payouts_user_idx` ON `payouts` (`userId`);--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `transactions_status_idx` ON `transactions` (`status`);--> statement-breakpoint
CREATE INDEX `wallets_user_idx` ON `wallets` (`userId`);--> statement-breakpoint
CREATE INDEX `webhook_endpoints_user_idx` ON `webhookEndpoints` (`userId`);--> statement-breakpoint
CREATE INDEX `webhook_logs_endpoint_idx` ON `webhookLogs` (`webhookEndpointId`);