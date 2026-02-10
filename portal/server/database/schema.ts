import { createId } from '@paralleldrive/cuid2'
import { relations, sql } from 'drizzle-orm'
import {
  index,
  int,
  boolean,
  float,
  mysqlTable,
  varchar,
  text,
  uniqueIndex,
  primaryKey,
  timestamp,
  foreignKey
} from 'drizzle-orm/mysql-core'
import type { RbacRole, TenantRole } from '../../app/constants/rbac'
import type { OrganizationMemberStatus } from '../../app/types/admin'

// Import layer schemas
import { createCloudflareDnsSchema } from '../../layers/cloudflare-dns/server/database'
import { createWindowsDnsSchema } from '../../layers/windows-dns/server/database'
import { createWindowsDnsRedirectsSchema } from '../../layers/windows-dns-redirects/server/database'

export type BrandingTargetType = 'organization' | 'provider' | 'distributor' | 'global'

const timestampColumns = () => ({
  createdAt: timestamp('created_at', { fsp: 3 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { fsp: 3 }).notNull().defaultNow().onUpdateNow()
})

const softDeleteColumn = () => timestamp('deleted_at', { fsp: 3 })

/**
 * Registry of plugin modules (plugin/layer metadata)
 */
export const modules = mysqlTable(
  'modules',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    key: varchar('key', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 255 }),
    enabled: boolean('enabled').notNull().default(false),
    disabled: boolean('disabled').notNull().default(false),
    comingSoonMessage: text('coming_soon_message'),
    ...timestampColumns()
  },
  (table) => ({
    keyIdx: index('modules_key_idx').on(table.key),
    keyUnique: uniqueIndex('modules_key_unique').on(table.key)
  })
)

/**
 * Module-level permissions declared by plugins
 */
export const modulePermissions = mysqlTable(
  'module_permissions',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    moduleKey: varchar('module_key', { length: 255 })
      .notNull()
      .references(() => modules.key, { onDelete: 'cascade' }),
    permissionKey: varchar('permission_key', { length: 255 }).notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    status: varchar('status', { length: 50 }).notNull().default('active').$type<'active' | 'deprecated' | 'removed'>(),
    removedAt: timestamp('removed_at', { fsp: 3 }),
    ...timestampColumns()
  },
  (table) => ({
    modulePermIdx: index('module_permissions_module_perm_idx').on(
      table.moduleKey,
      table.permissionKey
    ),
    statusIdx: index('module_permissions_status_idx').on(table.status),
    activeIdx: index('module_permissions_active_idx').on(table.isActive)
  })
)

export const tenants = mysqlTable(
  'tenants',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    customDomain: varchar('custom_domain', { length: 255 }),
    customDomainVerificationStatus: varchar('custom_domain_verification_status', { length: 50 })
      .notNull()
      .default('unverified'),
    customDomainVerifiedAt: timestamp('custom_domain_verified_at', { fsp: 3 }),
    customDomainVerificationToken: varchar('custom_domain_verification_token', { length: 255 }),
    type: varchar('type', { length: 50 }).notNull().$type<'provider' | 'distributor' | 'organization'>(),
    parentTenantId: varchar('parent_tenant_id', { length: 128 }),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    ...timestampColumns()
  },
  table => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
    customDomainIdx: uniqueIndex('tenants_custom_domain_idx').on(table.customDomain)
  })
)

export const organizations = mysqlTable(
  'organizations',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    tenantId: varchar('tenant_id', { length: 128 }),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    isSuspended: boolean('is_suspended').notNull().default(false),
    defaultRole: varchar('default_role', { length: 50 }).notNull().default('viewer'),
    requireSso: boolean('require_sso').notNull().default(false),
    allowSelfSignup: boolean('allow_self_signup').notNull().default(false),
    logoUrl: text('logo_url'),
    billingEmail: varchar('billing_email', { length: 255 }),
    coreId: varchar('core_id', { length: 255 }),
    emailDisclaimerMarkdown: text('email_disclaimer_markdown'),
    // Custom domain fields - allows organizations to use their own domain
    customDomain: varchar('custom_domain', { length: 255 }),
    customDomainVerificationStatus: varchar('custom_domain_verification_status', { length: 50 })
      .notNull()
      .default('unverified'),
    customDomainVerifiedAt: timestamp('custom_domain_verified_at', { fsp: 3 }),
    customDomainVerificationToken: varchar('custom_domain_verification_token', { length: 255 }),
    // Setup wizard fields - controls onboarding flow for new organizations
    setupStatus: varchar('setup_status', { length: 50 })
      .$type<'pending' | 'complete'>()
      .notNull()
      .default('complete'), // Default 'complete' so existing orgs don't get stuck in wizard
    setupCompletedAt: timestamp('setup_completed_at', { fsp: 3 }),
    defaultGroupId: varchar('default_group_id', { length: 128 }), // Auto-assign new members to this org group
    ...timestampColumns()
  },
  table => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug),
    customDomainIdx: uniqueIndex('organizations_custom_domain_idx').on(table.customDomain)
  })
)


export const users = mysqlTable(
  'users',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }),
    fullName: varchar('full_name', { length: 255 }),
    profilePictureUrl: varchar('profile_picture_url', { length: 1024 }),
    avatarPreference: varchar('avatar_preference', { length: 20 }).notNull().default('sso'),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    locale: varchar('locale', { length: 10 }).notNull().default('sv'),
    isSuperAdmin: boolean('is_super_admin').notNull().default(false),
    isMfaEnabled: boolean('is_mfa_enabled').notNull().default(false),
    mfaTotpSecret: varchar('mfa_totp_secret', { length: 512 }),
    mfaBackupCodes: text('mfa_backup_codes'),
    lastLoginAt: timestamp('last_login_at', { fsp: 3 }),
    defaultOrgId: varchar('default_org_id', { length: 128 }),
    enforcedOrgId: varchar('enforced_org_id', { length: 128 }),
    forcePasswordReset: boolean('force_password_reset').notNull().default(false),
    passwordResetTokenHash: varchar('password_reset_token_hash', { length: 255 }),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { fsp: 3 }),
    metadata: text('metadata'),
    ...timestampColumns(),
    deletedAt: softDeleteColumn()
  },
  table => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email)
  })
)

export const orgGroups = mysqlTable(
  'org_groups',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    ...timestampColumns()
  },
  (table) => ({
    orgNameUnique: uniqueIndex('org_groups_org_name_unique').on(table.organizationId, table.name),
    orgSlugUnique: uniqueIndex('org_groups_org_slug_unique').on(table.organizationId, table.slug),
    orgIdx: index('org_groups_org_idx').on(table.organizationId)
  })
)

export const orgGroupMembers = mysqlTable(
  'org_group_members',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    groupId: varchar('group_id', { length: 128 })
      .notNull()
      .references(() => orgGroups.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestampColumns()
  },
  (table) => ({
    groupUserUnique: uniqueIndex('org_group_members_unique').on(table.groupId, table.userId),
    groupIdx: index('org_group_members_group_idx').on(table.groupId)
  })
)

export const organizationMemberships = mysqlTable(
  'organization_memberships',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 })
      .notNull()
      .$type<RbacRole>()
      .default('viewer'),
    status: varchar('status', { length: 50 })
      .notNull()
      .$type<OrganizationMemberStatus>()
      .default('active'),
    labels: text('labels'),
    lastAccessedAt: timestamp('last_accessed_at', { fsp: 3 }),
    ...timestampColumns()
  },
  table => ({
    uniqueMembership: uniqueIndex('organization_membership_unique').on(
      table.organizationId,
      table.userId
    )
  })
)

