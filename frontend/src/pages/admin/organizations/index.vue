<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Organisationer</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Hantera alla kundkonton, sök efter organisationer och öppna detaljerade vyer för medlemmar och inställningar.
      </p>
    </header>

    <div
      v-if="deletedSlug"
      class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
    >
      Organisationen "{{ deletedSlug }}" raderades permanent.
    </div>

    <div class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center md:justify-between">
      <form class="flex flex-1 flex-col gap-2 sm:flex-row" @submit.prevent="applySearch">
        <input
          v-model="searchInput"
          type="text"
          class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          placeholder="Sök efter namn eller slug"
        />
        <div class="flex gap-2">
          <button
            type="submit"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          >
            Sök
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            @click="clearSearch"
          >
            Rensa
          </button>
        </div>
      </form>

      <div class="flex gap-2">
        <NuxtLink
          to="/admin/audit-logs"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
          Audit Loggar
        </NuxtLink>
        <NuxtLink
          to="/admin/settings/email"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          <Icon icon="mdi:email-outline" class="h-4 w-4" />
          Global e-post
        </NuxtLink>
        <NuxtLink
          to="/admin/users"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          <Icon icon="mdi:account-group-outline" class="h-4 w-4" />
          Hantera användare
        </NuxtLink>
        <NuxtLink
          to="/admin/organizations/new"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa organisation
        </NuxtLink>
      </div>
    </div>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Alla organisationer</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ organizations.length }} resultat
            <span v-if="appliedQuery">för "{{ appliedQuery }}"</span>
          </p>
        </div>
        <button
          class="rounded border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="refreshList"
        >
          Uppdatera
        </button>
      </div>

      <div v-if="listError" class="px-6 py-4 text-sm text-red-500">{{ listError }}</div>
      <div v-else-if="pending" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">Laddar organisationer...</div>
      <div v-else-if="!organizations.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
        Inga organisationer matchade din sökning.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
          <thead class="bg-slate-50 dark:bg-white/5">
            <tr>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisation</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Medlemmar</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">SSO</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Skapad</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-white/5">
            <tr
              v-for="org in organizations"
              :key="org.id"
              class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
              @click="navigateToOrg(org.slug)"
            >
              <td class="px-6 py-3 text-slate-900 dark:text-white">
                <div class="font-semibold">{{ org.name }}</div>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ org.status }}</p>
              </td>
              <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</td>
              <td class="px-6 py-3 text-slate-700 dark:text-slate-200">
                <span v-if="org.tenantId" class="text-xs text-slate-500 dark:text-slate-400">
                  Tenant: {{ org.tenantId.slice(0, 8) }}...
                </span>
                <span v-else class="text-xs text-slate-400 dark:text-slate-500">Ingen tenant</span>
              </td>
              <td class="px-6 py-3 text-slate-700 dark:text-slate-200">
                <button
                  class="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/20 dark:text-slate-200"
                  @click.stop="navigateToMembers(org.slug)"
                >
                  {{ org.memberCount }} st
                </button>
              </td>
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
                <StatusPill :variant="org.requireSso ? 'success' : 'info'">
                  {{ org.requireSso ? 'På' : 'Av' }}
                </StatusPill>
              </td>
              <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                {{ formatDate(org.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRoute, useRouter } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminOrganizationSummary } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const router = useRouter()
const route = useRoute()
const searchInput = ref('')
const appliedQuery = ref('')
const deletedSlug = ref(typeof route.query.deleted === 'string' ? route.query.deleted : '')

if (deletedSlug.value) {
  const updatedQuery = { ...route.query }
  delete updatedQuery.deleted
  router.replace({ query: updatedQuery })
}

const { data, pending, refresh, error } = await useFetch<{ organizations: AdminOrganizationSummary[] }>(
  '/api/admin/organizations',
  {
    query: () => (appliedQuery.value ? { q: appliedQuery.value } : {}),
    watch: [appliedQuery]
  }
)

const organizations = computed(() => data.value?.organizations ?? [])
const listError = computed(() => (error.value ? error.value.message : ''))

const applySearch = () => {
  appliedQuery.value = searchInput.value.trim()
}

const clearSearch = () => {
  searchInput.value = ''
  appliedQuery.value = ''
  refresh()
}

const navigateToOrg = (slug: string) => {
  router.push(`/admin/organizations/${slug}/overview`)
}

const navigateToMembers = (slug: string) => {
  router.push(`/admin/organizations/${slug}/members`)
}

const refreshList = () => {
  refresh()
}

const formatDate = (value: number) =>
  new Date(value).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
</script>

