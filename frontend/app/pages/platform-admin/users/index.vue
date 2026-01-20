<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink to="/platform-admin/organizations" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        {{ t('adminUsers.backToOrganizations') }}
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ t('adminUsers.title') }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ t('adminUsers.description') }}</p>
    </header>

    <form class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 md:flex-row md:items-center" @submit.prevent="applySearch">
      <input
        v-model="searchInput"
        type="search"
        :placeholder="t('adminUsers.searchPlaceholder')"
        class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
      />
      <div class="flex gap-2">
        <button
          type="submit"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          {{ t('adminUsers.search') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="clearSearch"
        >
          {{ t('adminUsers.clear') }}
        </button>
      </div>
    </form>

    <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
      <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
        <div>
          <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('adminUsers.allUsers') }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('adminUsers.results', { count: users.length }) }}
            <span v-if="appliedQuery"> {{ t('adminUsers.for', { query: appliedQuery }) }}</span>
          </p>
        </div>
        <NuxtLink
          to="/platform-admin/organizations"
          class="rounded border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
        >
          {{ t('adminUsers.manageOrganizations') }}
        </NuxtLink>
      </div>

      <div v-if="listError" class="px-6 py-4 text-sm text-red-500">{{ listError }}</div>
      <div v-else-if="pending" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{{ t('adminUsers.loading') }}</div>
      <div v-else-if="!users.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{{ t('adminUsers.noResults') }}</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
          <thead class="bg-slate-50 dark:bg-white/5">
            <tr>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminUsers.table.email') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminUsers.table.name') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminUsers.table.status') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminUsers.table.orgActive') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminUsers.table.created') }}</th>
              <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminUsers.table.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-white/5">
            <tr v-for="user in users" :key="user.id" class="transition hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-6 py-3 font-medium text-slate-900 dark:text-white">{{ user.email }}</td>
              <td class="px-6 py-3 text-slate-600 dark:text-slate-300">{{ user.fullName ?? '—' }}</td>
              <td class="px-6 py-3">
                <StatusPill :variant="user.status === 'active' ? 'success' : 'danger'">
                  {{ user.status === 'active' ? t('adminUsers.table.active') : t('adminUsers.table.inactive') }}
                </StatusPill>
                <p v-if="user.forcePasswordReset" class="text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-300">
                  {{ t('adminUsers.table.requiresPasswordReset') }}
                </p>
              </td>
              <td class="px-6 py-3 text-slate-700 dark:text-slate-200">
                {{ t('adminUsers.table.count', { count: user.organizationCount }) }}
                <span class="text-xs text-slate-500 dark:text-slate-400"> {{ t('adminUsers.table.activeCount', { count: user.activeOrganizations }) }}</span>
              </td>
              <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">{{ formatDate(user.createdAt) }}</td>
              <td class="px-6 py-3 text-sm">
                <button class="text-brand transition hover:text-brand/70" @click="openUser(user.id)">{{ t('adminUsers.table.manage') }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRouter, useI18n } from '#imports'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminUsersResponse } from '~/types/admin'

const { t } = useI18n()

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const router = useRouter()
const searchInput = ref('')
const appliedQuery = ref('')

const { data, pending, refresh, error } = await useFetch<AdminUsersResponse>('/api/admin/users', {
  query: () => (appliedQuery.value ? { q: appliedQuery.value } : {}),
  watch: [appliedQuery]
})

const users = computed(() => data.value?.users ?? [])
const listError = computed(() => (error.value ? error.value.message : ''))

const applySearch = () => {
  appliedQuery.value = searchInput.value.trim()
}

const clearSearch = () => {
  searchInput.value = ''
  appliedQuery.value = ''
  refresh()
}

const openUser = (userId: string) => {
  router.push(`/platform-admin/users/${userId}`)
}

const formatDate = (value: number | null | undefined) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}
</script>


