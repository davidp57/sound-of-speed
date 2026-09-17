CREATE TABLE `expense_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`since` integer NOT NULL,
	`until` integer NOT NULL,
	`sample_bytes` integer NOT NULL,
	`sample_requests` integer NOT NULL,
	`analysis_ms` integer NOT NULL,
	`analysis_traces` integer NOT NULL,
	`bank_bytes` integer NOT NULL,
	`bank_count` integer NOT NULL,
	`database_bytes` integer NOT NULL,
	`reason` text NOT NULL
);
