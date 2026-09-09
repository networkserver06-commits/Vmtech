CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`details` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemSettings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `walletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`walletId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`type` varchar(32) NOT NULL,
	`reference` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `walletTransactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `walletTransactions_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `isSuspended` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `wallet_transactions_wallet_idx` ON `walletTransactions` (`walletId`);