ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'sv';
UPDATE users SET locale = 'sv' WHERE locale IS NULL OR locale = '';

