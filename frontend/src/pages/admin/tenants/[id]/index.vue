<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ tenant?.name ?? 'Laddar...' }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        <span v-if="tenant?.type === 'provider'">Leverantör - kan skapa distributörer</span>
        <span v-else-if="tenant?.type === 'distributor'">Distributör - kan skapa organisationer</span>
        <span v-else-if="tenant?.type === 'organization'">Organisation</span>
      </p>
    </header>

    <div v-if="error" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <div v-if="pending" class="text-sm text-slate-600 dark:text-slate-400">Laddar tenant-detaljer...</div>

    <div v-else-if="tenant" class="space-y-6">
      <!-- Tenant Information -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Information</h2>
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ tenant.name }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</p>
            <p class="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">{{ tenant.slug }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Typ</p>
            <span
              class="mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
              :class="getTypeClass(tenant.type)"
            >
              {{ getTypeLabel(tenant.type) }}
            </span>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
            <StatusPill :variant="tenant.status === 'active' ? 'success' : 'warning'" class="mt-1">
              {{ tenant.status }}
            </StatusPill>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="tenant.type === 'provider' && canCreateDistributor"
          :to="`/admin/tenants/${tenant.id}/distributors/new`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa distributör
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'distributor' && canCreateOrganization"
          :to="`/admin/organizations/new?tenantId=${tenant.id}`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa organisation
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/email`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:email-outline" class="h-4 w-4" />
          E-postinställningar
        </NuxtLink>
      </div>

      <!-- Child Tenants (Distributors for Providers) -->
      <div v-if="tenant.type === 'provider' && childTenants.length > 0" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Distributörer</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ childTenants.length }} distributörer</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr
                v-for="child in childTenants"
                :key="child.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToTenant(child.id)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ child.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ child.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="child.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    title="E-post override aktiv"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    Override
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">Ärvs</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="child.status === 'active' ? 'success' : 'warning'">
                    {{ child.status }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Organizations (for Distributors) -->
      <div v-if="tenant.type === 'distributor' && organizations.length > 0" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Organisationer</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ organizations.length }} organisationer</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr
                v-for="org in organizations"
                :key="org.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToOrg(org.slug)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ org.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="org.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    title="E-post override aktiv"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    Override
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">Ärvs</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="org.status === 'active' ? 'success' : 'warning'">
                    {{ org.status }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Members -->
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Medlemmar</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ members.length }} medlemmar</p>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Användare</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="member in members" :key="member.id" class="text-slate-900 dark:text-white">
                <td class="px-6 py-3">
                  <div class="font-semibold">{{ member.user.email }}</div>
                  <p v-if="member.user.fullName" class="text-xs text-slate-500 dark:text-slate-400">
                    {{ member.user.fullName }}
                  </p>
                </td>
                <td class="px-6 py-3">
                  <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {{ member.role }}
                  </span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="member.status === 'active' ? 'success' : 'warning'">
                    {{ member.status }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useFetch, useRoute, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminTenantDetail } from '~/types/admin'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const tenantId = route.params.id as string

const { data, pending, error } = await useFetch<AdminTenantDetail>(`/api/admin/tenants/${tenantId}`)

const tenant = computed(() => data.value?.tenant)
const members = computed(() => data.value?.members ?? [])
const childTenants = computed(() => data.value?.childTenants ?? [])
const organizations = computed(() => data.value?.organizations ?? [])

const canCreateDistributor = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'provider') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const canCreateOrganization = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'distributor') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const navigateToTenant = (id: string) => {
  router.push(`/admin/tenants/${id}`)
}

const navigateToOrg = (slug: string) => {
  router.push(`/admin/organizations/${slug}/overview`)
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'provider':
      return 'Leverantör'
    case 'distributor':
      return 'Distributör'
    case 'organization':
      return 'Organisation'
    default:
      return type
  }
}

const getTypeClass = (type: string) => {
  switch (type) {
    case 'provider':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'distributor':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'organization':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
}
</script>

