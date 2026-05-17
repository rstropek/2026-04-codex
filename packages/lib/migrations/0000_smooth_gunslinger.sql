CREATE TABLE `questionnaire_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`questionnaire_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`title` text NOT NULL,
	`questions_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questionnaire_versions_questionnaire_id_version_number_unique` ON `questionnaire_versions` (`questionnaire_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `questionnaires` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`current_version_id` integer,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`current_version_id`) REFERENCES `questionnaire_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`questionnaire_id` integer NOT NULL,
	`version_id` integer NOT NULL,
	`version_number` integer NOT NULL,
	`answers_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`questionnaire_id`) REFERENCES `questionnaires`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`version_id`) REFERENCES `questionnaire_versions`(`id`) ON UPDATE no action ON DELETE no action
);
