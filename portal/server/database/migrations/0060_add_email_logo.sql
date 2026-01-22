-- Add email_logo_url field to branding_themes for separate email logo support
-- This allows using SVG for app branding while using PNG/JPG for email (better Outlook compatibility)
ALTER TABLE branding_themes ADD COLUMN email_logo_url TEXT;
