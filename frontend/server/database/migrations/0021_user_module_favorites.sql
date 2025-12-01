CREATE TABLE `user_module_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`module_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s','now') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_module_favorites_unique` ON `user_module_favorites` (`user_id`,`module_id`);
--> statement-breakpoint
CREATE INDEX `user_module_favorites_order_idx` ON `user_module_favorites` (`user_id`,`display_order`);


