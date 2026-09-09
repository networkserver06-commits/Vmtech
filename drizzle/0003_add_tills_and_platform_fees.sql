CREATE TABLE `tills` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `tillNumber` varchar(32) NOT NULL,
  `name` varchar(80) NOT NULL,
  `location` varchar(120),
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `tills_id` PRIMARY KEY(`id`),
  CONSTRAINT `tills_user_till_unique` UNIQUE(`userId`, `tillNumber`)
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `tillId` int;
--> statement-breakpoint
ALTER TABLE `transactions` ADD `platformFee` decimal(14,2) NOT NULL DEFAULT '0.00';
--> statement-breakpoint
ALTER TABLE `transactions` ADD `netAmount` decimal(14,2);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `feeChargedAt` timestamp;
--> statement-breakpoint
CREATE INDEX `tills_user_idx` ON `tills` (`userId`);
--> statement-breakpoint
CREATE INDEX `transactions_till_idx` ON `transactions` (`tillId`);
--> statement-breakpoint
CREATE INDEX `transactions_fee_idx` ON `transactions` (`feeChargedAt`);
