<template>
  <div ref="container" class="relative">
    <button
      class="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand"
      @click="toggle"
    >
      <span class="truncate max-w-[120px] sm:max-w-[180px]">{{ currentContextName }}</span>
      <Icon icon="mdi:chevron-down" class="h-4 w-4 text-white transition-transform" :class="{ 'rotate-180': open }" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-40 mt-2 w-80 max-h-[600px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 p-2 shadow-xl backdrop-blur"
    >
      <!-- Error message -->
      <div
        v-if="auth.state.value.error"
        class="mb-2 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400"
      >
        {{ auth.state.value.error }}
      </div>
      
      <div class="mb-3 px-2">
        <input
          v-model="searchInput"
          type="text"
          class="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          placeholder="Sök efter organisation..."
        />
      </div>

      <!-- Tenants Section -->
      <div v-if="filteredTenants.length > 0" class="mb-4">
        <div
          v-for="tenant in filteredTenants"
          :key="tenant.id"
          class="mt-1 rounded-md"
        >
          <button
            class="flex w-full items-start justify-between rounded-md px-2 py-2 text-left text-sm text-white transition"
            :class="{
              'bg-white/10': auth.state.value.data?.currentTenantId === tenant.id,
              'hover:bg-white/10': auth.state.value.data?.currentTenantId !== tenant.id
            }"
            @click="selectTenant(tenant.id)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <Icon
                  :icon="getTenantTypeIcon(tenant.type)"
                  class="h-4 w-4 shrink-0"
                  :class="getTenantTypeColor(tenant.type)"
                />
                <p class="truncate font-semibold">{{ tenant.name }}</p>
              </div>
              <p class="text-xs text-slate-400">
                {{ getTenantTypeLabel(tenant.type) }} • {{ tenant.role }}
              </p>
            </div>
            <Icon
              v-if="auth.state.value.data?.currentTenantId === tenant.id"
              icon="mdi:check"
              class="h-4 w-4 shrink-0 text-brand"
            />
          </button>

          <div
            v-if="tenantOrganizations[tenant.id]?.length"
            class="ml-4 mt-1 max-h-48 overflow-y-auto border-l-2 border-slate-700 pl-2 pr-1"
          >
            <button
              v-for="org in tenantOrganizations[tenant.id]"
              :key="org.id"
              class="mt-1 flex w-full items-start justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-300 transition hover:bg-white/5"
              :class="{
                'bg-white/10': auth.state.value.data?.currentOrgId === org.id
              }"
              @click.stop="selectContext({ tenantId: tenant.id, organizationId: org.id })"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">{{ org.name }}</p>
                <p class="text-xs text-slate-500">{{ org.role }} • {{ org.status }}</p>
              </div>
              <Icon
                v-if="auth.state.value.data?.currentOrgId === org.id"
                icon="mdi:check"
                class="h-3 w-3 shrink-0 text-brand"
              />
            </button>
          </div>
        </div>
      </div>

      <!-- Organizations Section (only standalone orgs, not shown under tenants) -->
      <div v-if="standaloneOrganizations.length > 0">
        <p class="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Organisationer</p>
        <button
          v-for="org in standaloneOrganizations"
          :key="org.id"
          class="mt-1 flex w-full items-start justify-between rounded-md px-2 py-2 text-left text-sm text-white transition"
          :class="{
            'bg-white/10': auth.state.value.data?.currentOrgId === org.id,
            'cursor-not-allowed opacity-40': isOrgLocked(org),
            'hover:bg-white/10': !isOrgLocked(org)
          }"
          :disabled="isOrgLocked(org)"
          @click="trySelectOrg(org)"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold">{{ org.name }}</p>
            <p class="text-xs text-slate-400">{{ org.role }} • {{ org.status }}</p>
          </div>
          <div class="flex items-center gap-1">
            <span v-if="org.requireSso" class="text-xs text-amber-400">SSO</span>
            <Icon
              v-if="auth.state.value.data?.currentOrgId === org.id"
              icon="mdi:check"
              class="h-4 w-4 shrink-0 text-brand"
            />
          </div>
        </button>

        <p v-if="!standaloneOrganizations.length && !tenants.length" class="px-2 py-4 text-sm text-slate-400">
          Inga kontexter tillgängliga.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import type { AuthOrganization, AuthTenant } from '~/types/auth'

