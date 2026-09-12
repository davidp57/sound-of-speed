PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_deposits` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`folder` text NOT NULL,
	`name` text NOT NULL,
	`content` blob NOT NULL,
	`bytes` integer NOT NULL,
	`deposited_at` integer DEFAULT (unixepoch()) NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_deposits`("id", "account_id", "folder", "name", "content", "bytes", "deposited_at", "pinned") SELECT "id", "account_id", "folder", "name", "content", "bytes", "deposited_at", "pinned" FROM `deposits`;--> statement-breakpoint
DROP TABLE `deposits`;--> statement-breakpoint
ALTER TABLE `__new_deposits` RENAME TO `deposits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `deposits_folder_name` ON `deposits` (`account_id`,`folder`,`name`);--> statement-breakpoint
CREATE INDEX `deposits_folder` ON `deposits` (`account_id`,`folder`);