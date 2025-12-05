ALTER TABLE tenant_module_policies
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'inherit';

ALTER TABLE organization_module_policies
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'inherit';




