CREATE TABLE `screen_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`event_name` text DEFAULT 'LIGHTNING TALKS' NOT NULL,
	`banner` text,
	`timer_status` text DEFAULT 'idle' NOT NULL,
	`duration_ms` integer DEFAULT 300000 NOT NULL,
	`elapsed_ms` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`current_talk_id` integer
);
--> statement-breakpoint
CREATE TABLE `talks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`speaker_name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`duration_sec` integer DEFAULT 300 NOT NULL,
	`created_at` integer NOT NULL
);
