-- Add slug column to tenant_incidents for clean URLs
ALTER TABLE tenant_incidents ADD COLUMN slug TEXT;

-- Create index for slug lookups (tenant + slug for uniqueness)
CREATE INDEX IF NOT EXISTS tenant_incidents_slug_idx ON tenant_incidents(source_tenant_id, slug);

-- Generate slugs for existing incidents from title
UPDATE tenant_incidents 
SET slug = LOWER(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(TRIM(title), ' ', '-'),
                  'å', 'a'
                ),
                'ä', 'a'
              ),
              'ö', 'o'
            ),
            'æ', 'ae'
          ),
          'ø', 'o'
        ),
        'ü', 'u'
      ),
      '.', ''
    ),
    ',', ''
  )
)
WHERE slug IS NULL;

-- Handle any NULL slugs that might remain (use id as fallback)
UPDATE tenant_incidents 
SET slug = id 
WHERE slug IS NULL OR slug = '';

-- Make slug NOT NULL after populating
-- Note: SQLite doesn't support ALTER COLUMN to add NOT NULL constraint
-- The schema definition handles this, and the migration ensures all rows have values

