CREATE TABLE `admin_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`happened_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_actions_target` ON `admin_actions` (`target_id`);--> statement-breakpoint
CREATE TABLE `bank_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`bank` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_grants_account_bank` ON `bank_grants` (`account_id`,`bank`);