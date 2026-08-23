CREATE TABLE `app_message_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_message_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_message_reads_message_user_unique` UNIQUE(`messageId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `app_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`kind` enum('info','success','warning','alert') NOT NULL DEFAULT 'info',
	`targetUserId` int,
	`active` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` int NOT NULL,
	`appName` varchar(120) NOT NULL DEFAULT 'نواقص الصيدلية',
	`welcomeText` varchar(255) NOT NULL DEFAULT 'كل نقص، وكل مخزن، في قائمة يومية واضحة.',
	`dashboardSubtitle` varchar(255) NOT NULL DEFAULT 'تابع حالة الصنف من التسجيل حتى الاستلام دون فقدان سجل اليوم.',
	`accentColor` varchar(16) NOT NULL DEFAULT '#0f766e',
	`topNotice` varchar(255),
	`navigationOrder` text,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `shortage_suppliers` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `permissions` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `app_message_reads` ADD CONSTRAINT `app_message_reads_messageId_app_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `app_messages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_message_reads` ADD CONSTRAINT `app_message_reads_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_messages` ADD CONSTRAINT `app_messages_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_messages` ADD CONSTRAINT `app_messages_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_settings` ADD CONSTRAINT `app_settings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `app_message_reads_user_index` ON `app_message_reads` (`userId`);--> statement-breakpoint
CREATE INDEX `app_messages_target_active_index` ON `app_messages` (`targetUserId`,`active`);--> statement-breakpoint
CREATE INDEX `app_messages_created_index` ON `app_messages` (`createdAt`);