ALTER TABLE `branding_themes`
  ADD COLUMN `login_background_tint_opacity` real;
--> statement-breakpoint
UPDATE `branding_themes`
SET `login_background_tint_opacity` = 0.85
WHERE `login_background_tint_opacity` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `branding_theme_global_unique`
  ON `branding_themes` (`target_type`)
  WHERE `target_type` = 'global';