const auth = useAuth()
const router = useRouter()
const open = ref(false)
const container = ref<HTMLElement>()
const contextTenants = ref<AuthTenant[] | null>(null)
const contextOrganizations = ref<AuthOrganization[] | null>(null)
const tenantOrganizationsRaw = ref<Record<string, AuthOrganization[]> | null>(null)
const searchInput = ref('')

const tenants = computed(() => contextTenants.value ?? auth.tenants.value)
const organizations = computed(() => contextOrganizations.value ?? auth.organizations.value)

const normalizedSearch = computed(() => normalizeText(searchInput.value))

const tenantOrganizations = computed<Record<string, AuthOrganization[]>>(() => {
  const map = tenantOrganizationsRaw.value
    ? normalizeTenantOrganizations(tenantOrganizationsRaw.value)
    : buildTenantOrgMapFromOrganizations(organizations.value)

  if (!normalizedSearch.value) {
    return map
  }

  const filtered: Record<string, AuthOrganization[]> = {}
  for (const [tenantId, orgs] of Object.entries(map)) {
    const matches = orgs.filter(org => matchesSearch(org.name, normalizedSearch.value))
    if (matches.length) {
      filtered[tenantId] = matches
    }
  }
  return filtered
})

const filteredTenants = computed(() => {
  if (!normalizedSearch.value) {
    return tenants.value
  }

  return tenants.value.filter(tenant => {
    if (matchesSearch(tenant.name, normalizedSearch.value)) {
      return true
    }
    const orgs = tenantOrganizations.value[tenant.id] ?? []
    return orgs.length > 0
  })
})

// Filter out organizations already visas under tenants, apply search
const standaloneOrganizations = computed(() => {
  const orgsInTenants = new Set<string>()
  for (const orgs of Object.values(tenantOrganizations.value)) {
    for (const org of orgs) {
      orgsInTenants.add(org.id)
    }
  }

  return organizations.value.filter(org => {
    if (orgsInTenants.has(org.id)) {
      return false
    }
    if (!normalizedSearch.value) {
      return true
    }
    return matchesSearch(org.name, normalizedSearch.value)
  })
})

const currentContextName = computed(() => {
  const currentOrg = auth.currentOrg.value
  const currentTenant = auth.currentTenant.value
  const allTenants = auth.tenants.value
  
  // If we have an organization selected
  if (currentOrg) {
    // If user is member of multiple tenants, show both tenant and organization
    if (allTenants.length > 1 && currentOrg.tenantId) {
      const orgTenant = allTenants.find(t => t.id === currentOrg.tenantId)
      if (orgTenant) {
        return `${orgTenant.name} • ${currentOrg.name}`
      }
    }
    // If only one tenant (or no tenant context), just show organization name
    return currentOrg.name
  }
  
  // If we have a tenant selected but no organization
  if (currentTenant) {
    return currentTenant.name
  }
  
  return 'Välj kontext'
})

const isSuperAdmin = auth.isSuperAdmin

const isOrgLocked = (org: AuthOrganization) =>
  org.requireSso && !org.hasLocalLoginOverride && !isSuperAdmin.value

async function navigateAfterContextChange(payload: { tenantId?: string | null; organizationId?: string | null }) {
  // If user is on settings page, just reload to ensure fresh state/view
  if (router.currentRoute.value.path.startsWith('/settings')) {
    // Since the state is reactive, we often don't need to do anything, but user requested "refresh feel".
    // We can do a simple router replacement to current route to trigger any watchers if needed,
    // or rely on the fact that auth state changed.
    // Let's just return and let reactivity handle it.
    return
  }

  const isSuperAdminUser = isSuperAdmin.value

  if (payload.organizationId) {
    if (isSuperAdminUser) {
      const org = auth.organizations.value.find(o => o.id === payload.organizationId)
      if (org) {
        // Only redirect if we are NOT already on an organization-specific page
        // or if we want to force view the new org.
        // User requested "stay on same page" but updated context.
        // However, if we are on Org A overview and switch to Org B, we MUST redirect or reload, 
        // otherwise we see Org A data with Org B context (or error).
        if (router.currentRoute.value.path.includes('/admin/organizations/')) {
           await router.push(`/admin/organizations/${org.slug}/overview`)
           return
        }
        // If we are on a generic page, stay there.
        return
      }
    } else {
      // For regular users, if they are not on settings, maybe send them to settings?
      // Or just let them stay.
      // If they are on a page that requires auth, middleware handles it.
      if (!router.currentRoute.value.path.startsWith('/settings')) {
        await router.push('/settings')
      }
      return
    }
  }

  if (payload.tenantId) {
    // If switching to a tenant, and we are on a generic page, we might want to go to the tenant dashboard?
    // Or stay?
    // User query was specific about "clicking an organization".
    // For tenant selection, the previous behavior (going to tenant dashboard) seemed accepted.
    await router.push(`/admin/tenants/${payload.tenantId}`)
  }
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    // Clear any previous errors
    auth.state.value.error = null
    loadContextOptions()
  }
}

