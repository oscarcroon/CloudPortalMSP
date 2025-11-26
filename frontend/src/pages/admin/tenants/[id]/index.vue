<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ tenant?.name ?? 'Laddar...' }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        <span v-if="tenant?.type === 'distributor'">Distributör - kan skapa leverantörer</span>
        <span v-else-if="tenant?.type === 'provider'">Leverantör - kan skapa organisationer</span>
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
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Information</h2>
          <button
            v-if="canEdit && (tenant.type === 'provider' || tenant.type === 'distributor')"
            class="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            @click="isEditing = !isEditing"
          >
            <Icon :icon="isEditing ? 'mdi:close' : 'mdi:pencil'" class="h-4 w-4" />
            <span class="ml-1">{{ isEditing ? 'Avbryt' : 'Redigera' }}</span>
          </button>
        </div>
        
        <div v-if="updateError" class="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {{ updateError }}
        </div>

        <div v-if="!isEditing" class="mt-4 grid gap-4 md:grid-cols-2">
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

        <form v-else @submit.prevent="handleSave" class="mt-4 space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label for="name" class="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Namn
              </label>
              <input
                id="name"
                v-model="editForm.name"
                type="text"
                required
                minlength="2"
                maxlength="120"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </div>
            <div>
              <label for="slug" class="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Slug
              </label>
              <input
                id="slug"
                v-model="editForm.slug"
                type="text"
                required
                minlength="2"
                maxlength="120"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Endast små bokstäver, siffror och bindestreck
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon v-if="saving" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              <span v-else>Spara</span>
            </button>
            <button
              type="button"
              @click="cancelEdit"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Avbryt
            </button>
          </div>
        </form>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="tenant.type === 'distributor' && canCreateProvider"
          :to="`/admin/tenants/${tenant.id}/providers/new`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa leverantör
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' && canCreateOrganization"
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

      <!-- Linked Tenants (Providers for Distributors, Distributors for Providers) -->
      <div v-if="tenant.type === 'distributor' || tenant.type === 'provider'" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              <span v-if="tenant.type === 'distributor'">Leverantörer</span>
              <span v-else-if="tenant.type === 'provider'">Distributörer</span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              <span v-if="tenant.type === 'distributor'">{{ linkedTenants.length }} leverantörer</span>
              <span v-else-if="tenant.type === 'provider'">{{ linkedTenants.length }} distributörer</span>
            </p>
          </div>
          <button
            v-if="tenant.type === 'provider' && canEditTenant"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            @click="openEditDistributorsModal"
          >
            <Icon icon="mdi:pencil-outline" class="h-3 w-3" />
            Redigera
          </button>
        </div>
        <div v-if="linkedTenants.length === 0" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
          <span v-if="tenant.type === 'provider'">Inga distributörer kopplade.</span>
          <span v-else>Inga leverantörer kopplade.</span>
        </div>
        <div v-else class="overflow-x-auto">
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
                v-for="linked in linkedTenants"
                :key="linked.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToTenant(linked.id)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ linked.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ linked.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="linked.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    title="E-post override aktiv"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    Override
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">Ärvs</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="linked.status === 'active' ? 'success' : 'warning'">
                    {{ linked.status }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Organizations (for Providers) -->
      <div v-if="tenant.type === 'provider' && organizations.length > 0" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
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

    <!-- Edit Distributors Modal -->
    <Modal :show="showEditDistributorsModal" @close="closeEditDistributorsModal">
      <template #title>Redigera distributör-kopplingar</template>
      <template #content>
        <form @submit.prevent="handleSaveDistributors" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">Distributörer</label>
            <div class="mt-2 space-y-2 max-h-60 overflow-y-auto">
              <label
                v-for="distributor in allDistributors"
                :key="distributor.id"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="distributor.id"
                  v-model="editDistributorsForm.distributorIds"
                  class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/10 dark:bg-black/20"
                />
                <span class="text-sm text-slate-900 dark:text-white">
                  {{ distributor.name }} ({{ distributor.slug }})
                </span>
              </label>
              <p v-if="allDistributors.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                Inga distributörer tillgängliga.
              </p>
            </div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Välj vilka distributörer denna leverantör ska kopplas till.
            </p>
          </div>
          <div v-if="editDistributorsError" class="text-sm text-red-500">{{ editDistributorsError }}</div>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              @click="closeEditDistributorsModal"
            >
              Avbryt
            </button>
            <button
              type="submit"
              class="inline-flex justify-center rounded-md border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand/80 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              :disabled="savingDistributors"
            >
              <Icon v-if="savingDistributors" icon="mdi:loading" class="h-5 w-5 animate-spin" />
              <span v-else>Spara</span>
            </button>
          </div>
        </form>
      </template>
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import Modal from '~/components/shared/Modal.vue'
import type { AdminTenantDetail, AdminTenantSummary } from '~/types/admin'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const tenantId = route.params.id as string

const { data, pending, error, refresh } = await useFetch<AdminTenantDetail>(`/api/admin/tenants/${tenantId}`)

const tenant = computed(() => data.value?.tenant)
const members = computed(() => data.value?.members ?? [])
const childTenants = computed(() => data.value?.childTenants ?? [])
const linkedTenants = computed(() => data.value?.linkedTenants ?? [])
const organizations = computed(() => data.value?.organizations ?? [])

const isEditing = ref(false)
const saving = ref(false)
const updateError = ref('')
const editForm = ref({
  name: '',
  slug: ''
})

watch(tenant, (t) => {
  if (t) {
    editForm.value.name = t.name
    editForm.value.slug = t.slug
  }
}, { immediate: true })

const canEdit = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  return role === 'admin'
})

