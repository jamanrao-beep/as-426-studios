CREATE TABLE `restaurant_members` (
	`restaurant_id` text NOT NULL,
	`email` text NOT NULL,
	PRIMARY KEY(`restaurant_id`, `email`)
);
