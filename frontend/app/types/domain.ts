export interface OrganisationBranding {
  logoUrl?: string
}

export interface Organisation {
  id: string
  name: string
  role: 'admin' | 'editor' | 'viewer'
  branding?: OrganisationBranding
}

export interface User {
  id: string
  email: string
  name: string
}

