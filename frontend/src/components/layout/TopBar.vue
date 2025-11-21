<template>
  <header
    class="border-b border-[var(--surface-border)] bg-[var(--surface-topbar)] shadow-sm backdrop-blur transition-colors"
  >
    <div class="mx-auto flex flex-wrap items-center gap-4 px-4 py-2 text-sm text-slate-700 dark:text-slate-100 lg:max-w-6xl">
      <p class="text-sm font-medium">
        {{ activeOrganisation?.name || 'Välj organisation' }}
      </p>

      <div class="hidden flex-1 md:block">
        <label class="sr-only" for="global-search">Sök</label>
        <input
          id="global-search"
          v-model="search"
          type="search"
          placeholder="Sök DNS, containers, VMs..."
          class="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div class="ml-auto flex items-center gap-3">
        <NuxtLink
          to="/support"
          class="hidden items-center text-xs uppercase tracking-wide text-brand md:inline-flex"
        >
          Hjälp
        </NuxtLink>

        <ThemeToggle />

        <button
          class="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {{ currentUser?.email ?? 'Okänd' }}
        </button>
        <button
          class="rounded-md border border-transparent bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand/90"
          @click="handleLogout"
        >
          Logga ut
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
import { useAuth } from '~/composables/useAuth'

const auth = useAuth()
const search = ref('')
const currentUser = computed(() => auth.user.value)
const activeOrganisation = computed(() => auth.currentOrg.value)

const handleLogout = async () => {
  await auth.logout()
  await navigateTo('/login')
}
</script>

