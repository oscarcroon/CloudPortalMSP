import { createId } from '@paralleldrive/cuid2'
import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestampColumns = () => ({
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(strftime('%s','now') * 1000)`)
})

export const organisationsTable = sqliteTable(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status').notNull().default('active'),
    logoUrl: text('logo_url'),
    requireSso: integer('require_sso', { mode: 'boolean' }).notNull().default(false),
    allowSelfSignup: integer('allow_self_signup', { mode: 'boolean' }).notNull().default(false),
    defaultRole: text('default_role').notNull().default('viewer'),
    ...timestampColumns()
  },
  (table) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(table.slug)
  })
)

export const usersTable = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    status: text('status').notNull().default('active'),
    isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).notNull().default(false),
    ...timestampColumns()
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email)
  })
)

export const organisationMembershipsTable = sqliteTable(
  'organization_memberships',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(createId),
    organizationId: text('organization_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('viewer'),
    status: text('status').notNull().default('active'),
    ...timestampColumns()
  },
  (table) => ({
    uniqueMembership: uniqueIndex('organization_membership_unique').on(
      table.organizationId,
      table.userId
    )
  })
)

export const organisationInvitationsTable = sqliteTable(
  'organization_invitations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(createId),
    organizationId: text('organization_id').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    token: text('token').notNull(),
    status: text('status').notNull().default('pending'),
    invitedByUserId: text('invited_by_user_id'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    ...timestampColumns()
  },
  (table) => ({
    tokenIdx: uniqueIndex('organization_invites_token_idx').on(table.token)
  })
)

export const emailProviderProfilesTable = sqliteTable(
  'email_provider_profiles',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(createId),
    targetType: text('target_type').notNull(),
    targetKey: text('target_key').notNull(),
    organizationId: text('organization_id').references(() => organisationsTable.id, {
      onDelete: 'cascade'
    }),
    providerType: text('provider_type').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
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
  (table) => ({
    targetKeyIdx: uniqueIndex('email_provider_target_key_idx').on(table.targetKey),
    orgUnique: uniqueIndex('email_provider_org_unique').on(table.organizationId)
  })
)

export type OrganisationMembershipStatus = 'active' | 'invited' | 'suspended'


