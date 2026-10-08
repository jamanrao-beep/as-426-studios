CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`restaurant_name` text NOT NULL,
	`table_label` text NOT NULL,
	`customer_name` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`items` text NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`request_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orders_restaurant_created` ON `orders` (`restaurant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_status_created` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `waiters` (
	`restaurant_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`restaurant_id`, `email`)
);
--> statement-breakpoint
CREATE INDEX `waiters_email` ON `waiters` (`email`);