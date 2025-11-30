ALTER TABLE `branding_themes`
  ADD COLUMN `app_logo_light_url` text;
--> statement-breakpoint
ALTER TABLE `branding_themes`
  ADD COLUMN `app_logo_dark_url` text;
--> statement-breakpoint
ALTER TABLE `branding_themes`
  ADD COLUMN `login_logo_light_url` text;
--> statement-breakpoint
ALTER TABLE `branding_themes`
  ADD COLUMN `login_logo_dark_url` text;
--> statement-breakpoint
ALTER TABLE `branding_themes`
  ADD COLUMN `login_background_url` text;
--> statement-breakpoint
ALTER TABLE `branding_themes`
  ADD COLUMN `login_background_tint` text;
--> statement-breakpoint
UPDATE `branding_themes`
SET `app_logo_light_url` = `logo_url`
WHERE `app_logo_light_url` IS NULL AND `logo_url` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `tenants`
  ADD COLUMN `custom_domain` text;
--> statement-breakpoint
ALTER TABLE `tenants`
  ADD COLUMN `custom_domain_verification_status` text NOT NULL DEFAULT 'unverified';
--> statement-breakpoint
ALTER TABLE `tenants`
  ADD COLUMN `custom_domain_verified_at` integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `tenants_custom_domain_idx` ON `tenants` (`custom_domain`);

