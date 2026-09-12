ALTER TABLE `tills` ADD `paymentType` varchar(20) NOT NULL DEFAULT 'BUY_GOODS';
--> statement-breakpoint
ALTER TABLE `tills` ADD `businessShortcode` varchar(32);
