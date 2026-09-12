ALTER TABLE `profiles` ADD `file_name` text;--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_account_file` ON `profiles` (`account_id`,`file_name`);