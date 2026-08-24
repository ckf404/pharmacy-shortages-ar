ALTER TABLE `app_settings` ADD `showInternalLabels` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `internalLabelOptions` varchar(255) DEFAULT 'غير مهم,مهم,ضروري,موصى عليه,سؤال عابر' NOT NULL;--> statement-breakpoint
ALTER TABLE `shortage_items` ADD `internalLabel` varchar(64);