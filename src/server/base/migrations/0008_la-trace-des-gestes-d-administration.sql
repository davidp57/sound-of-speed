CREATE TABLE `admin_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_id` text NOT NULL,
	`target_id` text NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`happened_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_actions_target` ON `admin_actions` (`target_id`);