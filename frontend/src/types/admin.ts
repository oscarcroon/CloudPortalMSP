import type { RbacRole } from '~/constants/rbac'

export interface AdminOrganizationSummary {
  id: string
  name: string
  slug: string
  status: string
  enforceSso: boolean
  selfSignupEnabled: boolean
  defaultRole: RbacRole
  createdAt: number
  memberCount: number
}

export interface AdminCreateOrganizationPayload {
  name: string
  slug?: string
  billingEmail?: string
  enforceSso?: boolean
  selfSignupEnabled?: boolean
  defaultRole?: RbacRole
  owner: {
    email: string
    fullName?: string
    password?: string
  }
}

export interface AdminCreateOrganizationResponse {
  organization: {
    id: string
    name: string
    slug: string
    status: string
    enforceSso: boolean
    selfSignupEnabled: boolean
    defaultRole: RbacRole
    createdAt?: number
    updatedAt?: number
    billingEmail?: string | null
  }
  owner: {
    id: string
    email: string
    fullName?: string | null
  }
  generatedPassword: string | null
}

