import { createId } from '@paralleldrive/cuid2'
import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import type { RbacRole, TenantRole } from '~/constants/rbac'
import type { OrganizationMemberStatus } from '~/types/admin'

export type BrandingTargetType = 'organization' | 'provider' | 'distributor' | 'global'

const timestampColumns = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`)
})

const softDeleteColumn = () =>
  integer('deleted_at', { mode: 'timestamp_ms' }).default(null)

export const tenants = sqliteTable(
  'tenants',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    customDomain: text('custom_domain'),
    customDomainVerificationStatus: text('custom_domain_verification_status')
      .notNull()
      .default('unverified'),
    customDomainVerifiedAt: integer('custom_domain_verified_at', { mode: 'timestamp_ms' }),
    type: text('type').notNull().$type<'provider' | 'distributor' | 'organization'>(),
    parentTenantId: text('parent_tenant_id'),
    status: text('status').notNull().default('active'),
    ...timestampColumns()
  },
  table => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
    customDomainIdx: uniqueIndex('tenants_custom_domain_idx').on(table.customDomain)
  })
)

export const organizations = sqliteTable(
  'organizations',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    tenantId: text('tenant_id'),
    status: text('status').notNull().default('active'),
    isSuspended: integer('is_suspended', { mode: 'boolean' }).notNull().default(0),
    defaultRole: text('default_role').notNull().default('viewer'),
    requireSso: integer('require_sso', { mode: 'boolean' }).notNull().default(0),
    allowSelfSignup: integer('allow_self_signup', { mode: 'boolean' }).notNull().default(0),
    logoUrl: text('logo_url'),
    billingEmail: text('billing_email'),
    coreId: text('core_id'),
    ...timestampColumns()
  },
  table => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug)
  })
)

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    fullName: text('full_name'),
    status: text('status').notNull().default('active'),
    isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(0),
    isMfaEnabled: integer('is_mfa_enabled', { mode: 'boolean' }).notNull().default(0),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    defaultOrgId: text('default_org_id'),
    enforcedOrgId: text('enforced_org_id'),
    forcePasswordReset: integer('force_password_reset', { mode: 'boolean' }).notNull().default(0),
    passwordResetTokenHash: text('password_reset_token_hash'),
    passwordResetExpiresAt: integer('password_reset_expires_at', { mode: 'timestamp_ms' }),
    metadata: text('metadata', { length: 2048 }),
    ...timestampColumns(),
    deletedAt: softDeleteColumn()
  },
  table => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email)
  })
)

export const organizationMemberships = sqliteTable(
  'organization_memberships',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role')
      .notNull()
      .$type<RbacRole>()
      .default('viewer'),
    status: text('status')
      .notNull()
      .$type<OrganizationMemberStatus>()
      .default('active'),
    labels: text('labels', { length: 1024 }),
    lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp_ms' }),
    ...timestampColumns()
  },
  table => ({
    uniqueMembership: uniqueIndex('organization_membership_unique').on(
      table.organizationId,
      table.userId
    )
  })
)

export const brandingThemes = sqliteTable(
  'branding_themes',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    targetType: text('target_type')
      .notNull()
      .$type<BrandingTargetType>(),
    tenantId: text('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade'
    }),
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'cascade'
    }),
    logoUrl: text('logo_url'),
    appLogoLightUrl: text('app_logo_light_url'),
    appLogoDarkUrl: text('app_logo_dark_url'),
    loginLogoLightUrl: text('login_logo_light_url'),
    loginLogoDarkUrl: text('login_logo_dark_url'),
    loginBackgroundUrl: text('login_background_url'),
    loginBackgroundTint: text('login_background_tint', { length: 16 }),
    navigationBackgroundColor: text('navigation_background_color', { length: 16 }),
    loginBackgroundTintOpacity: real('login_background_tint_opacity'),
    accentColor: text('accent_color', { length: 16 }),
    paletteKey: text('palette_key', { length: 64 }),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    updatedByUserId: text('updated_by_user_id').references(() => users.id, {
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

export const tenantMemberships = sqliteTable(
  'tenant_memberships',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references((): any => tenants.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role')
      .notNull()
      .$type<TenantRole>()
      .default('viewer'),
    includeChildren: integer('include_children', { mode: 'boolean' })
      .notNull()
      .default(false),
    status: text('status')
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

export const tenantMemberRoles = sqliteTable(
  'tenant_member_roles',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    membershipId: text('membership_id')
      .notNull()
      .references(() => tenantMemberships.id, { onDelete: 'cascade' }),
    roleKey: text('role_key')
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

export const tenantInvitations = sqliteTable(
  'tenant_invitations',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references((): any => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role')
      .notNull()
      .$type<'admin' | 'user' | 'viewer' | 'support'>()
      .default('viewer'),
    includeChildren: integer('include_children', { mode: 'boolean' })
      .notNull()
      .default(false),
    token: text('token').notNull(),
    status: text('status').notNull().default('pending'),
    invitedByUserId: text('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
    declinedAt: integer('declined_at', { mode: 'timestamp_ms' }),
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

export const userModuleFavorites = sqliteTable(
  'user_module_favorites',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    displayOrder: integer('display_order').notNull().default(0),
    ...timestampColumns()
  },
  table => ({
    uniqueFavorite: uniqueIndex('user_module_favorites_unique').on(table.userId, table.moduleId),
    orderIdx: index('user_module_favorites_order_idx').on(table.userId, table.displayOrder)
  })
)

export const distributorProviders = sqliteTable(
  'distributor_providers',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    distributorId: text('distributor_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    providerId: text('provider_id')
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

export const organizationInvitations = sqliteTable(
  'organization_invitations',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role')
      .notNull()
      .$type<RbacRole>()
      .default('viewer'),
    token: text('token').notNull(),
    status: text('status').notNull().default('pending'),
    invitedByUserId: text('invited_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
    declinedAt: integer('declined_at', { mode: 'timestamp_ms' }),
    ...timestampColumns()
  },
  table => ({
    tokenIdx: uniqueIndex('organization_invites_token_idx').on(table.token)
  })
)

export const organizationAuthSettings = sqliteTable('organization_auth_settings', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  idpType: text('idp_type').notNull().default('none'),
  ssoEnforced: integer('sso_enforced', { mode: 'boolean' }).notNull().default(0),
  allowLocalLoginForOwners: integer('allow_local_login_for_owners', { mode: 'boolean' })
    .notNull()
    .default(1),
  requireMfaOnSensitiveActions: integer('require_mfa_on_sensitive_actions', { mode: 'boolean' })
    .notNull()
    .default(0),
  requireMfaOnContextSwitch: integer('require_mfa_on_context_switch', { mode: 'boolean' })
    .notNull()
    .default(0),
  idpConfig: text('idp_config', { length: 4096 }),
  ...timestampColumns()
})

export const tenantAuthSettings = sqliteTable('tenant_auth_settings', {
  tenantId: text('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  requireMfaOnSensitiveActions: integer('require_mfa_on_sensitive_actions', { mode: 'boolean' })
    .notNull()
    .default(0),
  requireMfaOnContextSwitch: integer('require_mfa_on_context_switch', { mode: 'boolean' })
    .notNull()
    .default(0),
  ...timestampColumns()
})

export const mfaSessions = sqliteTable('mfa_sessions', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(), // e.g., 'global', 'org:<id>', 'tenant:<id>'
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  ...timestampColumns()
}, table => ({
  userScopeIdx: uniqueIndex('mfa_sessions_user_scope_idx').on(table.userId, table.scope)
}))

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(createId),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  severity: text('severity').notNull().default('info').$type<'info' | 'warning' | 'error' | 'critical'>(),
  requestId: text('request_id'),
  endpoint: text('endpoint'),
  method: text('method'),
  orgId: text('org_id'),
  tenantId: text('tenant_id'),
  fromContext: text('from_context', { length: 1024 }),
  toContext: text('to_context', { length: 1024 }),
  ip: text('ip'),
  userAgent: text('user_agent', { length: 512 }),
  meta: text('meta', { length: 4096 }),
  ...timestampColumns()
}, table => ({
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  timestampIdx: index('audit_logs_timestamp_idx').on(table.createdAt),
  eventTypeIdx: index('audit_logs_event_type_idx').on(table.eventType),
  requestIdIdx: index('audit_logs_request_id_idx').on(table.requestId),
  orgIdIdx: index('audit_logs_org_id_idx').on(table.orgId),
  tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId)
}))

export const organizationIdentityProviders = sqliteTable(
  'organization_identity_providers',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('oidc'),
    providerName: text('provider_name').notNull(),
    issuer: text('issuer'),
    clientId: text('client_id'),
    clientSecret: text('client_secret'),
    redirectUri: text('redirect_uri'),
    metadataUrl: text('metadata_url'),
    audience: text('audience'),
    scopes: text('scopes'),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(0),
    enforceForUserType: text('enforce_for_user_type'),
    ...timestampColumns()
  },
  table => ({
    orgProviderIdx: uniqueIndex('organization_idp_unique').on(
      table.organizationId,
      table.providerName
    )
  })
)

export const emailProviderProfiles = sqliteTable(
  'email_provider_profiles',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    targetType: text('target_type').notNull().$type<'global' | 'provider' | 'distributor' | 'organization'>(),
    targetKey: text('target_key').notNull(),
    tenantId: text('tenant_id').references(() => tenants.id, {
      onDelete: 'cascade'
    }),
    organizationId: text('organization_id').references(() => organizations.id, {
      onDelete: 'cascade'
    }),
    providerType: text('provider_type').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(0),
    fromName: text('from_name'),
    fromEmail: text('from_email'),
    replyToEmail: text('reply_to_email'),
    brandingConfig: text('branding_config', { length: 4096 }),
    encryptedConfig: text('encrypted_config', { length: 8192 }),
    encryptionIv: text('encryption_iv'),
    encryptionAuthTag: text('encryption_auth_tag'),
    configVersion: integer('config_version').notNull().default(1),
    lastTestedAt: integer('last_tested_at', { mode: 'timestamp_ms' }),
    lastTestStatus: text('last_test_status'),
    lastTestError: text('last_test_error'),
    ...timestampColumns()
  },
  table => ({
    targetKeyIdx: uniqueIndex('email_provider_target_key_idx').on(table.targetKey),
    orgUnique: uniqueIndex('email_provider_org_unique').on(table.organizationId),
    tenantUnique: uniqueIndex('email_provider_tenant_unique').on(table.tenantId)
  })
)

export const dnsZones = sqliteTable(
  'dns_zones',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    provider: text('provider').default('cloudflare'),
    accountId: text('account_id'),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('dns_zones_org_name_idx').on(table.organizationId, table.name)
  })
)

export const dnsRecords = sqliteTable(
  'dns_records',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    zoneId: text('zone_id')
      .notNull()
      .references(() => dnsZones.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    ttl: integer('ttl').notNull().default(3600),
    proxied: integer('proxied', { mode: 'boolean' }).notNull().default(0),
    priority: integer('priority'),
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

export const containerProjects = sqliteTable(
  'container_projects',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    environment: text('environment').default('production'),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('container_projects_org_name_idx').on(
      table.organizationId,
      table.name
    )
  })
)

export const containerInstances = sqliteTable(
  'container_instances',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    projectId: text('project_id')
      .notNull()
      .references(() => containerProjects.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('RUNNING'),
    image: text('image').notNull(),
    cpu: text('cpu').notNull(),
    memory: text('memory').notNull(),
    region: text('region').default('eu-north-1'),
    metadata: text('metadata', { length: 2048 }),
    ...timestampColumns()
  },
  table => ({
    projectNameIdx: uniqueIndex('container_instances_project_name_idx').on(
      table.projectId,
      table.name
    )
  })
)

export const ncentralDevices = sqliteTable(
  'ncentral_devices',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('online'),
    type: text('type').notNull().default('server'),
    osVersion: text('os_version'),
    region: text('region'),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
    metadata: text('metadata', { length: 2048 }),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('ncentral_devices_org_name_idx').on(
      table.organizationId,
      table.name
    )
  })
)

export const vmInstances = sqliteTable(
  'vm_instances',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    platform: text('platform').notNull(),
    powerState: text('power_state').notNull(),
    cpu: text('cpu').notNull(),
    memory: text('memory').notNull(),
    disk: text('disk').notNull(),
    region: text('region'),
    lastBackupAt: integer('last_backup_at', { mode: 'timestamp_ms' }),
    ...timestampColumns()
  },
  table => ({
    orgNameIdx: uniqueIndex('vm_instances_org_name_idx').on(table.organizationId, table.name)
  })
)

export const monitoringAlerts = sqliteTable('monitoring_alerts', {
  id: text('id').primaryKey().$defaultFn(createId),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description', { length: 1024 }),
  severity: text('severity').notNull().default('info'),
  status: text('status').notNull().default('open'),
  source: text('source'),
  triggeredAt: integer('triggered_at', { mode: 'timestamp_ms' }),
  resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
  metadata: text('metadata', { length: 2048 }),
  ...timestampColumns()
})

export const wordpressSites = sqliteTable(
  'wordpress_sites',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    domain: text('domain').notNull(),
    status: text('status').notNull().default('healthy'),
    version: text('version'),
    region: text('region'),
    lastBackupAt: integer('last_backup_at', { mode: 'timestamp_ms' }),
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
export const tenantModulePolicies = sqliteTable(
  'tenant_module_policies',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(1),
    // If disabled is true, module is visible but grayed out (deactivated)
    // If enabled is false, module is hidden completely (inactivated)
    disabled: integer('disabled', { mode: 'boolean' }).notNull().default(0),
    // JSON object storing permission overrides
    // Example: { "cloudflare:write": false } to disable write access
    permissionOverrides: text('permission_overrides', { length: 2048 }),
    // JSON array storing allowed module roles for this tenant
    // null => inherit defaults, [] => block, ["dns-admin"] => override
    allowedRoles: text('allowed_roles', { length: 2048 }),
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
export const organizationModulePolicies = sqliteTable(
  'organization_module_policies',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(1),
    // If disabled is true, module is visible but grayed out (deactivated)
    // If enabled is false, module is hidden completely (inactivated)
    disabled: integer('disabled', { mode: 'boolean' }).notNull().default(0),
    // JSON object storing permission overrides
    // Example: { "cloudflare:write": false } to disable write access
    permissionOverrides: text('permission_overrides', { length: 2048 }),
    // JSON array storing allowed module roles for this organization
    allowedRoles: text('allowed_roles', { length: 2048 }),
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

/**
 * Cloudflare API credentials per organization
 * Stores encrypted API tokens for Cloudflare integration
 */
export const cloudflareCredentials = sqliteTable(
  'cloudflare_credentials',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Encrypted API token
    encryptedApiToken: text('encrypted_api_token', { length: 2048 }).notNull(),
    encryptionIv: text('encryption_iv').notNull(),
    encryptionAuthTag: text('encryption_auth_tag').notNull(),
    // Optional: Cloudflare account ID if needed
    accountId: text('account_id'),
    // Status of the credentials
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(1),
    lastValidatedAt: integer('last_validated_at', { mode: 'timestamp_ms' }),
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
export const moduleRoles = sqliteTable(
  'module_roles',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    moduleId: text('module_id').notNull(),
    roleKey: text('role_key').notNull(),
    roleName: text('role_name').notNull(),
    description: text('description', { length: 512 }),
    // JSON encoded capabilities for UI/logic hints
    capabilities: text('capabilities', { length: 2048 }),
    ...timestampColumns()
  },
  table => ({
    moduleRoleUnique: uniqueIndex('module_roles_module_role_idx').on(table.moduleId, table.roleKey),
    moduleRoleModuleIdx: index('module_roles_module_idx').on(table.moduleId)
  })
)

export const roleModuleRoleMappings = sqliteTable(
  'role_module_role_mappings',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    moduleId: text('module_id').notNull(),
    moduleRoleKey: text('module_role_key').notNull(),
    rbacRole: text('rbac_role').notNull(),
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
 * User-specific module role overrides per organization
 */
export const memberModuleRoleOverrides = sqliteTable(
  'member_module_role_overrides',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    roleKey: text('role_key').notNull(),
    effect: text('effect')
      .notNull()
      .$type<'grant' | 'deny'>(),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    updatedByUserId: text('updated_by_user_id').references(() => users.id, {
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
export const userModulePermissions = sqliteTable(
  'user_module_permissions',
  {
    id: text('id').primaryKey().$defaultFn(createId),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull(),
    // JSON object storing denied permissions
    // Example: { "cloudflare:write": true } means write is denied for this user
    // If permission is not in this object, it follows the user's role permissions
    deniedPermissions: text('denied_permissions', { length: 2048 }),
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