export const brandingThemes = mysqlTable(
  'branding_themes',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    targetType: varchar('target_type', { length: 50 })
      .notNull()
      .$type<BrandingTargetType>(),
    tenantId: varchar('tenant_id', { length: 128 }).references(() => tenants.id, {
      onDelete: 'cascade'
    }),
    organizationId: varchar('organization_id', { length: 128 }).references(() => organizations.id, {
      onDelete: 'cascade'
    }),
    logoUrl: text('logo_url'),
    appLogoLightUrl: text('app_logo_light_url'),
    appLogoDarkUrl: text('app_logo_dark_url'),
    loginLogoLightUrl: text('login_logo_light_url'),
    loginLogoDarkUrl: text('login_logo_dark_url'),
    loginBackgroundUrl: text('login_background_url'),
    emailLogoUrl: text('email_logo_url'),
    loginBackgroundTint: varchar('login_background_tint', { length: 16 }),
    navigationBackgroundColor: varchar('navigation_background_color', { length: 16 }),
    loginBackgroundTintOpacity: float('login_background_tint_opacity'),
    accentColor: varchar('accent_color', { length: 16 }),
    paletteKey: varchar('palette_key', { length: 64 }),
    createdByUserId: varchar('created_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    updatedByUserId: varchar('updated_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    ...timestampColumns()
  },
  table => ({
    brandingTenantUnique: uniqueIndex('branding_theme_tenant_unique').on(
      table.targetType,
      table.tenantId
    ),
    brandingOrgUnique: uniqueIndex('branding_theme_org_unique').on(table.organizationId)
  })
)

export const tenantMemberships = mysqlTable(
  'tenant_memberships',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    tenantId: varchar('tenant_id', { length: 128 })
      .notNull()
      .references((): any => tenants.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 })
      .notNull()
      .$type<TenantRole>()
      .default('viewer'),
    includeChildren: boolean('include_children')
      .notNull()
      .default(false),
    status: varchar('status', { length: 50 })
      .notNull()
      .$type<OrganizationMemberStatus>()
      .default('active'),
    ...timestampColumns()
  },
  table => ({
    uniqueTenantMembership: uniqueIndex('tenant_membership_unique').on(
      table.tenantId,
      table.userId
    )
  })
)

export const tenantMemberRoles = mysqlTable(
  'tenant_member_roles',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    membershipId: varchar('membership_id', { length: 128 })
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    roleKey: varchar('role_key', { length: 50 })
      .notNull()
      .$type<TenantRole>(),
    ...timestampColumns()
  },
  (table) => ({
    membershipRoleUnique: uniqueIndex('tenant_member_roles_membership_role_unique').on(
      table.membershipId,
      table.roleKey
    ),
    membershipIdx: index('tenant_member_roles_membership_idx').on(table.membershipId)
  })
)

export const tenantInvitations = mysqlTable(
  'tenant_invitations',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    tenantId: varchar('tenant_id', { length: 128 })
      .notNull()
      .references((): any => tenants.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 })
      .notNull()
      .$type<'admin' | 'user' | 'viewer' | 'support'>()
      .default('viewer'),
    includeChildren: boolean('include_children')
      .notNull()
      .default(false),
    token: varchar('token', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    invitedByUserId: varchar('invited_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    acceptedAt: timestamp('accepted_at', { fsp: 3 }),
    declinedAt: timestamp('declined_at', { fsp: 3 }),
    organizationData: text('organization_data'), // JSON string for organization data
    ...timestampColumns()
  },
  table => ({
    tokenIdx: uniqueIndex('tenant_invites_token_idx').on(table.token),
    tenantEmailStatusIdx: uniqueIndex('tenant_invites_tenant_email_status_idx').on(
      table.tenantId,
      table.email,
      table.status
    )
  })
)

export const userModuleFavorites = mysqlTable(
  'user_module_favorites',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    displayOrder: int('display_order').notNull().default(0),
    ...timestampColumns()
  },
  table => ({
    uniqueFavorite: uniqueIndex('user_module_favorites_unique').on(table.userId, table.moduleId),
    orderIdx: index('user_module_favorites_order_idx').on(table.userId, table.displayOrder)
  })
)

export const distributorProviders = mysqlTable(
  'distributor_providers',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    distributorId: varchar('distributor_id', { length: 128 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 128 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    ...timestampColumns()
  },
  table => ({
    uniqueDistributorProvider: uniqueIndex('distributor_provider_unique').on(
      table.distributorId,
      table.providerId
    )
  })
)

export const organizationInvitations = mysqlTable(
  'organization_invitations',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 })
      .notNull()
      .$type<RbacRole>()
      .default('viewer'),
    token: varchar('token', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('pending'),
    invitedByUserId: varchar('invited_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    acceptedAt: timestamp('accepted_at', { fsp: 3 }),
    declinedAt: timestamp('declined_at', { fsp: 3 }),
    ...timestampColumns()
  },
  table => ({
    tokenIdx: uniqueIndex('organization_invites_token_idx').on(table.token)
  })
)

export const organizationSsoDomains = mysqlTable(
  'organization_sso_domains',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    domain: varchar('domain', { length: 255 }).notNull(),
    verificationStatus: varchar('verification_status', { length: 50 }).notNull().default('pending'),
    verificationToken: varchar('verification_token', { length: 255 }),
    verifiedAt: timestamp('verified_at', { fsp: 3 }),
    ...timestampColumns()
  },
  (table) => ({
    domainUnique: uniqueIndex('organization_sso_domains_domain_unique').on(table.domain),
    orgIdx: index('organization_sso_domains_org_idx').on(table.organizationId)
  })
)

export const organizationAuthSettings = mysqlTable('organization_auth_settings', {
  organizationId: varchar('organization_id', { length: 128 })
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  idpType: varchar('idp_type', { length: 50 }).notNull().default('none'),
  ssoEnforced: boolean('sso_enforced').notNull().default(false),
  allowLocalLoginForOwners: boolean('allow_local_login_for_owners')
    .notNull()
    .default(true),
  requireMfaOnSensitiveActions: boolean('require_mfa_on_sensitive_actions')
    .notNull()
    .default(false),
  requireMfaOnContextSwitch: boolean('require_mfa_on_context_switch')
    .notNull()
    .default(false),
  requireMfa: boolean('require_mfa')
    .notNull()
    .default(false),
  idpConfig: text('idp_config'),
  ...timestampColumns()
})

export const tenantAuthSettings = mysqlTable('tenant_auth_settings', {
  tenantId: varchar('tenant_id', { length: 128 })
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  requireMfaOnSensitiveActions: boolean('require_mfa_on_sensitive_actions')
    .notNull()
    .default(false),
  requireMfaOnContextSwitch: boolean('require_mfa_on_context_switch')
    .notNull()
    .default(false),
  ...timestampColumns()
})

export const mfaSessions = mysqlTable('mfa_sessions', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
  userId: varchar('user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 255 }).notNull(), // e.g., 'global', 'org:<id>', 'tenant:<id>'
  expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
  ...timestampColumns()
}, table => ({
  userScopeIdx: uniqueIndex('mfa_sessions_user_scope_idx').on(table.userId, table.scope)
}))

