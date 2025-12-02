import type { NextFunction, Request, Response } from 'express'
import type { UserContext } from '../types/domain.js'
import {
  rolePermissionMap,
  tenantRoleOrgProxyPermissions
} from '../constants/rbac.js'
import type { OrgPermission, TenantRole } from '../constants/rbac.js'

declare module 'express-serve-static-core' {
  interface Request {
    userContext?: UserContext
  }
}

const SESSION_COOKIE = 'auth_token'

const parseSessionCookie = (cookieHeader?: string | null) => {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';').map((part) => part.trim())
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=')
    if (name === SESSION_COOKIE) {
      return rest.join('=')
    }
  }
  return null
}

const fetchAuthState = async (token: string) => {
  const url = process.env.AUTH_INTROSPECT_URL
  if (!url) {
    throw new Error('AUTH_INTROSPECT_URL is not configured')
  }
  const serviceToken = process.env.AUTH_SERVICE_TOKEN
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(serviceToken ? { 'x-service-token': serviceToken } : {})
    },
    body: JSON.stringify({ token })
  })
  if (!response.ok) {
    throw new Error(`Auth introspection failed with status ${response.status}`)
  }
  return (await response.json()) as {
    user: { id: string; email: string }
    organizations: Array<{
      id: string
      name: string
      role: keyof typeof rolePermissionMap
      tenantId?: string | null
    }>
    tenants?: Array<{ id: string; name: string; type: string; role: string; includeChildren?: boolean }>
    currentOrgId: string
    currentTenantId?: string | null
    orgRoles: Record<string, keyof typeof rolePermissionMap>
    tenantRoles?: Record<string, string>
    tenantIncludeChildren?: Record<string, boolean>
  }
}

export async function tenantContext(req: Request, res: Response, next: NextFunction) {
  try {
    const token = parseSessionCookie(req.headers.cookie)
    if (!token) {
      res.status(401).json({ message: 'Missing session' })
      return
    }
    const authState = await fetchAuthState(token)
    const currentOrgId = authState.currentOrgId
    const role = authState.orgRoles[currentOrgId]
    const permissions: OrgPermission[] = role ? [...rolePermissionMap[role]] : []
    const currentOrg = authState.organizations.find((org) => org.id === currentOrgId)
    if (currentOrg?.tenantId) {
      const tenantMembership =
        authState.tenants?.find((tenant) => tenant.id === currentOrg.tenantId) ?? null
      const includeChildren =
        authState.tenantIncludeChildren?.[currentOrg.tenantId] ??
        tenantMembership?.includeChildren ??
        false
      const tenantRole =
        authState.tenantRoles?.[currentOrg.tenantId] ?? tenantMembership?.role ?? null
      const tenantType = tenantMembership?.type
      const canProxy =
        includeChildren && tenantType && ['provider', 'distributor'].includes(tenantType)
      if (canProxy && tenantRole) {
        const proxyPermissions =
          tenantRoleOrgProxyPermissions[tenantRole as TenantRole]
        if (proxyPermissions) {
          for (const perm of proxyPermissions) {
            if (!permissions.includes(perm)) {
              permissions.push(perm)
            }
          }
        }
      }
    }
    req.userContext = {
      id: authState.user.id,
      email: authState.user.email,
      activeOrganisationId: currentOrgId,
      organisations: authState.organizations.map((org) => ({
        id: org.id,
        name: org.name,
        role: org.role
      })),
      permissions
    }
    next()
  } catch (error) {
    console.error('Failed to resolve auth context', error)
    res.status(401).json({ message: 'Authentication required' })
  }
}

