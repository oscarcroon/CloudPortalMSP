<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <NuxtLink to="/tenant-admin" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        ← Tillbaka
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ organization?.name ?? 'Organisation' }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Översikt och grundinställningar.</p>
    </header>

    <OrganizationTabs :slug="slug" active="overview" />

    <div v-if="showCreatedBanner" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
      Organisationen skapades. Hantera medlemmar via fliken
      <NuxtLink :to="`/tenant-admin/organizations/${slug}/members`" class="font-semibold underline hover:no-underline">Medlemmar</NuxtLink>
      eller konfigurera SSO via fliken <strong>Auth</strong>.
    </div>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="pending" class="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      Hämtar organisationsdata...
    </div>

    <template v-else-if="organization">
      <div class="grid gap-4 md:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</p>
          <p class="mt-1 font-mono text-sm text-slate-900 dark:text-white">{{ organization.slug }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Standardroll</p>
          <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ organization.defaultRole }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Medlemmar</p>
          <p class="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{{ stats.memberCount }}</p>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
          <div class="mt-2 space-y-2">
            <StatusPill :variant="organization.status === 'active' ? 'success' : 'warning'">
              {{ organization.status === 'active' ? 'Aktiv' : 'Inaktiv' }}
            </StatusPill>
            <div v-if="canChangeStatus" class="space-y-1.5">
              <button
                class="w-full rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                :class="organization.status === 'active' 
                  ? 'border-amber-300 bg-amber-100 text-amber-800 hover:border-amber-400 hover:bg-amber-200 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30'
                  : 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-200 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-100 dark:hover:bg-emerald-500/30'"
                :disabled="statusLoading"
                @click="toggleOrganizationStatus"
              >
                <span v-if="statusLoading" class="flex items-center justify-center gap-1.5">
                  <Icon icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                  <span>Uppdaterar...</span>
                </span>
                <span v-else-if="organization.status === 'active'" class="flex items-center justify-center gap-1.5">
                  <Icon icon="mdi:alert-circle" class="h-3.5 w-3.5" />
                  <span>Inaktivera organisation</span>
                </span>
                <span v-else class="flex items-center justify-center gap-1.5">
                  <Icon icon="mdi:check-circle" class="h-3.5 w-3.5" />
                  <span>Aktivera organisation</span>
                </span>
              </button>
              <p v-if="organization.status === 'active'" class="text-xs text-amber-700 dark:text-amber-300">
                Inaktivering gör att organisationen inte kan användas tills den aktiveras igen.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5" @submit.prevent="handleSave">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Grundinställningar</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Redigera namn, slug och standardflaggor.</p>
          </div>
          <button
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="saving"
          >
            {{ saving ? 'Sparar...' : 'Spara ändringar' }}
          </button>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</label>
            <input
              v-model="form.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</label>
            <input
              v-model="form.slug"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Kontaktperson</label>
            <input
              v-model="form.billingEmail"
              type="email"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Standardroll</label>
            <select
              v-model="form.defaultRole"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-900 dark:text-white"
            >
              <option v-for="role in roles" :key="role" :value="role" class="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{{ role }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">COREID</label>
            <input
              v-model="form.coreId"
              type="text"
              maxlength="4"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white uppercase"
              placeholder="ABCD"
              style="text-transform: uppercase;"
            />
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input
              id="overview-require-sso"
              v-model="form.requireSso"
              type="checkbox"
              class="rounded border-slate-300 dark:border-white/20"
              :disabled="!canToggleRequireSso"
            />
            <label for="overview-require-sso" class="text-sm text-slate-700 dark:text-slate-200">
              Kräv SSO
              <span v-if="!canToggleRequireSso" class="block text-xs text-slate-500 dark:text-slate-400">
                {{ requireSsoHint }}
              </span>
            </label>
          </div>
        </div>
      </form>

      <!-- Provider Section -->
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
              <Icon icon="mdi:city" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Leverantör</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                <span v-if="data?.provider">{{ data.provider.name }} ({{ data.provider.slug }})</span>
                <span v-else>Ingen leverantör kopplad</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import { Icon } from '@iconify/vue'
import OrganizationTabs from '~/components/admin/OrganizationTabs.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { rbacRoles } from '~/constants/rbac'
import type { AdminOrganizationDetail, AdminUpdateOrganizationPayload } from '~/types/admin'
import { useEntityNames } from '~/composables/useEntityNames'

definePageMeta({
  layout: 'default'
  // superAdmin not required - API endpoint validates tenant permissions
})

const route = useRoute()
const router = useRouter()
const roles = rbacRoles
const entityNames = useEntityNames()

