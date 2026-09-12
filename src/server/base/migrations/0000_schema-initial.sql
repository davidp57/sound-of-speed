CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`folder` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`bytes` integer NOT NULL,
	`deposited_at` integer DEFAULT (unixepoch()) NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deposits_folder_name` ON `deposits` (`account_id`,`folder`,`name`);--> statement-breakpoint
CREATE INDEX `deposits_folder` ON `deposits` (`account_id`,`folder`);--> statement-breakpoint
CREATE TABLE `engines` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `engines_account` ON `engines` (`account_id`);--> statement-breakpoint
CREATE TABLE `gearboxes` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `gearboxes_account` ON `gearboxes` (`account_id`);--> statement-breakpoint
CREATE TABLE `measured_cars` (
	`account_id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`engine_id` text,
	`gearbox_id` text,
	`content` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profiles_account` ON `profiles` (`account_id`);--> statement-breakpoint
CREATE TABLE `rights` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`scope` text NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rights_account_scope` ON `rights` (`account_id`,`scope`);