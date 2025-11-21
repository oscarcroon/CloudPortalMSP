import type { Request, Response } from 'express'

export const ensureAuthenticated = (req: Request, res: Response) => {
  if (!req.userContext) {
    res.status(401).json({ message: 'Authentication required' })
    return false
  }
  return true
}

export const ensurePermission = (req: Request, res: Response, permission: string) => {
  if (!ensureAuthenticated(req, res)) {
    return false
  }
  if (!req.userContext?.permissions.includes(permission)) {
    res.status(403).json({ message: `Missing permission: ${permission}` })
    return false
  }
  return true
}

export const currentOrgId = (req: Request) => req.userContext?.activeOrganisationId ?? null

