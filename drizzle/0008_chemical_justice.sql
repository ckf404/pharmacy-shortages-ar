CREATE TABLE `group_chat_message_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_chat_message_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `group_chat_message_reactions_message_user_emoji_unique` UNIQUE(`messageId`,`userId`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `group_chat_message_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_chat_message_reads_id` PRIMARY KEY(`id`),
	CONSTRAINT `group_chat_message_reads_message_user_unique` UNIQUE(`messageId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `group_chat_messages` ADD `replyToMessageId` int;--> statement-breakpoint
ALTER TABLE `group_chat_messages` ADD `forwardedFromMessageId` int;--> statement-breakpoint
ALTER TABLE `group_chat_message_reactions` ADD CONSTRAINT `group_chat_message_reactions_messageId_group_chat_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `group_chat_messages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_chat_message_reactions` ADD CONSTRAINT `group_chat_message_reactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_chat_message_reads` ADD CONSTRAINT `group_chat_message_reads_messageId_group_chat_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `group_chat_messages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `group_chat_message_reads` ADD CONSTRAINT `group_chat_message_reads_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `group_chat_message_reactions_message_index` ON `group_chat_message_reactions` (`messageId`);--> statement-breakpoint
CREATE INDEX `group_chat_message_reads_user_index` ON `group_chat_message_reads` (`userId`);--> statement-breakpoint
CREATE INDEX `group_chat_messages_reply_index` ON `group_chat_messages` (`replyToMessageId`);--> statement-breakpoint
CREATE INDEX `group_chat_messages_forward_index` ON `group_chat_messages` (`forwardedFromMessageId`);