export const auditLogs = mysqlTable('audit_logs', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
  userId: varchar('user_id', { length: 128 })
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 255 }).notNull(),
  severity: varchar('severity', { length: 50 }).notNull().default('info').$type<'info' | 'warning' | 'error' | 'critical'>(),
  requestId: varchar('request_id', { length: 255 }),
  endpoint: varchar('endpoint', { length: 255 }),
  method: varchar('method', { length: 10 }),
  orgId: varchar('org_id', { length: 128 }),
  tenantId: varchar('tenant_id', { length: 128 }),
  fromContext: text('from_context'),
  toContext: text('to_context'),
  ip: varchar('ip', { length: 50 }),
  userAgent: varchar('user_agent', { length: 512 }),
  meta: text('meta'),
  ...timestampColumns()
}, table => ({
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.createdAt),
  eventTypeIdx: index('audit_logs_event_type_idx').on(table.eventType),
  requestIdIdx: index('audit_logs_request_id_idx').on(table.requestId),
  orgIdIdx: index('audit_logs_org_id_idx').on(table.orgId),
  tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId)
}))

/**
 * Organization API Tokens (PAT - Personal Access Tokens)
 *
 * Used for programmatic access to the API by external integrations.
 * Token format: msp_pat.<prefix>.<secret>
 * - prefix: Used for DB lookup (unique, base32)
 * - secret: Hashed with scrypt + salt + pepper
 */
export const orgApiTokens = mysqlTable(
  'org_api_tokens',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Token lookup prefix (first part of token, globally unique)
    prefix: varchar('prefix', { length: 255 }).notNull(),
    // Hash algorithm and version
    hashAlg: varchar('hash_alg', { length: 50 }).notNull().default('scrypt-v1'),
    hashVersion: int('hash_version').notNull().default(1),
    // Hash parameters (JSON: N, r, p, keylen)
    hashParams: varchar('hash_params', { length: 256 }).notNull(),
    // Salt for hashing (base64)
    salt: varchar('salt', { length: 255 }).notNull(),
    // Hash of the secret portion only (base64)
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    // Key ID for pepper (for KeyVault rotation)
    pepperKid: varchar('pepper_kid', { length: 255 }).notNull(),
    // Scopes granted to this token (JSON array of strings)
    scopes: text('scopes').notNull(),
    // Resource constraints (JSON object)
    resourceConstraints: text('resource_constraints'),
    // Human-readable description
    description: text('description'),
    // Who created the token
    createdByUserId: varchar('created_by_user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Expiration and revocation
    expiresAt: timestamp('expires_at', { fsp: 3 }),
    revokedAt: timestamp('revoked_at', { fsp: 3 }),
    // Usage tracking
    lastUsedAt: timestamp('last_used_at', { fsp: 3 }),
    ...timestampColumns()
  },
  (table) => ({
    // Prefix must be globally unique for fast lookup
    prefixUnique: uniqueIndex('org_api_tokens_prefix_unique').on(table.prefix),
    // Org lookup
    orgIdx: index('org_api_tokens_org_idx').on(table.organizationId),
    // Active tokens (not revoked)
    orgActiveIdx: index('org_api_tokens_org_active_idx').on(
      table.organizationId,
      table.revokedAt
    )
  })
)

export const organizationIdentityProviders = mysqlTable(
  'organization_identity_providers',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull(),
    type: varchar('type', { length: 50 }).notNull().default('oidc'),
    providerName: varchar('provider_name', { length: 255 }).notNull(),
    issuer: text('issuer'),
    clientId: varchar('client_id', { length: 255 }),
    clientSecret: text('client_secret'),
    redirectUri: text('redirect_uri'),
    metadataUrl: text('metadata_url'),
    audience: varchar('audience', { length: 255 }),
    scopes: text('scopes'),
    isEnabled: boolean('is_enabled').notNull().default(false),
    enforceForUserType: varchar('enforce_for_user_type', { length: 50 }),
    ...timestampColumns()
  },
  table => ({
    orgProviderIdx: uniqueIndex('organization_idp_unique').on(
      table.organizationId,
      table.providerName
    ),
    orgFk: foreignKey({
      name: 'org_idp_organization_id_fk',
      columns: [table.organizationId],
      foreignColumns: [organizations.id]
    }).onDelete('cascade')
  })
)

export const emailProviderProfiles = mysqlTable(
  'email_provider_profiles',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    targetType: varchar('target_type', { length: 50 }).notNull().$type<'global' | 'provider' | 'distributor' | 'organization'>(),
    targetKey: varchar('target_key', { length: 255 }).notNull(),
    tenantId: varchar('tenant_id', { length: 128 }).references(() => tenants.id, {
      onDelete: 'cascade'
    }),
    organizationId: varchar('organization_id', { length: 128 }).references(() => organizations.id, {
      onDelete: 'cascade'
    }),
    providerType: varchar('provider_type', { length: 50 }).notNull(),
    isActive: boolean('is_active').notNull().default(false),
    fromName: varchar('from_name', { length: 255 }),
    fromEmail: varchar('from_email', { length: 255 }),
    replyToEmail: varchar('reply_to_email', { length: 255 }),
    subjectPrefix: varchar('subject_prefix', { length: 255 }),
    supportContact: varchar('support_contact', { length: 255 }),
    emailDarkMode: boolean('email_dark_mode').notNull().default(false),
    brandingConfig: text('branding_config'),
    encryptedConfig: text('encrypted_config'),
    encryptionIv: varchar('encryption_iv', { length: 255 }),
    encryptionAuthTag: varchar('encryption_auth_tag', { length: 255 }),
    configVersion: int('config_version').notNull().default(1),
    lastTestedAt: timestamp('last_tested_at', { fsp: 3 }),
    lastTestStatus: varchar('last_test_status', { length: 50 }),
    lastTestError: text('last_test_error'),
    ...timestampColumns()
  },
  table => ({
    targetKeyIdx: uniqueIndex('email_provider_target_key_idx').on(table.targetKey),
    orgUnique: uniqueIndex('email_provider_org_unique').on(table.organizationId),
    tenantUnique: uniqueIndex('email_provider_tenant_unique').on(table.tenantId)
  })
)

export const dnsZones = mysqlTable(
  'dns_zones',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    provider: varchar('provider', { length: 50 }).default('cloudflare'),
    accountId: varchar('account_id', { length: 255 }),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('dns_zones_org_name_idx').on(table.organizationId, table.name)
  })
)

export const dnsRecords = mysqlTable(
  'dns_records',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    zoneId: varchar('zone_id', { length: 128 })
      .notNull()
      .references(() => dnsZones.id, { onDelete: 'cascade' }),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    content: text('content').notNull(),
    ttl: int('ttl').notNull().default(3600),
    proxied: boolean('proxied').notNull().default(false),
    priority: int('priority'),
    ...timestampColumns()
  },
  table => ({
    zoneRecordIdx: uniqueIndex('dns_records_zone_name_idx').on(
      table.zoneId,
      table.name,
      table.type
    )
  })
)

export const containerProjects = mysqlTable(
  'container_projects',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    environment: varchar('environment', { length: 50 }).default('production'),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('container_projects_org_name_idx').on(
      table.organizationId,
      table.name
    )
  })
)

