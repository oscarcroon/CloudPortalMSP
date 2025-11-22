<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <NuxtLink to="/admin/organizations" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        ← Tillbaka till listan
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ organization?.name ?? 'Organisation' }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Översikt och grundinställningar.</p>
    </header>

    <OrganizationTabs :slug="slug" active="overview" />

    <div v-if="showCreatedBanner" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
      Organisationen skapades. Hantera medlemmar under
      <NuxtLink to="/settings/members" class="font-semibold underline hover:no-underline">Inställningar → Medlemmar</NuxtLink>
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
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">SSO-läge</p>
          <StatusPill :variant="organization.requireSso ? 'success' : 'info'">
            {{ organization.requireSso ? 'Krävs' : 'Valfritt' }}
          </StatusPill>
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
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Faktura-e-post</label>
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
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
            </select>
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
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="overview-self-signup" v-model="form.allowSelfSignup" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="overview-self-signup" class="text-sm text-slate-700 dark:text-slate-200">Tillåt självregistrering</label>
          </div>
        </div>
      </form>

      <section class="rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/40 dark:bg-[#1a0f14]">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-red-700 dark:text-red-200">Danger zone</h2>
            <p class="text-sm text-red-600 dark:text-red-300">
              Radering tar bort all data kopplad till organisationen, inklusive medlemskap i denna organisation, DNS-poster och containerprojekt. Medlemmarnas användarkonton och medlemskap i andra organisationer påverkas inte. Detta kan inte ångras.
            </p>
          </div>
          <button
            class="rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-500/10"
            :disabled="!organization"
            @click="openDeleteModal"
          >
            Ta bort organisation
          </button>
        </div>
      </section>
    </template>
  </section>

  <div
    v-if="showDeleteModal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    @click.self="closeDeleteModal"
  >
    <form
      class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]"
      @submit.prevent="submitDelete"
    >
      <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Ta bort organisation</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Bekräfta åtgärden genom att skriva in organisationens slug (<strong>{{ organization?.slug }}</strong>) och markera att du förstår konsekvenserna. Medlemmarnas användarkonton och medlemskap i andra organisationer påverkas inte.
      </p>
      <div>
        <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bekräfta slug</label>
        <input
          v-model="deleteForm.confirmSlug"
          type="text"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
          :placeholder="organization?.slug ?? ''"
        />
      </div>
      <label class="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200">
        <input v-model="deleteForm.acknowledgeImpact" type="checkbox" class="mt-1 rounded border-slate-300 dark:border-white/20" />
        <span>Jag förstår att organisationen och all kopplad data (medlemskap i denna organisation, DNS-poster, containerprojekt m.m.) raderas permanent. Medlemmarnas användarkonton och medlemskap i andra organisationer påverkas inte.</span>
      </label>
      <div v-if="deleteError" class="rounded bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
        {{ deleteError }}
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200" @click="closeDeleteModal">
          Avbryt
        </button>
        <button
          type="submit"
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          :disabled="deleteDisabled || deleteLoading"
        >
          {{ deleteLoading ? 'Raderar...' : 'Ta bort permanent' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import OrganizationTabs from '~/components/admin/OrganizationTabs.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { rbacRoles } from '~/constants/rbac'
import type { AdminOrganizationDetail, AdminUpdateOrganizationPayload } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const router = useRouter()
const roles = rbacRoles

const slug = computed(() => route.params.slug as string)
const saving = ref(false)
const errorMessage = ref('')
const showCreatedBanner = ref(route.query.created === '1')
const showDeleteModal = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')
const deleteForm = reactive({
  confirmSlug: '',
  acknowledgeImpact: false
})

const { data, pending, refresh, error } = await useFetch<AdminOrganizationDetail>(
  `/api/admin/organizations/${slug.value}`,
  {
    watch: [slug]
  }
)

const organization = computed(() => data.value?.organization)
const stats = computed(() => data.value?.stats ?? { memberCount: 0, activeMembers: 0, pendingInvites: 0 })
const authSettings = computed(() => data.value?.authSettings ?? null)
const deleteDisabled = computed(() => {
  if (!organization.value) return true
  return (
    deleteForm.confirmSlug.trim() !== organization.value.slug || deleteForm.acknowledgeImpact === false
  )
})

const form = reactive({
  name: '',
  slug: '',
  billingEmail: '',
  defaultRole: roles[3],
  requireSso: false,
  allowSelfSignup: false
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

watch(
  organization,
  (org) => {
    if (!org) return
    form.name = org.name
    form.slug = org.slug
    form.billingEmail = org.billingEmail ?? ''
    form.defaultRole = org.defaultRole
    form.requireSso = org.requireSso
    form.allowSelfSignup = org.allowSelfSignup
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
    requireSso: form.requireSso,
    allowSelfSignup: form.allowSelfSignup
  }

  if (form.slug.trim()) {
    payload.slug = form.slug.trim()
  }
  payload.billingEmail = form.billingEmail.trim() || null

  try {
    await $fetch(`/api/admin/organizations/${slug.value}`, {
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

const openDeleteModal = () => {
  deleteForm.confirmSlug = ''
  deleteForm.acknowledgeImpact = false
  deleteError.value = ''
  showDeleteModal.value = true
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
}

const submitDelete = async () => {
  if (!organization.value) return
  deleteError.value = ''
  deleteLoading.value = true
  try {
    await $fetch(`/api/admin/organizations/${slug.value}/delete`, {
      method: 'POST',
      body: {
        confirmSlug: deleteForm.confirmSlug.trim(),
        acknowledgeImpact: deleteForm.acknowledgeImpact
      }
    })
    closeDeleteModal()
    router.replace({ path: '/admin/organizations', query: { deleted: organization.value.slug } })
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Kunde inte radera organisationen.'
  } finally {
    deleteLoading.value = false
  }
}
</script>

