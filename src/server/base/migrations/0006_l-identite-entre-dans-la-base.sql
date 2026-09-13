CREATE TABLE `auth_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_identities_account` ON `auth_identities` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_identities_provider` ON `auth_identities` (`provider_id`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token` ON `auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `auth_sessions_account` ON `auth_sessions` (`account_id`);--> statement-breakpoint
CREATE TABLE `auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_verifications_identifier` ON `auth_verifications` (`identifier`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `email_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `image` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `updated_at` integer;--> statement-breakpoint
-- Ajouté à la main : SQLite refuse une colonne obligatoire dont le défaut se
-- calcule, donc `updated_at` entre facultative et les comptes déjà là reçoivent
-- la date qu'on connaît d'eux. Sans cette ligne, tout ce qui existait avant
-- l'identité porterait une dernière écriture absente.
UPDATE `accounts` SET `updated_at` = `created_at` WHERE `updated_at` IS NULL;