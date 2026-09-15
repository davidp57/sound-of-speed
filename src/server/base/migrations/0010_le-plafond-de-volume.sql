CREATE TABLE `storage_quotas` (
	`account_id` text PRIMARY KEY NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
