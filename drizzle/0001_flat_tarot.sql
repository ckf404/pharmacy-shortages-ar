CREATE TABLE `shortage_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`details` text,
	`actorUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shortage_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shortage_days` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dayKey` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shortage_days_id` PRIMARY KEY(`id`),
	CONSTRAINT `shortage_days_day_key_unique` UNIQUE(`dayKey`)
);
--> statement-breakpoint
CREATE TABLE `shortage_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shortageDayId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`priority` enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','received','deleted') NOT NULL DEFAULT 'open',
	`notes` text,
	`suggestedSupplierId` int,
	`receivedAt` timestamp,
	`receivedByUserId` int,
	`deletedAt` timestamp,
	`deletedByUserId` int,
	`rolloverSourceItemId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shortage_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `shortage_items_rollover_source_unique` UNIQUE(`shortageDayId`,`rolloverSourceItemId`)
);
--> statement-breakpoint
CREATE TABLE `shortage_rollover_settings` (
	`id` int NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'Africa/Cairo',
	`hour` int NOT NULL DEFAULT 0,
	`minute` int NOT NULL DEFAULT 0,
	`enabled` boolean NOT NULL DEFAULT true,
	`schedule_cron_task_uid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shortage_rollover_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shortage_supplier_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`shortageItemId` int NOT NULL,
	`productNameSnapshot` varchar(255) NOT NULL,
	`prioritySnapshot` enum('normal','important','urgent') NOT NULL,
	`notesSnapshot` text,
	CONSTRAINT `shortage_supplier_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shortage_supplier_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`shortageDayId` int NOT NULL,
	`messageText` text NOT NULL,
	`whatsappUrl` text NOT NULL,
	`createdByUserId` int NOT NULL,
	`preparedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shortage_supplier_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shortage_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`whatsappNumber` varchar(16) NOT NULL,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shortage_suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','supervisor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `lastSignedIn` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `username` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_open_id_unique` UNIQUE(`openId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`);--> statement-breakpoint
ALTER TABLE `shortage_activity_logs` ADD CONSTRAINT `shortage_activity_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD CONSTRAINT `shortage_items_shortageDayId_shortage_days_id_fk` FOREIGN KEY (`shortageDayId`) REFERENCES `shortage_days`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD CONSTRAINT `shortage_items_suggestedSupplierId_shortage_suppliers_id_fk` FOREIGN KEY (`suggestedSupplierId`) REFERENCES `shortage_suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD CONSTRAINT `shortage_items_receivedByUserId_users_id_fk` FOREIGN KEY (`receivedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD CONSTRAINT `shortage_items_deletedByUserId_users_id_fk` FOREIGN KEY (`deletedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD CONSTRAINT `shortage_items_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_supplier_order_items` ADD CONSTRAINT `soi_order_fk` FOREIGN KEY (`orderId`) REFERENCES `shortage_supplier_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_supplier_order_items` ADD CONSTRAINT `soi_item_fk` FOREIGN KEY (`shortageItemId`) REFERENCES `shortage_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_supplier_orders` ADD CONSTRAINT `sorders_supplier_fk` FOREIGN KEY (`supplierId`) REFERENCES `shortage_suppliers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_supplier_orders` ADD CONSTRAINT `sorders_day_fk` FOREIGN KEY (`shortageDayId`) REFERENCES `shortage_days`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shortage_supplier_orders` ADD CONSTRAINT `sorders_user_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `shortage_activity_entity_index` ON `shortage_activity_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `shortage_activity_created_index` ON `shortage_activity_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `shortage_items_day_status_index` ON `shortage_items` (`shortageDayId`,`status`);--> statement-breakpoint
CREATE INDEX `shortage_items_supplier_index` ON `shortage_items` (`suggestedSupplierId`);--> statement-breakpoint
CREATE INDEX `shortage_rollover_task_uid_index` ON `shortage_rollover_settings` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `shortage_supplier_order_items_order_index` ON `shortage_supplier_order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `shortage_supplier_order_items_item_index` ON `shortage_supplier_order_items` (`shortageItemId`);--> statement-breakpoint
CREATE INDEX `shortage_supplier_orders_day_index` ON `shortage_supplier_orders` (`shortageDayId`);--> statement-breakpoint
CREATE INDEX `shortage_supplier_orders_supplier_index` ON `shortage_supplier_orders` (`supplierId`);--> statement-breakpoint
CREATE INDEX `shortage_suppliers_active_index` ON `shortage_suppliers` (`active`);--> statement-breakpoint
CREATE INDEX `users_role_active_index` ON `users` (`role`,`active`);
