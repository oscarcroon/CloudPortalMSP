import { computed } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useI18n, useRoute, useRouter } from '#imports'
import type { BreadcrumbItem } from '~/components/Breadcrumb.vue'
import { resolveFromMappings, resolveModule, humanizeSegment, shortId } from '~/lib/breadcrumbs'
import { useEntityNames } from '~/composables/useEntityNames'
import { useAuth } from '~/composables/useAuth'

type MetaBreadcrumb =
  | false
  | BreadcrumbItem
  | ((route: RouteLocationNormalizedLoaded) => string)
  | {
      label?: string | ((route: RouteLocationNormalizedLoaded) => string)
      icon?: string
      to?: string
      hideLink?: boolean
    }

const isBreadcrumbObject = (value: unknown): value is Exclude<MetaBreadcrumb, false> =>
  !!value && typeof value === 'object'

const resolveMetaBreadcrumb = (
  route: RouteLocationNormalizedLoaded
): BreadcrumbItem | false | null => {
  const metaValue = route.meta?.breadcrumb as MetaBreadcrumb | undefined
  if (metaValue === false) return false
  if (!metaValue) return null

  if (typeof metaValue === 'function') {
    return { label: metaValue(route) }
  }
  if (typeof metaValue === 'string') {
    return { label: metaValue }
  }
  if (isBreadcrumbObject(metaValue)) {
    const label =
      typeof metaValue.label === 'function' ? metaValue.label(route) : metaValue.label
    return {
      label: label ?? '',
      icon: metaValue.icon,
      to: (metaValue as any).hideLink ? undefined : metaValue.to
    }
  }
  return null
}

export const useBreadcrumbs = () => {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const entityNames = useEntityNames()
  const auth = useAuth()

  // Check if a route exists (has matched components)
  const routeExists = (path: string): boolean => {
    try {
      const resolved = router.resolve(path)
      return resolved.matched.length > 0
    } catch {
      return false
    }
  }

  const items = computed<BreadcrumbItem[]>(() => {
    // Hide breadcrumbs on home page
    if (route.path === '/') return []

    // Opt-out via meta
    if (route.meta?.breadcrumb === false) return []

    const crumbs: BreadcrumbItem[] = []

    // Home crumb
    crumbs.push({
      label: t('nav.home', 'Hem'),
      icon: 'mdi:home-outline',
      to: '/'
    })

    // Split path into segments and build crumbs for each
    const pathSegments = route.path.split('/').filter(Boolean)
    let accumulatedPath = ''

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i]!
      accumulatedPath += `/${segment}`

      let crumb: BreadcrumbItem | null = null

      // 1) Check route mappings (exact match)
      const mapped = resolveFromMappings(accumulatedPath)
      if (mapped) {
        const translatedLabel = mapped.labelKey ? t(mapped.labelKey, mapped.label) : mapped.label
        let icon = mapped.icon
        
        // Dynamic icon for tenant-admin based on current tenant type
        if (accumulatedPath === '/tenant-admin') {
          icon = getTenantTypeIcon(auth.currentTenant.value?.type)
        }
        
        crumb = { label: translatedLabel, icon }
      }

      // 2) Check module mapping
      if (!crumb) {
        const mod = resolveModule(accumulatedPath)
        if (mod) {
          crumb = { label: mod.label, icon: mod.icon }
        }
      }

      // 3) Fallback: check if it's a dynamic ID/slug and try to resolve name
      if (!crumb) {
        const prevSegment = pathSegments[i - 1]
        const prevPrevSegment = pathSegments[i - 2]
        const isId = /^[0-9a-f-]{20,}$/i.test(segment) || /^[a-z0-9]{20,}$/i.test(segment)
        const isEntitySegment = prevSegment === 'tenants' || prevSegment === 'organizations' || prevSegment === 'dns' || prevSegment === 'cloudflare-dns'
        // Check if we're in a nested route like /dns/redirects/[zoneId] where zoneId should be resolved
        const isZoneIdInRedirects = isId && prevSegment === 'redirects' && prevPrevSegment === 'dns'
        
        if (isId || isEntitySegment || isZoneIdInRedirects) {
          // For zone IDs under redirects, use 'dns' as context for entity resolution
          const entityContext = isZoneIdInRedirects ? 'dns' : prevSegment
          // Try to get name from cache or auth stores
          const resolvedName = resolveEntityName(segment, entityContext, entityNames, auth)
          const contextIcon = getContextIcon(isZoneIdInRedirects ? 'dns' : prevSegment)
          
          if (resolvedName) {
            crumb = { 
              label: resolvedName,
              icon: contextIcon || undefined
            }
          } else {
            // Fallback to shortened ID with context, or humanized segment
            const contextLabel = getContextLabel(isZoneIdInRedirects ? 'dns' : prevSegment)
            if (isId && contextLabel) {
              crumb = { 
                label: `${contextLabel} ${shortId(segment)}`,
                icon: contextIcon || undefined
              }
            } else {
              crumb = { 
                label: humanizeSegment(segment),
                icon: contextIcon || undefined
              }
            }
          }
        } else {
          // For non-entity segments, check if we should inherit icon from parent
          const parentSegment = pathSegments[i - 1]
          const parentIcon = getContextIcon(parentSegment)
          crumb = { 
            label: humanizeSegment(segment),
            ...(parentIcon ? { icon: parentIcon } : {})
          }
        }
      }

      if (!crumb || !crumb.label) continue

      // Avoid duplicate crumbs
      if (crumbs.some((c) => c.to === accumulatedPath)) continue

      // Only add link if route exists (prevents 404 breadcrumbs)
      const linkTo = routeExists(accumulatedPath) ? accumulatedPath : undefined

      crumbs.push({
        ...crumb,
        to: linkTo
      })
    }

    // Check if last crumb should be overridden by page meta
    const metaCrumb = resolveMetaBreadcrumb(route)
    if (metaCrumb && metaCrumb.label && crumbs.length > 1) {
      const last = crumbs[crumbs.length - 1]!
      last.label = metaCrumb.label
      // Only override icon if meta explicitly provides one, otherwise keep the context icon
      if (metaCrumb.icon) {
        last.icon = metaCrumb.icon
      }
    }

    // Ensure icons are correct for entity detail pages (after meta override)
    if (crumbs.length > 1) {
      const last = crumbs[crumbs.length - 1]!
      const prevSegment = pathSegments[pathSegments.length - 2]

      // For tenants and organizations, ensure icon matches list page
      if (prevSegment === 'tenants') {
        last.icon = 'mdi:office-building-outline'
      } else if (prevSegment === 'organizations') {
        last.icon = 'mdi:domain'
      }
    }

    // Ensure last crumb is not a link
    if (crumbs.length > 1) {
      const last = crumbs[crumbs.length - 1]!
      delete last.to
    }

    return crumbs
  })

  return { items }
}

