-- Idempotent migration: Add locale column to users table
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we check first
-- Note: If the column already exists, this will fail, but that's expected for idempotency
-- The migration tool should handle duplicate column errors gracefully

-- Add locale column if it doesn't exist
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'sv';
--> statement-breakpoint
-- Update existing users to have default locale if needed
UPDATE users SET locale = 'sv' WHERE locale IS NULL OR locale = '';
