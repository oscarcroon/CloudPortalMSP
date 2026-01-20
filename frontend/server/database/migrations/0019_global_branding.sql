-- No-op: column added earlier; avoid duplicate
SELECT 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `branding_theme_global_unique`
  ON `branding_themes` (`target_type`)
  WHERE `target_type` = 'global';