export const containerInstances = mysqlTable(
  'container_instances',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    projectId: varchar('project_id', { length: 128 })
      .notNull()
      .references(() => containerProjects.id, { onDelete: 'cascade' }),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('RUNNING'),
    image: varchar('image', { length: 255 }).notNull(),
    cpu: varchar('cpu', { length: 50 }).notNull(),
    memory: varchar('memory', { length: 50 }).notNull(),
    region: varchar('region', { length: 50 }).default('eu-north-1'),
    metadata: text('metadata'),
    ...timestampColumns()
  },
  table => ({
    projectNameIdx: uniqueIndex('container_instances_project_name_idx').on(
      table.projectId,
      table.name
    )
  })
)

export const ncentralDevices = mysqlTable(
  'ncentral_devices',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('online'),
    type: varchar('type', { length: 50 }).notNull().default('server'),
    osVersion: varchar('os_version', { length: 255 }),
    region: varchar('region', { length: 50 }),
    lastSeenAt: timestamp('last_seen_at', { fsp: 3 }),
    metadata: text('metadata'),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('ncentral_devices_org_name_idx').on(
      table.organizationId,
      table.name
    )
  })
)

export const vmInstances = mysqlTable(
  'vm_instances',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    platform: varchar('platform', { length: 50 }).notNull(),
    powerState: varchar('power_state', { length: 50 }).notNull(),
    cpu: varchar('cpu', { length: 50 }).notNull(),
    memory: varchar('memory', { length: 50 }).notNull(),
    disk: varchar('disk', { length: 50 }).notNull(),
    region: varchar('region', { length: 50 }),
    lastBackupAt: timestamp('last_backup_at', { fsp: 3 }),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('vm_instances_org_name_idx').on(table.organizationId, table.name)
  })
)

export const monitoringAlerts = mysqlTable('monitoring_alerts', {
  id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
  organizationId: varchar('organization_id', { length: 128 })
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  severity: varchar('severity', { length: 50 }).notNull().default('info'),
  status: varchar('status', { length: 50 }).notNull().default('open'),
  source: varchar('source', { length: 255 }),
  triggeredAt: timestamp('triggered_at', { fsp: 3 }),
  resolvedAt: timestamp('resolved_at', { fsp: 3 }),
  metadata: text('metadata'),
  ...timestampColumns()
})

export const wordpressSites = mysqlTable(
  'wordpress_sites',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    domain: varchar('domain', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('healthy'),
    version: varchar('version', { length: 50 }),
    region: varchar('region', { length: 50 }),
    lastBackupAt: timestamp('last_backup_at', { fsp: 3 }),
    ...timestampColumns()
  },
  table => ({
    orgDomainIdx: uniqueIndex('wordpress_sites_org_domain_idx').on(
      table.organizationId,
      table.domain
    )
  })
)

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  parent: one(tenants, {
    fields: [tenants.parentTenantId],
    references: [tenants.id],
    relationName: 'parentTenant'
  }),
  children: many(tenants, {
    relationName: 'parentTenant'
  }),
  memberships: many(tenantMemberships),
  invitations: many(tenantInvitations),
  organizations: many(organizations),
  modulePolicies: many(tenantModulePolicies)
}))

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [organizations.tenantId],
    references: [tenants.id]
  }),
  memberships: many(organizationMemberships),
  invitations: many(organizationInvitations),
  identityProviders: many(organizationIdentityProviders),
  ssoDomains: many(organizationSsoDomains),
  authSettings: one(organizationAuthSettings, {
    fields: [organizations.id],
    references: [organizationAuthSettings.organizationId]
  }),
  dnsZones: many(dnsZones),
  containerProjects: many(containerProjects),
  vmInstances: many(vmInstances),
  wordpressSites: many(wordpressSites),
  ncentralDevices: many(ncentralDevices),
  monitoringAlerts: many(monitoringAlerts),
  emailProviders: many(emailProviderProfiles),
  modulePolicies: many(organizationModulePolicies),
  cloudflareCredentials: one(cloudflareCredentials, {
    fields: [organizations.id],
    references: [cloudflareCredentials.organizationId]
  })
}))

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMemberships),
  invitations: many(organizationInvitations),
  tenantMemberships: many(tenantMemberships),
  tenantInvitations: many(tenantInvitations),
  favorites: many(userModuleFavorites)
}))

export const userModuleFavoriteRelations = relations(userModuleFavorites, ({ one }) => ({
  user: one(users, {
    fields: [userModuleFavorites.userId],
    references: [users.id]
  })
}))

export const tenantMembershipRelations = relations(tenantMemberships, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantMemberships.tenantId],
    references: [tenants.id]
  }),
  user: one(users, {
    fields: [tenantMemberships.userId],
    references: [users.id]
  }),
  roles: many(tenantMemberRoles)
}))

export const tenantMemberRoleRelations = relations(tenantMemberRoles, ({ one }) => ({
  membership: one(tenantMemberships, {
    fields: [tenantMemberRoles.membershipId],
    references: [tenantMemberships.id]
  })
}))

export const tenantInvitationRelations = relations(tenantInvitations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantInvitations.tenantId],
    references: [tenants.id]
  }),
  invitedBy: one(users, {
    fields: [tenantInvitations.invitedByUserId],
    references: [users.id]
  })
}))

export const tenantAuthSettingsRelations = relations(tenantAuthSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantAuthSettings.tenantId],
    references: [tenants.id]
  })
}))

export const organizationAuthSettingsRelations = relations(
  organizationAuthSettings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationAuthSettings.organizationId],
      references: [organizations.id]
    })
  })
)

export const organizationSsoDomainsRelations = relations(
  organizationSsoDomains,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationSsoDomains.organizationId],
      references: [organizations.id]
    })
  })
)

export const membershipRelations = relations(organizationMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id]
  }),
  user: one(users, {
    fields: [organizationMemberships.userId],
    references: [users.id]
  })
}))

export const dnsZoneRelations = relations(dnsZones, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [dnsZones.organizationId],
    references: [organizations.id]
  }),
  records: many(dnsRecords)
}))

export const dnsRecordRelations = relations(dnsRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [dnsRecords.organizationId],
    references: [organizations.id]
  }),
  zone: one(dnsZones, {
    fields: [dnsRecords.zoneId],
    references: [dnsZones.id]
  })
}))

export const containerProjectRelations = relations(containerProjects, ({ many, one }) => ({
  organization: one(organizations, {
    fields: [containerProjects.organizationId],
    references: [organizations.id]
  }),
  instances: many(containerInstances)
}))

export const containerInstanceRelations = relations(containerInstances, ({ one }) => ({
  project: one(containerProjects, {
    fields: [containerInstances.projectId],
    references: [containerProjects.id]
  }),
  organization: one(organizations, {
    fields: [containerInstances.organizationId],
    references: [organizations.id]
  })
}))

export const vmInstanceRelations = relations(vmInstances, ({ one }) => ({
  organization: one(organizations, {
    fields: [vmInstances.organizationId],
    references: [organizations.id]
  })
}))

export const wordpressSiteRelations = relations(wordpressSites, ({ one }) => ({
  organization: one(organizations, {
    fields: [wordpressSites.organizationId],
    references: [organizations.id]
  })
}))

export const emailProviderProfileRelations = relations(emailProviderProfiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailProviderProfiles.organizationId],
    references: [organizations.id]
  })
}))

