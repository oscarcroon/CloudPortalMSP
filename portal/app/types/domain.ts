export interface OrganizationBranding {
  logoUrl?: string
}

export interface Organization {
  id: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  branding?: OrganizationBranding
}

export interface User {
  id: string
  email: string
  name: string
}