const slug = computed(() => route.params.slug as string)
const saving = ref(false)
const errorMessage = ref('')
const showCreatedBanner = ref(route.query.created === '1')
const statusLoading = ref(false)

const { data, pending, refresh, error } = await (useFetch as any)(
  `/api/admin/organizations/${slug.value}`,
  {
    watch: [slug]
  }
)

const organization = computed(() => data.value?.organization)
const provider = computed(() => data.value?.provider ?? null)
const stats = computed(() => data.value?.stats ?? { memberCount: 0, activeMembers: 0, pendingInvites: 0 })

// Cache organization name for breadcrumbs
watch(() => organization.value, (org) => {
  if (org?.id && org?.name) {
    entityNames.setName('organization', org.id, org.name)
    // Also cache by slug since URL uses slug
    entityNames.setName('organization', org.slug, org.name)
  }
}, { immediate: true })
const authSettings = computed(() => data.value?.authSettings ?? null)

const form = reactive({
  name: '',
  slug: '',
  billingEmail: '',
  coreId: '',
  defaultRole: 'member' as (typeof roles)[number],
  requireSso: false
})

const canToggleRequireSso = computed(() => {
  if (!authSettings.value) {
    return false
  }
  if (authSettings.value.idpType === 'none') {
    return false
  }
  if (authSettings.value.idpType === 'oidc') {
    const config = authSettings.value.idpConfig
    if (!config) return false
    const issuer = typeof config.issuer === 'string' ? config.issuer.trim() : ''
    const clientId = typeof config.clientId === 'string' ? config.clientId.trim() : ''
    const clientSecret =
      typeof config.clientSecret === 'string' ? config.clientSecret.trim() : ''
    const redirectUri =
      typeof config.redirectUri === 'string' ? config.redirectUri.trim() : ''
    return Boolean(issuer && clientId && clientSecret && redirectUri)
  }
  return Boolean(authSettings.value.idpConfig)
})

const requireSsoHint = computed(() => {
  if (!authSettings.value || authSettings.value.idpType === 'none') {
    return 'Konfigurera en IdP före du kräver SSO.'
  }
  if (!canToggleRequireSso.value) {
    return 'IdP-konfigurationen saknar issuer/client/secret/redirect.'
  }
  return ''
})

const canChangeStatus = computed(() => {
  // For provider admins, they can change status if organization belongs to their provider
  // This will be validated on the backend
  return true
})

watch(
  organization,
  (org) => {
    if (!org) return
    form.name = org.name
    form.slug = org.slug
    form.billingEmail = org.billingEmail ?? ''
    form.coreId = org.coreId ?? ''
    form.defaultRole = org.defaultRole as (typeof roles)[number]
    form.requireSso = org.requireSso
  },
  { immediate: true }
)

watch(
  canToggleRequireSso,
  (allowed) => {
    if (!allowed) {
      form.requireSso = false
    }
  }
)

if (showCreatedBanner.value) {
  const updatedQuery = { ...route.query }
  delete updatedQuery.created
  router.replace({ query: updatedQuery })
}

if (error.value) {
  errorMessage.value = error.value.message
}

const handleSave = async () => {
  if (!organization.value) return
  saving.value = true
  errorMessage.value = ''
  const payload: AdminUpdateOrganizationPayload = {
    name: form.name.trim(),
    defaultRole: form.defaultRole,
    requireSso: form.requireSso
  }

  if (form.slug.trim()) {
    payload.slug = form.slug.trim()
  }
  payload.billingEmail = form.billingEmail.trim() || null
  payload.coreId = form.coreId.trim() ? form.coreId.trim().toUpperCase() : null

  try {
    await ($fetch as any)(`/api/admin/organizations/${slug.value}`, {
      method: 'PATCH',
      body: payload
    })
    await refresh()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte spara ändringarna.'
  } finally {
    saving.value = false
  }
}

const toggleOrganizationStatus = async () => {
  if (!organization.value) return
  const newStatus = organization.value.status === 'active' ? 'inactive' : 'active'
  const confirmMessage = newStatus === 'inactive' 
    ? 'Inaktivera organisationen? Organisationen kommer inte att kunna användas förrän den aktiveras igen.'
    : 'Aktivera organisationen?'
  
  if (!confirm(confirmMessage)) {
    return
  }
  
  statusLoading.value = true
  errorMessage.value = ''
  try {
    await ($fetch as any)(`/api/admin/organizations/${slug.value}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    })
    await refresh()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte uppdatera organisations status.'
  } finally {
    statusLoading.value = false
  }
}
</script>

