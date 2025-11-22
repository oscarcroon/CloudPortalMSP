import { eq } from 'drizzle-orm'
import type { Request, Response } from 'express'
import { db } from '../db/client.js'
import { organisationsTable } from '../db/schema.js'
import type { OrganisationMemberRole } from '../types/domain.js'
import { currentOrgId } from './authz.js'

export async function assertOrganisationScope(req: Request, res: Response, id: string) {
  const activeOrgId = currentOrgId(req)
  if (activeOrgId !== id) {
    res.status(403).json({ message: 'Operation limited to the active organisation.' })
    return null
  }

  const organisationRow = await db
    .select({
      id: organisationsTable.id,
      name: organisationsTable.name,
      defaultRole: organisationsTable.defaultRole,
      requireSso: organisationsTable.requireSso
    })
    .from(organisationsTable)
    .where(eq(organisationsTable.id, id))
    .get()

  if (!organisationRow) {
    res.status(404).json({ message: 'Organisation not found.' })
    return null
  }

  const orgFromContext = req.userContext?.organisations.find((org) => org.id === id)

  return {
    id: organisationRow.id,
    name: orgFromContext?.name ?? organisationRow.name,
    role: (orgFromContext?.role ?? organisationRow.defaultRole) as OrganisationMemberRole,
    branding: orgFromContext?.branding,
    requireSso: Boolean(organisationRow.requireSso)
  }
}

