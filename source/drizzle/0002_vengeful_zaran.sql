CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`restaurant_id` text NOT NULL,
	`rating` integer NOT NULL,
	`message` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text
);
--> statement-breakpoint
CREATE INDEX `reviews_restaurant_created` ON `reviews` (`restaurant_id`,`created_at`);