/**
 * Module policies at tenant level (distributor/provider)
 * These policies define which modules are available and which permissions are allowed
 * at the tenant level. Organizations inherit from their tenant's policy.
 */
export const tenantModulePolicies = mysqlTable(
  'tenant_module_policies',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    tenantId: varchar('tenant_id', { length: 128 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    mode: varchar('mode', { length: 50 })
      .$type<'inherit' | 'default-closed' | 'allowlist' | 'blocked'>()
      .notNull()
      .default('inherit'),
    enabled: boolean('enabled').notNull().default(true),
    // If disabled is true, module is visible but grayed out (deactivated)
    // If enabled is false, module is hidden completely (inactivated)
    disabled: boolean('disabled').notNull().default(false),
    // Coming soon message for marketing/upselling (shows when disabled=true and message is set)
    comingSoonMessage: text('coming_soon_message'),
    // JSON object storing permission overrides
    // Example: { "cloudflare:write": false } to disable write access
    permissionOverrides: text('permission_overrides'),
    // JSON array storing allowed module roles for this tenant
    // null => inherit defaults, [] => block, ["dns-admin"] => override
    allowedRoles: text('allowed_roles'),
    ...timestampColumns()
  },
  table => ({
    tenantModuleIdx: uniqueIndex('tenant_module_policy_unique').on(
      table.tenantId,
      table.moduleId
    ),
    tenantIdx: index('tenant_module_policy_tenant_idx').on(table.tenantId)
  })
)

/**
 * Module policies at organization level
 * These policies can further restrict what's allowed at tenant level
 * Organizations can only restrict, not expand permissions
 */
export const organizationModulePolicies = mysqlTable(
  'organization_module_policies',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    mode: varchar('mode', { length: 50 })
      .$type<'inherit' | 'default-closed' | 'allowlist' | 'blocked'>()
      .notNull()
      .default('inherit'),
    enabled: boolean('enabled').notNull().default(true),
    // If disabled is true, module is visible but grayed out (deactivated)
    // If enabled is false, module is hidden completely (inactivated)
    disabled: boolean('disabled').notNull().default(false),
    // Coming soon message for marketing/upselling (shows when disabled=true and message is set)
    comingSoonMessage: text('coming_soon_message'),
    // JSON object storing permission overrides
    // Example: { "cloudflare:write": false } to disable write access
    permissionOverrides: text('permission_overrides'),
    // JSON array storing allowed module roles for this organization
    allowedRoles: text('allowed_roles'),
    ...timestampColumns()
  },
  table => ({
    orgModuleIdx: uniqueIndex('organization_module_policy_unique').on(
      table.organizationId,
      table.moduleId
    ),
    orgIdx: index('organization_module_policy_org_idx').on(table.organizationId)
  })
)

export const pluginAclEntries = mysqlTable(
  'plugin_acl_entries',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    pluginKey: varchar('plugin_key', { length: 255 }).notNull(),
    operation: varchar('operation', { length: 255 }).notNull(),
    groupId: varchar('group_id', { length: 128 })
      .notNull()
      .references(() => orgGroups.id, { onDelete: 'cascade' }),
    ...timestampColumns()
  },
  (table) => ({
    orgPluginOpIdx: index('plugin_acl_org_plugin_op_idx').on(table.organizationId, table.pluginKey, table.operation),
    orgPluginGroupUnique: uniqueIndex('plugin_acl_unique').on(
      table.organizationId,
      table.pluginKey,
      table.operation,
      table.groupId
    )
  })
)

export const orgGroupModulePermissions = mysqlTable(
  'org_group_module_permissions',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    groupId: varchar('group_id', { length: 128 })
      .notNull()
      .references(() => orgGroups.id, { onDelete: 'cascade' }),
    moduleKey: varchar('module_key', { length: 255 }).notNull(),
    permissionKey: varchar('permission_key', { length: 255 }).notNull(),
    effect: varchar('effect', { length: 50 })
      .notNull()
      .$type<'grant' | 'deny'>(),
    ...timestampColumns()
  },
  (table) => ({
    uniqueIdx: uniqueIndex('org_group_module_permissions_unique').on(
      table.organizationId,
      table.groupId,
      table.moduleKey,
      table.permissionKey
    ),
    groupIdx: index('org_group_module_permissions_group_idx').on(table.groupId),
    moduleIdx: index('org_group_module_permissions_module_idx').on(table.moduleKey, table.permissionKey)
  })
)

/**
 * Cloudflare API credentials per organization
 * Stores encrypted API tokens for Cloudflare integration
 */
export const cloudflareCredentials = mysqlTable(
  'cloudflare_credentials',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Encrypted API token
    encryptedApiToken: text('encrypted_api_token').notNull(),
    encryptionIv: varchar('encryption_iv', { length: 255 }).notNull(),
    encryptionAuthTag: varchar('encryption_auth_tag', { length: 255 }).notNull(),
    // Optional: Cloudflare account ID if needed
    accountId: varchar('account_id', { length: 255 }),
    // Status of the credentials
    isActive: boolean('is_active').notNull().default(true),
    lastValidatedAt: timestamp('last_validated_at', { fsp: 3 }),
    ...timestampColumns()
  },
  table => ({
    orgUnique: uniqueIndex('cloudflare_credentials_org_unique').on(table.organizationId)
  })
)

export const tenantModulePolicyRelations = relations(tenantModulePolicies, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantModulePolicies.tenantId],
    references: [tenants.id]
  })
}))

export const organizationModulePolicyRelations = relations(
  organizationModulePolicies,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationModulePolicies.organizationId],
      references: [organizations.id]
    })
  })
)

export const brandingThemeRelations = relations(brandingThemes, ({ one }) => ({
  organization: one(organizations, {
    fields: [brandingThemes.organizationId],
    references: [organizations.id]
  }),
  tenant: one(tenants, {
    fields: [brandingThemes.tenantId],
    references: [tenants.id]
  }),
  createdBy: one(users, {
    fields: [brandingThemes.createdByUserId],
    references: [users.id]
  }),
  updatedBy: one(users, {
    fields: [brandingThemes.updatedByUserId],
    references: [users.id]
  })
}))

/**
 * Module-specific roles that can be assigned per module
 */
export const moduleRoles = mysqlTable(
  'module_roles',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    roleKey: varchar('role_key', { length: 255 }).notNull(),
    roleName: varchar('role_name', { length: 255 }).notNull(),
    description: text('description'),
    // JSON encoded capabilities for UI/logic hints
    capabilities: text('capabilities'),
    sortOrder: int('sort_order').notNull().default(0),
    ...timestampColumns()
  },
  table => ({
    moduleRoleUnique: uniqueIndex('module_roles_module_role_idx').on(table.moduleId, table.roleKey),
    moduleRoleModuleIdx: index('module_roles_module_idx').on(table.moduleId)
  })
)

export const roleModuleRoleMappings = mysqlTable(
  'role_module_role_mappings',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    moduleRoleKey: varchar('module_role_key', { length: 255 }).notNull(),
    rbacRole: varchar('rbac_role', { length: 50 }).notNull(),
    ...timestampColumns()
  },
  table => ({
    roleModuleRoleMappingUnique: uniqueIndex('role_module_role_mapping_unique').on(
      table.rbacRole,
      table.moduleId,
      table.moduleRoleKey
    ),
    roleModuleRoleMappingModuleIdx: index('role_module_role_mapping_module_idx').on(table.moduleId)
  })
)

