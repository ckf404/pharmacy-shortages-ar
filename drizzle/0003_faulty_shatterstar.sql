ALTER TABLE `shortage_items` ADD `dosageForm` varchar(32) DEFAULT 'أقراص' NOT NULL;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD `quantity` int DEFAULT 1 NOT NULL;