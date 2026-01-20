-- Drop legacy module role tables no longer used after permissions refactor
DROP TABLE IF EXISTS `module_roles`;
DROP TABLE IF EXISTS `module_role_permissions`;
DROP TABLE IF EXISTS `module_role_defaults`;
DROP TABLE IF EXISTS `member_module_role_overrides`;