/**
 * Module role -> permission mapping per module (plugin-driven)
 */
export const moduleRolePermissions = mysqlTable(
  'module_role_permissions',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    moduleKey: varchar('module_key', { length: 255 })
      .notNull()
      .references(() => modules.key, { onDelete: 'cascade' }),
    roleKey: varchar('role_key', { length: 255 }).notNull(),
    permissionKey: varchar('permission_key', { length: 255 }).notNull(),
    ...timestampColumns()
  },
  (table) => ({
    moduleRolePermIdx: index('module_role_permissions_idx').on(
      table.moduleKey,
      table.roleKey,
      table.permissionKey
    )
  })
)

/**
 * Default module roles for each app/org role
 */
export const moduleRoleDefaults = mysqlTable(
  'module_role_defaults',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    moduleKey: varchar('module_key', { length: 255 })
      .notNull()
      .references(() => modules.key, { onDelete: 'cascade' }),
    appRoleKey: varchar('app_role_key', { length: 50 }).notNull(),
    moduleRoleKey: varchar('module_role_key', { length: 255 }).notNull(),
    ...timestampColumns()
  },
  (table) => ({
    moduleRoleDefaultsIdx: index('module_role_defaults_idx').on(table.moduleKey, table.appRoleKey)
  })
)

/**
 * User-specific module role overrides per organization
 */
export const memberModuleRoleOverrides = mysqlTable(
  'member_module_role_overrides',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    roleKey: varchar('role_key', { length: 255 }).notNull(),
    effect: varchar('effect', { length: 50 })
      .notNull()
      .$type<'grant' | 'deny'>(),
    createdByUserId: varchar('created_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    updatedByUserId: varchar('updated_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    ...timestampColumns()
  },
  table => ({
    memberModuleRoleOverrideUnique: uniqueIndex('member_module_role_overrides_unique').on(
      table.organizationId,
      table.userId,
      table.moduleId,
      table.roleKey
    ),
    memberModuleRoleOverrideOrgIdx: index('member_module_role_overrides_org_idx').on(
      table.organizationId,
      table.moduleId
    )
  })
)

export const cloudflareCredentialsRelations = relations(cloudflareCredentials, ({ one }) => ({
  organization: one(organizations, {
    fields: [cloudflareCredentials.organizationId],
    references: [organizations.id]
  })
}))

/**
 * User-specific module permissions per organization
 * Allows granular control over which permissions a user has for specific modules
 * Can only restrict (deny) permissions, not expand beyond the user's role
 */
export const userModulePermissions = mysqlTable(
  'user_module_permissions',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    organizationId: varchar('organization_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 255 }).notNull(),
    // JSON object storing denied permissions
    // Example: { "cloudflare:write": true } means write is denied for this user
    // If permission is not in this object, it follows the user's role permissions
    deniedPermissions: text('denied_permissions'),
    ...timestampColumns()
  },
  table => ({
    userModuleUnique: uniqueIndex('user_module_permission_unique').on(
      table.organizationId,
      table.userId,
      table.moduleId
    ),
    userOrgIdx: index('user_module_permission_user_org_idx').on(
      table.organizationId,
      table.userId
    )
  })
)

export const userModulePermissionRelations = relations(userModulePermissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [userModulePermissions.organizationId],
    references: [organizations.id]
  }),
  user: one(users, {
    fields: [userModulePermissions.userId],
    references: [users.id]
  })
}))

export const mspOrgDelegations = mysqlTable(
  'msp_org_delegations',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    orgId: varchar('org_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    subjectType: varchar('subject_type', { length: 50 }).notNull(), // 'user' (future: msp_group, msp_role)
    subjectId: varchar('subject_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: varchar('source', { length: 50 }).notNull().default('ad_hoc').$type<'ad_hoc' | 'msp_scope'>(),
    supplierTenantId: varchar('supplier_tenant_id', { length: 128 }).references(() => tenants.id, { onDelete: 'cascade' }),
    createdBy: varchar('created_by', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { fsp: 3 }),
    note: text('note'),
    revokedAt: timestamp('revoked_at', { fsp: 3 }),
    revokedBy: varchar('revoked_by', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    ...timestampColumns()
  },
  (table) => ({
    activeUnique: uniqueIndex('msp_org_delegations_active_unique').on(
      table.orgId,
      table.subjectType,
      table.subjectId,
      table.revokedAt,
      table.expiresAt
    ),
    subjectIdx: index('msp_org_delegations_subject_idx').on(table.subjectType, table.subjectId),
    orgIdx: index('msp_org_delegations_org_idx').on(table.orgId),
    expiresIdx: index('msp_org_delegations_expires_idx').on(table.expiresAt),
    revokedIdx: index('msp_org_delegations_revoked_idx').on(table.revokedAt),
    tenantUserIdx: index('msp_org_delegations_tenant_user_idx').on(table.supplierTenantId, table.subjectId)
  })
)

export const mspOrgDelegationPermissions = mysqlTable(
  'msp_org_delegation_permissions',
  {
    delegationId: varchar('delegation_id', { length: 128 })
      .notNull(),
    permissionKey: varchar('permission_key', { length: 255 }).notNull()
    // Note: permissionKey is a logical reference to manifest permission keys, not a DB foreign key
  },
  (table) => ({
    pk: primaryKey({ columns: [table.delegationId, table.permissionKey] }),
    permissionIdx: index('msp_org_delegation_permissions_perm_idx').on(table.permissionKey),
    delegationFk: foreignKey({
      name: 'msp_deleg_perms_delegation_id_fk',
      columns: [table.delegationId],
      foreignColumns: [mspOrgDelegations.id]
    }).onDelete('cascade')
  })
)

/**
 * MSP Delegation Invitations - Pending invitations for external users to receive delegation access
 * Similar to organizationInvitations but for delegation-based access without membership
 */
export const mspOrgDelegationInvitations = mysqlTable(
  'msp_org_delegation_invitations',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    orgId: varchar('org_id', { length: 128 })
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    permissionKeys: text('permission_keys').notNull(), // JSON array of permission keys
    note: text('note'),
    status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, accepted, cancelled, expired
    invitedByUserId: varchar('invited_by_user_id', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    expiresAt: timestamp('expires_at', { fsp: 3 }).notNull(),
    delegationExpiresAt: timestamp('delegation_expires_at', { fsp: 3 }), // When the resulting delegation should expire
    acceptedAt: timestamp('accepted_at', { fsp: 3 }),
    delegationId: varchar('delegation_id', { length: 128 }), // Set when accepted — FK defined below
    ...timestampColumns()
  },
  table => ({
    tokenIdx: uniqueIndex('msp_delegation_invites_token_idx').on(table.token),
    orgEmailIdx: index('msp_delegation_invites_org_email_idx').on(table.orgId, table.email),
    delegationFk: foreignKey({
      name: 'msp_deleg_inv_delegation_id_fk',
      columns: [table.delegationId],
      foreignColumns: [mspOrgDelegations.id]
    }).onDelete('set null')
  })
)

/**
 * MSP Roles - Dynamically defined roles for MSP access
 * Each role is tenant-specific and defines which module permissions it grants
 *
 * role_kind='template': Distributor-level templates (publishable, never assignable)
 * role_kind='role': Provider-level roles (assignable to members)
 */
export const mspRoles = mysqlTable(
  'msp_roles',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    tenantId: varchar('tenant_id', { length: 128 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 255 }).notNull(), // e.g., 'msp-cloudflare-admin'
    name: varchar('name', { length: 255 }).notNull(), // Display name, e.g., 'Cloudflare Admin'
    description: text('description'), // Optional description
    isSystem: boolean('is_system').notNull().default(false), // true for built-in/system roles
    createdBy: varchar('created_by', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    // Template support fields
    roleKind: varchar('role_kind', { length: 50 }).notNull().default('role').$type<'template' | 'role'>(),
    sourceTemplateId: varchar('source_template_id', { length: 128 }), // Self-reference to msp_roles, manually managed
    publishedAt: timestamp('published_at', { fsp: 3 }), // Only for templates
    templateVersion: int('template_version').notNull().default(1), // Bumped on publish update
    // Sync metadata (for roles derived from templates)
    sourceTemplateVersion: int('source_template_version'), // Version at time of create/sync
    lastSyncedAt: timestamp('last_synced_at', { fsp: 3 }),
    permissionsFingerprint: varchar('permissions_fingerprint', { length: 255 }), // Hash of sorted permission list
    ...timestampColumns()
  },
  (table) => ({
    tenantKeyUnique: uniqueIndex('msp_roles_tenant_key_unique').on(table.tenantId, table.key),
    tenantIdx: index('msp_roles_tenant_idx').on(table.tenantId),
    roleKindTenantIdx: index('msp_roles_kind_tenant_idx').on(table.tenantId, table.roleKind),
    sourceTemplateIdx: index('msp_roles_source_template_idx').on(table.sourceTemplateId)
  })
)

/**
 * MSP Role Permissions - Maps MSP roles to module permissions
 * FK to module_permissions ensures integrity (permissions marked as removed are still valid for FK)
 */
export const mspRolePermissions = mysqlTable(
  'msp_role_permissions',
  {
    roleId: varchar('role_id', { length: 128 })
      .notNull()
      .references(() => mspRoles.id, { onDelete: 'cascade' }),
    moduleKey: varchar('module_key', { length: 255 }).notNull(), // e.g., 'cloudflare-dns'
    permissionKey: varchar('permission_key', { length: 255 }).notNull() // e.g., 'cloudflare-dns:view'
    // Note: FK to module_permissions(module_key, permission_key) is logical, not enforced by DB
    // Special values: moduleKey='*' means all modules, permissionKey='*' means all permissions
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.moduleKey, table.permissionKey] }),
    roleIdx: index('msp_role_permissions_role_idx').on(table.roleId),
    moduleIdx: index('msp_role_permissions_module_idx').on(table.moduleKey)
  })
)

