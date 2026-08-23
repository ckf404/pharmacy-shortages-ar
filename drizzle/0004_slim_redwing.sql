ALTER TABLE `app_settings` ADD `pharmacyName` varchar(160) DEFAULT 'الصيدلية' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `pharmacyPhone` varchar(32);--> statement-breakpoint
ALTER TABLE `app_settings` ADD `pharmacyAddress` varchar(255);--> statement-breakpoint
ALTER TABLE `app_settings` ADD `supplierMessageIntro` varchar(300) DEFAULT 'طلب نواقص من {pharmacyName} — {date}' NOT NULL;--> statement-breakpoint
ALTER TABLE `app_settings` ADD `supplierMessageFooter` varchar(300) DEFAULT 'برجاء تأكيد التوفر وموعد التسليم. شكرًا.' NOT NULL;