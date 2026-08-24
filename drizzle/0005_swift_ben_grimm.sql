ALTER TABLE `app_settings` ADD `showDashboardStats` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `showShortageForm` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `showPriorityPicker` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `showSupplierPicker` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `showNotesField` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `showInvoiceArchive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `enabledDosageForms` text;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `quantityPresets` varchar(64) DEFAULT '1,2,3,4' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `visibleNavigation` text;