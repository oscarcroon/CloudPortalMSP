<template>
  <div class="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">
    <TopBar />
    <MainNavbar />

    <div v-if="authError" class="mx-auto max-w-6xl px-4">
      <div class="mb-4 flex items-start justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
        <p>{{ authError }}</p>
        <button class="text-xs font-semibold" @click="clearAuthError">Stäng</button>
      </div>
    </div>

    <div v-if="ssoBanner" class="mx-auto max-w-6xl px-4">
      <div
        class="mb-4 flex items-center justify-between rounded-lg px-4 py-3 text-sm"
        :class="ssoBanner.variant === 'warning' ? 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200' : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200'"
      >
        <p>{{ ssoBanner.message }}</p>
        <NuxtLink
          v-if="ssoBanner.slug && ssoBanner.variant === 'danger'"
          :to="`/api/auth/sso/${ssoBanner.slug}/init`"
          class="rounded border border-current px-3 py-1 text-xs font-semibold"
        >
          Starta SSO
        </NuxtLink>
      </div>
    </div>

  <div v-if="delegationBanner" class="mx-auto max-w-6xl px-4">
    <div class="mb-4 flex items-start justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
      <p>{{ delegationBanner.message }}</p>
    </div>
  </div>

    <main class="px-4 py-6 lg:px-10 max-w-6xl mx-auto w-full">
      <Breadcrumb v-if="breadcrumbItems.length > 1" :items="breadcrumbItems" class="mb-4" />
      <slot />
    </main>

    <footer class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
      © {{ new Date().getFullYear() }} Cloud Portal. All rights reserved.
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from '#imports'
import TopBar from '~/components/layout/TopBar.vue'
import MainNavbar from '~/components/layout/MainNavbar.vue'
import { useAuth } from '~/composables/useAuth'
import { useBreadcrumbs } from '~/composables/useBreadcrumbs'

const auth = useAuth()
if (import.meta.client) {
  await auth.bootstrap()
}

const authError = computed(() => auth.state.value.error)
const currentOrg = auth.currentOrg
const delegationBanner = computed(() => {
  const org = currentOrg.value
  if (!org || org.accessType !== 'delegation') return null
  const expires = org.expiresAt
  const expiresText = expires ? `Gäller till ${new Date(expires).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}` : 'Ingen sluttid angiven.'
  return {
    message: `Åtkomst via delegation. ${expiresText}`
  }
})

const clearAuthError = () => {
  auth.state.value.error = null
}

const ssoBanner = computed(() => {
  const org = currentOrg.value
  if (!org?.requireSso) {
    return null
  }
  if (org.hasLocalLoginOverride || auth.isSuperAdmin.value) {
    return {
      variant: 'warning' as const,
      message: 'SSO är aktiverat för den här organisationen, men du har ett lokalt ägarundantag.',
      slug: org.slug
    }
  }
  return {
    variant: 'danger' as const,
    message: 'SSO är aktiverat och lokalt login är blockerad. Starta SSO-inloggningen.',
    slug: org.slug
  }
})

const { items: breadcrumbItems } = useBreadcrumbs()
</script>

