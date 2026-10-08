ALTER TABLE `orders` ADD `tracking_hash` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `completed_by` text;--> statement-breakpoint
CREATE INDEX `orders_restaurant_completed` ON `orders` (`restaurant_id`,`completed_at`);