const cancelEdit = () => {
  if (tenant.value) {
    editForm.value.name = tenant.value.name
    editForm.value.slug = tenant.value.slug
  }
  isEditing.value = false
  updateError.value = ''
}

const handleSave = async () => {
  if (!tenant.value) return
  saving.value = true
  updateError.value = ''
  
  try {
    await $fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PUT',
      body: {
        name: editForm.value.name.trim(),
        slug: editForm.value.slug.trim()
      }
    })
    await refresh()
    isEditing.value = false
  } catch (err) {
    updateError.value = err instanceof Error ? err.message : 'Kunde inte spara ändringarna.'
  } finally {
    saving.value = false
  }
}

const canCreateProvider = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'distributor') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const canCreateOrganization = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'provider') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const canEditTenant = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  return role === 'admin'
})

// Fetch all distributors for editing provider links
interface TenantsResponse {
  tenants: AdminTenantSummary[]
  organizations?: any[]
  distributorProviderLinks?: any[]
}

const { data: distributorsData } = await useFetch<TenantsResponse>('/api/admin/tenants', {
  query: { type: 'distributor' }
})

const allDistributors = computed(() => distributorsData.value?.tenants ?? [])

// Edit distributors modal state
const showEditDistributorsModal = ref(false)
const savingDistributors = ref(false)
const editDistributorsError = ref('')
const editDistributorsForm = ref({
  distributorIds: [] as string[]
})

const openEditDistributorsModal = () => {
  if (tenant.value?.type === 'provider') {
    // Initialize form with currently linked distributors
    editDistributorsForm.value.distributorIds = linkedTenants.value.map(t => t.id)
    editDistributorsError.value = ''
    showEditDistributorsModal.value = true
  }
}

const closeEditDistributorsModal = () => {
  showEditDistributorsModal.value = false
  editDistributorsError.value = ''
}

const handleSaveDistributors = async () => {
  if (!tenant.value || tenant.value.type !== 'provider') return

  savingDistributors.value = true
  editDistributorsError.value = ''

  try {
    await $fetch(`/api/admin/tenants/${tenantId}/providers`, {
      method: 'PUT',
      body: {
        distributorIds: editDistributorsForm.value.distributorIds
      }
    })
    await refresh()
    closeEditDistributorsModal()
  } catch (err: any) {
    editDistributorsError.value = err.data?.message || err.message || 'Kunde inte spara ändringarna.'
  } finally {
    savingDistributors.value = false
  }
}

const navigateToTenant = (id: string) => {
  router.push(`/admin/tenants/${id}`)
}

const navigateToOrg = (slug: string) => {
  router.push(`/admin/organizations/${slug}/overview`)
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'distributor':
      return 'Distributör'
    case 'provider':
      return 'Leverantör'
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

