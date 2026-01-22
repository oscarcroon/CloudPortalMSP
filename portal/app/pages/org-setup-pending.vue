<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
    <div class="w-full max-w-md text-center">
      <div class="rounded-2xl bg-white p-8 shadow-lg dark:bg-slate-800">
        <Icon icon="mdi:clock-outline" class="mx-auto h-16 w-16 text-amber-500" />
        
        <h1 class="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
          {{ t('orgSetup.pending.title') }}
        </h1>
        
        <p class="mt-4 text-slate-600 dark:text-slate-400">
          {{ t('orgSetup.pending.description', { orgName: currentOrg?.name ?? '' }) }}
        </p>
        
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-500">
          {{ t('orgSetup.pending.contact') }}
        </p>

        <div class="mt-8 flex flex-col gap-3">
          <button
            type="button"
            class="w-full rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
            @click="refresh"
          >
            <Icon icon="mdi:refresh" class="mr-2 inline h-4 w-4" />
            {{ t('orgSetup.pending.checkAgain') }}
          </button>
          
          <button
            v-if="hasOtherOrganizations"
            type="button"
            class="w-full rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand dark:border-white/10 dark:text-white"
            @click="switchOrg"
          >
            {{ t('orgSetup.pending.switchOrg') }}
          </button>
          
          <button
            type="button"
            class="w-full rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand dark:border-white/10 dark:text-white"
            @click="logout"
          >
            {{ t('orgSetup.pending.logout') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useI18n, useRouter, navigateTo } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: false,
  middleware: ['auth']
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuth()

const currentOrg = computed(() => auth.currentOrg.value)
const hasOtherOrganizations = computed(() => {
  const orgs = auth.organizations.value ?? []
  return orgs.filter(o => o.setupStatus !== 'pending').length > 0
})

async function refresh() {
  await auth.fetchMe()
  
  // Check if setup is now complete
  const org = auth.currentOrg.value
  if (org?.setupStatus === 'complete') {
    await navigateTo('/', { replace: true })
  }
}

async function switchOrg() {
  // Find first org that is not pending
  const orgs = auth.organizations.value ?? []
  const availableOrg = orgs.find(o => o.setupStatus !== 'pending')
  
  if (availableOrg) {
    await auth.switchOrganization(availableOrg.id)
    await navigateTo('/', { replace: true })
  }
}

async function logout() {
  await auth.logout()
  await navigateTo('/login', { replace: true })
}
</script>
