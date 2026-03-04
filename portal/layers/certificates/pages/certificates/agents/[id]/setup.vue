<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <NuxtLink to="/certificates/agents" class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400">
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ $t('certificates.agents.title') }}
      </NuxtLink>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">{{ $t('certificates.common.loading') }}</div>

    <div v-else-if="error" class="mod-certificates-panel text-center py-12">
      <Icon icon="mdi:alert-circle-outline" class="mx-auto h-12 w-12 text-red-300" />
      <p class="mt-4 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <CertAgentSetupPanel
      v-else-if="agent"
      :agent-id="agent.id"
      :agent-name="agent.name"
      :token="null"
      :portal-base-url="portalBaseUrl"
      :inline="true"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CertAgentSetupPanel from '../../../../components/CertAgentSetupPanel.vue'

const route = useRoute()
const agentId = route.params.id as string

const agent = ref<any>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const portalBaseUrl = computed(() => {
  if (import.meta.client) return window.location.origin
  return ''
})

onMounted(async () => {
  try {
    const res = await $fetch<any>(`/api/certificates/agents/${agentId}`)
    agent.value = res.agent
  } catch (err: any) {
    error.value = err?.data?.message ?? 'Failed to load agent'
  } finally {
    loading.value = false
  }
})
</script>