async function loadContextOptions() {
  try {
    const data = await $fetch<{
      tenants: AuthTenant[]
      organizations: AuthOrganization[]
      tenantOrganizations: Record<string, AuthOrganization[]>
    }>('/api/auth/context-options', { credentials: 'include' })
    
    contextTenants.value = data.tenants
    contextOrganizations.value = data.organizations
    tenantOrganizationsRaw.value = data.tenantOrganizations ?? {}
  } catch (error) {
    console.error('Failed to load context options', error)
  }
}

async function selectTenant(tenantId: string) {
  try {
    await auth.switchContext({ tenantId, organizationId: null })
    open.value = false
    await navigateAfterContextChange({ tenantId, organizationId: null })
  } catch (error: any) {
    console.error('Failed to switch tenant:', error)
    auth.state.value.error = error.data?.message || error.message || 'Kunde inte byta till denna tenant.'
  }
}

async function selectContext(payload: { tenantId: string | null; organizationId: string | null }) {
  try {
    await auth.switchContext(payload)
    open.value = false
    await navigateAfterContextChange(payload)
  } catch (error: any) {
    console.error('Failed to switch context:', error)
    auth.state.value.error = error.data?.message || error.message || 'Kunde inte byta kontext.'
  }
}

async function trySelectOrg(org: AuthOrganization) {
  if (isOrgLocked(org)) {
    auth.state.value.error = 'Organisationen kräver SSO. Starta SSO-flödet för att fortsätta.'
    return
  }
  
  try {
    // If organization belongs to a tenant, keep that tenant context
    await auth.switchContext({ organizationId: org.id, tenantId: org.tenantId ?? null })
    open.value = false
    await navigateAfterContextChange({ organizationId: org.id, tenantId: org.tenantId ?? null })
  } catch (error: any) {
    console.error('Failed to switch context:', error)
    auth.state.value.error = error.data?.message || error.message || 'Kunde inte byta till denna organisation.'
    // Keep dropdown open so user can see the error
  }
}

function getTenantTypeIcon(type: string) {
  switch (type) {
    case 'distributor':
      return 'mdi:city'
    case 'provider':
      return 'mdi:store'
    default:
      return 'mdi:folder'
  }
}

function getTenantTypeLabel(type: string) {
  switch (type) {
    case 'distributor':
      return 'Distributör'
    case 'provider':
      return 'Leverantör'
    default:
      return type
  }
}

function getTenantTypeColor(type: string) {
  switch (type) {
    case 'distributor':
      return 'text-green-400'
    case 'provider':
      return 'text-blue-400'
    default:
      return 'text-slate-400'
  }
}

function handleGlobalClick(event: MouseEvent) {
  if (!open.value || !container.value) {
    return
  }
  const target = event.target as Node | null
  if (!target || container.value.contains(target)) {
    return
  }
  open.value = false
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleGlobalClick)
})

function normalizeTenantOrganizations(
  source: Record<string, AuthOrganization[]>
): Record<string, AuthOrganization[]> {
  const normalized: Record<string, AuthOrganization[]> = {}
  for (const [tenantId, orgs] of Object.entries(source)) {
    normalized[tenantId] = dedupeOrganizations(orgs).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }
  return normalized
}

function buildTenantOrgMapFromOrganizations(orgs: AuthOrganization[]) {
  const map: Record<string, AuthOrganization[]> = {}
  for (const org of orgs) {
    if (!org.tenantId) {
      continue
    }
    if (!map[org.tenantId]) {
      map[org.tenantId] = []
    }
    map[org.tenantId].push(org)
  }
  for (const tenantId of Object.keys(map)) {
    map[tenantId] = dedupeOrganizations(map[tenantId]).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }
  return map
}

function dedupeOrganizations(orgs: AuthOrganization[]) {
  const seen = new Set<string>()
  const unique: AuthOrganization[] = []
  for (const org of orgs) {
    if (seen.has(org.id)) {
      continue
    }
    seen.add(org.id)
    unique.push(org)
  }
  return unique
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function matchesSearch(value: string, query: string) {
  if (!query) {
    return true
  }
  return normalizeText(value).includes(query)
}
</script>

