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

export type OrganisationMembershipStatus = 'active' | 'invited' | 'suspended'