/**
 * Tenant Member MSP Roles - Join table for assigning MSP roles to tenant members
 */
export const tenantMemberMspRoles = mysqlTable(
  'tenant_member_msp_roles',
  {
    tenantMembershipId: varchar('tenant_membership_id', { length: 128 })
      .notNull(),
    roleId: varchar('role_id', { length: 128 })
      .notNull()
      .references(() => mspRoles.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tenantMembershipId, table.roleId] }),
    membershipIdx: index('tenant_member_msp_roles_membership_idx').on(table.tenantMembershipId),
    roleIdx: index('tenant_member_msp_roles_role_idx').on(table.roleId),
    membershipFk: foreignKey({
      name: 'tm_msp_roles_membership_id_fk',
      columns: [table.tenantMembershipId],
      foreignColumns: [tenantMemberships.id]
    }).onDelete('cascade')
  })
)

// ────────────────────────────────────────────────────────────────────────────
// OPERATIONS: Tenant Incidents (Driftmeddelanden) & News Posts
// ────────────────────────────────────────────────────────────────────────────

export type IncidentSeverity = 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
export type IncidentStatus = 'active' | 'resolved' | 'archived'
export type NewsPostStatus = 'draft' | 'published' | 'archived'
export type IncidentMuteTargetType = 'tenant' | 'organization'

/**
 * Tenant Incidents (Driftmeddelanden)
 * Created by distributors/providers, inherited downstream.
 */
export const tenantIncidents = mysqlTable(
  'tenant_incidents',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    // Source can be either a tenant (provider/distributor) or an organization (internal incidents)
    // At least one of these must be set
    sourceTenantId: varchar('source_tenant_id', { length: 128 })
      .references(() => tenants.id, { onDelete: 'cascade' }),
    sourceOrganizationId: varchar('source_organization_id', { length: 128 })
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    bodyMarkdown: text('body_markdown'),
    severity: varchar('severity', { length: 50 }).notNull().$type<IncidentSeverity>().default('notice'),
    status: varchar('status', { length: 50 }).notNull().$type<IncidentStatus>().default('active'),
    startsAt: timestamp('starts_at', { fsp: 3 }),
    endsAt: timestamp('ends_at', { fsp: 3 }),
    resolvedAt: timestamp('resolved_at', { fsp: 3 }),
    createdByUserId: varchar('created_by_user_id', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    updatedByUserId: varchar('updated_by_user_id', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { fsp: 3 }),
    deletedByUserId: varchar('deleted_by_user_id', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    ...timestampColumns()
  },
  (table) => ({
    sourceTenantIdx: index('tenant_incidents_source_tenant_idx').on(table.sourceTenantId),
    sourceOrgIdx: index('tenant_incidents_source_org_idx').on(table.sourceOrganizationId),
    statusIdx: index('tenant_incidents_status_idx').on(table.status),
    slugTenantIdx: index('tenant_incidents_slug_tenant_idx').on(table.sourceTenantId, table.slug),
    slugOrgIdx: index('tenant_incidents_slug_org_idx').on(table.sourceOrganizationId, table.slug),
    activeIdx: index('tenant_incidents_active_idx').on(
      table.sourceTenantId,
      table.status,
      table.startsAt,
      table.endsAt
    ),
    deletedIdx: index('tenant_incidents_deleted_idx').on(table.deletedAt)
  })
)

/**
 * Tenant Incident Mutes
 * Allows downstream tenants/organizations to hide inherited incidents.
 */
export const tenantIncidentMutes = mysqlTable(
  'tenant_incident_mutes',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    incidentId: varchar('incident_id', { length: 128 })
      .notNull()
      .references(() => tenantIncidents.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 50 }).notNull().$type<IncidentMuteTargetType>(),
    targetTenantId: varchar('target_tenant_id', { length: 128 }).references(() => tenants.id, { onDelete: 'cascade' }),
    organizationId: varchar('organization_id', { length: 128 }).references(() => organizations.id, { onDelete: 'cascade' }),
    mutedByUserId: varchar('muted_by_user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mutedAt: timestamp('muted_at', { fsp: 3 })
      .notNull()
      .defaultNow(),
    muteUntil: timestamp('mute_until', { fsp: 3 }),
    mutedReason: text('muted_reason')
  },
  (table) => ({
    incidentIdx: index('tenant_incident_mutes_incident_idx').on(table.incidentId),
    tenantMuteUnique: uniqueIndex('tenant_incident_mutes_tenant_unique').on(
      table.incidentId,
      table.targetType,
      table.targetTenantId
    ),
    orgMuteUnique: uniqueIndex('tenant_incident_mutes_org_unique').on(
      table.incidentId,
      table.targetType,
      table.organizationId
    )
  })
)

