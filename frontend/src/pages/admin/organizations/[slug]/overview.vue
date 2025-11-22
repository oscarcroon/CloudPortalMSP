<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <NuxtLink to="/admin/organizations" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        ← Tillbaka till listan
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ organization?.name ?? 'Organisation' }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Översikt och grundinställningar.</p>
    </header>

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
            <input id="overview-require-sso" v-model="form.requireSso" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="overview-require-sso" class="text-sm text-slate-700 dark:text-slate-200">Kräv SSO</label>
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="overview-self-signup" v-model="form.allowSelfSignup" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="overview-self-signup" class="text-sm text-slate-700 dark:text-slate-200">Tillåt självregistrering</label>
          </div>
        </div>
      </form>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useAsyncData, useRoute, useRouter, watch } from '#imports'
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

const { data, pending, refresh, error } = await useAsyncData(
  () => $fetch<AdminOrganizationDetail>(`/api/admin/organizations/${slug.value}`),
  {
    watch: [slug]
  }
)

const organization = computed(() => data.value?.organization)
const stats = computed(() => data.value?.stats ?? { memberCount: 0, activeMembers: 0, pendingInvites: 0 })

const form = reactive({
  name: '',
  slug: '',
  billingEmail: '',
  defaultRole: roles[3],
  requireSso: false,
  allowSelfSignup: false
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
</script>