// Resolve entity name from caches
function resolveEntityName(
  id: string, 
  prevSegment: string | undefined,
  entityNames: ReturnType<typeof useEntityNames>,
  auth: ReturnType<typeof useAuth>
): string | null {
  if (!prevSegment) return null

  // Check entity name cache first (works for both id and slug)
  const entityType = getEntityType(prevSegment)
  if (entityType) {
    const cached = entityNames.getName(entityType, id)
    if (cached) return cached
  }

  // For tenants, check auth store
  if (prevSegment === 'tenants') {
    const tenant = auth.tenants.value.find((t: any) => t.id === id || t.slug === id)
    if (tenant?.name) return tenant.name
  }

  // For organizations, check auth store (supports both id and slug)
  if (prevSegment === 'organizations') {
    const org = auth.organizations.value.find((o: any) => o.id === id || o.slug === id)
    if (org?.name) return org.name
  }

  // For zones, also check by zoneId in the URL directly
  if (prevSegment === 'dns' || prevSegment === 'cloudflare-dns') {
    const cached = entityNames.getName('zone', id)
    if (cached) return cached
  }

  return null
}

// Map URL segment to entity type
function getEntityType(segment: string): 'tenant' | 'organization' | 'zone' | 'user' | 'group' | null {
  const mapping: Record<string, 'tenant' | 'organization' | 'zone' | 'user' | 'group'> = {
    tenants: 'tenant',
    organizations: 'organization',
    dns: 'zone',
    'cloudflare-dns': 'zone',
    users: 'user',
    groups: 'group'
  }
  return mapping[segment] ?? null
}

// Helper to get context label based on previous segment
function getContextLabel(segment: string | undefined): string {
  if (!segment) return ''
  const labels: Record<string, string> = {
    tenants: 'Tenant',
    organizations: 'Org',
    users: 'Användare',
    dns: 'Zon',
    'cloudflare-dns': 'Zon',
    distributors: 'Distributör',
    providers: 'Leverantör',
    members: 'Medlem',
    groups: 'Grupp'
  }
  return labels[segment] ?? ''
}

// Helper to get context icon based on previous segment
// Uses same icons as the list pages for consistency
function getContextIcon(segment: string | undefined): string | undefined {
  if (!segment) return undefined
  const icons: Record<string, string> = {
    tenants: 'mdi:office-building-outline', // Same as /tenant-admin/tenants
    organizations: 'mdi:domain', // Same as /tenant-admin/organizations
    users: 'mdi:account-outline',
    dns: 'mdi:globe',
    'cloudflare-dns': 'mdi:cloud-outline',
    distributors: 'mdi:city', // Match context switcher
    providers: 'mdi:store', // Match context switcher
    members: 'mdi:account-outline',
    groups: 'mdi:account-group-outline'
  }
  return icons[segment]
}

// Helper to get tenant type icon (matches ContextSwitcher)
function getTenantTypeIcon(type: string | undefined): string {
  switch (type) {
    case 'distributor':
      return 'mdi:city'
    case 'provider':
      return 'mdi:store'
    default:
      return 'mdi:office-building-outline'
  }
}