/**
 * Tenant Incident User Mutes
 * Allows individual users to hide incidents for themselves only (personal mute).
 */
export const tenantIncidentUserMutes = mysqlTable(
  'tenant_incident_user_mutes',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    incidentId: varchar('incident_id', { length: 128 })
      .notNull()
      .references(() => tenantIncidents.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mutedAt: timestamp('muted_at', { fsp: 3 })
      .notNull()
      .defaultNow(),
    muteUntil: timestamp('mute_until', { fsp: 3 })
  },
  (table) => ({
    incidentIdx: index('tenant_incident_user_mutes_incident_idx').on(table.incidentId),
    userIdx: index('tenant_incident_user_mutes_user_idx').on(table.userId, table.mutedAt),
    userMuteUnique: uniqueIndex('tenant_incident_user_mutes_unique').on(
      table.incidentId,
      table.userId
    )
  })
)

/**
 * Tenant News Posts (Nyheter)
 * Blog-style posts created by distributors/providers, inherited downstream.
 */
export const tenantNewsPosts = mysqlTable(
  'tenant_news_posts',
  {
    id: varchar('id', { length: 128 }).primaryKey().$defaultFn(createId),
    sourceTenantId: varchar('source_tenant_id', { length: 128 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    summary: text('summary'),
    heroImageUrl: text('hero_image_url'),
    bodyMarkdown: text('body_markdown'),
    status: varchar('status', { length: 50 }).notNull().$type<NewsPostStatus>().default('draft'),
    publishedAt: timestamp('published_at', { fsp: 3 }),
    createdByUserId: varchar('created_by_user_id', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    updatedByUserId: varchar('updated_by_user_id', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
    ...timestampColumns()
  },
  (table) => ({
    sourceTenantIdx: index('tenant_news_posts_source_tenant_idx').on(table.sourceTenantId),
    statusIdx: index('tenant_news_posts_status_idx').on(table.status),
    publishedIdx: index('tenant_news_posts_published_idx').on(
      table.sourceTenantId,
      table.status,
      table.publishedAt
    ),
    slugUnique: uniqueIndex('tenant_news_posts_slug_unique').on(table.sourceTenantId, table.slug)
  })
)

// Relations for operations tables
export const tenantIncidentsRelations = relations(tenantIncidents, ({ one, many }) => ({
  sourceTenant: one(tenants, {
    fields: [tenantIncidents.sourceTenantId],
    references: [tenants.id]
  }),
  createdBy: one(users, {
    fields: [tenantIncidents.createdByUserId],
    references: [users.id],
    relationName: 'incidentCreatedBy'
  }),
  mutes: many(tenantIncidentMutes),
  userMutes: many(tenantIncidentUserMutes)
}))

export const tenantIncidentMutesRelations = relations(tenantIncidentMutes, ({ one }) => ({
  incident: one(tenantIncidents, {
    fields: [tenantIncidentMutes.incidentId],
    references: [tenantIncidents.id]
  }),
  targetTenant: one(tenants, {
    fields: [tenantIncidentMutes.targetTenantId],
    references: [tenants.id]
  }),
  organization: one(organizations, {
    fields: [tenantIncidentMutes.organizationId],
    references: [organizations.id]
  }),
  mutedBy: one(users, {
    fields: [tenantIncidentMutes.mutedByUserId],
    references: [users.id]
  })
}))

export const tenantIncidentUserMutesRelations = relations(tenantIncidentUserMutes, ({ one }) => ({
  incident: one(tenantIncidents, {
    fields: [tenantIncidentUserMutes.incidentId],
    references: [tenantIncidents.id]
  }),
  user: one(users, {
    fields: [tenantIncidentUserMutes.userId],
    references: [users.id]
  })
}))

export const tenantNewsPostsRelations = relations(tenantNewsPosts, ({ one }) => ({
  sourceTenant: one(tenants, {
    fields: [tenantNewsPosts.sourceTenantId],
    references: [tenants.id]
  }),
  createdBy: one(users, {
    fields: [tenantNewsPosts.createdByUserId],
    references: [users.id],
    relationName: 'newsCreatedBy'
  })
}))

export const mspOrgDelegationRelations = relations(mspOrgDelegations, ({ many, one }) => ({
  org: one(organizations, {
    fields: [mspOrgDelegations.orgId],
    references: [organizations.id]
  }),
  subject: one(users, {
    fields: [mspOrgDelegations.subjectId],
    references: [users.id]
  }),
  permissions: many(mspOrgDelegationPermissions)
}))

export const mspOrgDelegationPermissionRelations = relations(
  mspOrgDelegationPermissions,
  ({ one }) => ({
    delegation: one(mspOrgDelegations, {
      fields: [mspOrgDelegationPermissions.delegationId],
      references: [mspOrgDelegations.id]
    })
  })
)

export const memberModuleRoleOverrideRelations = relations(memberModuleRoleOverrides, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberModuleRoleOverrides.organizationId],
    references: [organizations.id]
  }),
  user: one(users, {
    fields: [memberModuleRoleOverrides.userId],
    references: [users.id]
  })
}))

/**
 * Cloudflare DNS plugin tables (prefixed with cloudflare_dns_)
 * Schema is defined in the cloudflare-dns layer and imported here.
 */
const cloudflareDnsSchemaInstance = createCloudflareDnsSchema(organizations.id)

export const cloudflareDnsOrgConfig = cloudflareDnsSchemaInstance.cloudflareDnsOrgConfig
export const cloudflareDnsZonesCache = cloudflareDnsSchemaInstance.cloudflareDnsZonesCache
export const cloudflareDnsZoneAcls = cloudflareDnsSchemaInstance.cloudflareDnsZoneAcls

/**
 * Windows DNS plugin tables (prefixed with windows_dns_)
 * Schema is defined in the windows-dns layer and imported here.
 */
const windowsDnsSchemaInstance = createWindowsDnsSchema(organizations.id)

export const windowsDnsZones = windowsDnsSchemaInstance.windowsDnsZones
export const windowsDnsZoneMemberships = windowsDnsSchemaInstance.windowsDnsZoneMemberships
export const windowsDnsOrgConfig = windowsDnsSchemaInstance.windowsDnsOrgConfig
export const windowsDnsAllowedZones = windowsDnsSchemaInstance.windowsDnsAllowedZones
export const windowsDnsLastDiscovery = windowsDnsSchemaInstance.windowsDnsLastDiscovery
export const windowsDnsBlockedZones = windowsDnsSchemaInstance.windowsDnsBlockedZones

/**
 * Windows DNS Redirects plugin tables (prefixed with windows_dns_redirect_)
 * Schema is defined in the windows-dns-redirects layer and imported here.
 */
const windowsDnsRedirectsSchemaInstance = createWindowsDnsRedirectsSchema(organizations.id)

export const windowsDnsRedirects = windowsDnsRedirectsSchemaInstance.windowsDnsRedirects
export const windowsDnsRedirectHits = windowsDnsRedirectsSchemaInstance.windowsDnsRedirectHits
export const windowsDnsRedirectOrgConfig = windowsDnsRedirectsSchemaInstance.windowsDnsRedirectOrgConfig
export const windowsDnsRedirectImportLogs = windowsDnsRedirectsSchemaInstance.windowsDnsRedirectImportLogs
export const windowsDnsManagedRecords = windowsDnsRedirectsSchemaInstance.windowsDnsManagedRecords
