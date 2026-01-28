-- Add email dark mode setting to email provider profiles
ALTER TABLE `email_provider_profiles`
  ADD COLUMN `email_dark_mode` integer DEFAULT 0;

