CREATE TABLE `group_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`body` text NOT NULL,
	`createdByUserId` int NOT NULL,
	`deletedAt` timestamp,
	`deletedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `app_settings` ADD `chatEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `chatTitle` varchar(120) DEFAULT 'دردشة الفريق' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `chatDescription` varchar(255) DEFAULT 'تواصل سريع بين فريق الصيدلية.' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `chatUsersCanSend` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `group_chat_messages` ADD CONSTRAINT `group_chat_messages_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_chat_messages` ADD CONSTRAINT `group_chat_messages_deletedByUserId_users_id_fk` FOREIGN KEY (`deletedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `group_chat_messages_created_index` ON `group_chat_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `group_chat_messages_deleted_index` ON `group_chat_messages` (`deletedAt`);