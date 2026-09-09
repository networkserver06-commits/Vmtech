CREATE TABLE `walletDeposits` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `checkoutRequestId` varchar(128) NOT NULL,
  `merchantRequestId` varchar(128),
  `phoneNumber` varchar(32) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'PENDING',
  `mpesaReceipt` varchar(64),
  `failureReason` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `settledAt` timestamp,
  CONSTRAINT `walletDeposits_id` PRIMARY KEY(`id`),
  CONSTRAINT `walletDeposits_checkoutRequestId_unique` UNIQUE(`checkoutRequestId`)
);
--> statement-breakpoint
CREATE INDEX `wallet_deposits_user_idx` ON `walletDeposits` (`userId`);
