<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="flex flex-col gap-2">
        <NuxtLink to="/certificates" class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400">
          <Icon icon="mdi:arrow-left" class="h-4 w-4" />
          {{ $t('certificates.title') }}
        </NuxtLink>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
          {{ $t('certificates.agents.title') }}
        </h1>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px]"
        @click="showRegister = true"
      >
        <Icon icon="mdi:plus" class="h-4 w-4" />
        {{ $t('certificates.agents.register') }}
      </button>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">{{ $t('certificates.common.loading') }}</div>

    <div v-else-if="agents.length === 0" class="mod-certificates-panel text-center py-12">
      <Icon icon="mdi:robot-outline" class="mx-auto h-12 w-12 text-slate-300" />
      <p class="mt-4 text-sm text-slate-500">{{ $t('certificates.common.noData') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="agent in agents"
        :key="agent.id"
        class="mod-certificates-panel flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div class="flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-slate-900 dark:text-slate-50">{{ agent.name }}</h3>
            <CertStatusBadge :status="agent.status" />
            <span
              v-if="isOnline(agent.lastHeartbeatAt)"
              class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {{ $t('certificates.agents.online') }}
            </span>
            <span v-else class="text-xs text-slate-400">{{ $t('certificates.agents.offline') }}</span>
          </div>
          <p v-if="agent.description" class="text-sm text-slate-600 dark:text-slate-400">{{ agent.description }}</p>
          <div class="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span v-if="agent.lastHeartbeatAt">{{ $t('certificates.agents.lastHeartbeat') }}: {{ formatDate(agent.lastHeartbeatAt) }}</span>
            <span v-if="agent.lastSeenIp">· IP: {{ agent.lastSeenIp }}</span>
          </div>
          <div v-if="agent.capabilities?.supports?.length" class="flex flex-wrap gap-1 mt-1">
            <span
              v-for="cap in agent.capabilities.supports"
              :key="cap"
              class="mod-certificates-badge"
            >
              {{ cap }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="`/certificates/agents/${agent.id}/setup`"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
          >
            <Icon icon="mdi:book-open-outline" class="h-3.5 w-3.5" />
            {{ $t('certificates.agents.setup.viewSetup') }}
          </NuxtLink>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-500 hover:text-amber-600 dark:border-slate-700 dark:text-slate-100"
            @click="confirmRegenerate(agent)"
          >
            <Icon icon="mdi:key-change" class="h-3.5 w-3.5" />
            {{ $t('certificates.agents.setup.regenerateToken') }}
          </button>
          <button
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
            @click="editAgent(agent)"
          >
            <Icon icon="mdi:pencil-outline" class="h-3.5 w-3.5" />
            {{ $t('certificates.common.edit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Register agent modal -->
    <CertAgentRegisterForm
      :is-open="showRegister"
      @close="showRegister = false"
      @registered="handleRegistered"
    />

    <!-- Edit agent modal -->
    <CertAgentEditForm
      :is-open="!!editingAgent"
      :agent="editingAgent"
      @close="editingAgent = null"
      @saved="handleSaved"
    />

    <!-- Setup panel modal (shown after registration or token regeneration) -->
    <Teleport to="body">
      <div
        v-if="setupContext"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6 overflow-y-auto"
        @click.self="setupContext = null"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <CertAgentSetupPanel
            :agent-id="setupContext.id"
            :agent-name="setupContext.name"
            :token="setupContext.token"
            :portal-base-url="portalBaseUrl"
          />
          <div class="mt-6 flex justify-end">
            <button
              class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
              @click="setupContext = null"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Regenerate token confirmation dialog -->
    <Teleport to="body">
      <div
        v-if="regeneratingAgent"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
      >
        <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {{ $t('certificates.agents.setup.regenerateToken') }}
          </h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ $t('certificates.agents.setup.regenerateConfirm') }}
          </p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
              :disabled="regenerating"
              @click="regeneratingAgent = null"
            >
              {{ $t('certificates.common.cancel') }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              :disabled="regenerating"
              @click="doRegenerate"
            >
              <Icon v-if="regenerating" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              {{ $t('certificates.common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CertStatusBadge from '../../components/CertStatusBadge.vue'
import CertAgentRegisterForm from '../../components/CertAgentRegisterForm.vue'
import CertAgentEditForm from '../../components/CertAgentEditForm.vue'
import CertAgentSetupPanel from '../../components/CertAgentSetupPanel.vue'

const agents = ref<any[]>([])
const loading = ref(true)
const showRegister = ref(false)
const editingAgent = ref<any>(null)
const setupContext = ref<{ id: string; name: string; token: string | null } | null>(null)
const regeneratingAgent = ref<any>(null)
const regenerating = ref(false)

const portalBaseUrl = computed(() => {
  if (import.meta.client) return window.location.origin
  return ''
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await $fetch<any>('/api/certificates/agents')
    agents.value = res.agents ?? []
  } catch { /* handled by empty state */ }
  finally { loading.value = false }
}

const isOnline = (heartbeat: string | null) => {
  if (!heartbeat) return false
  return Date.now() - new Date(heartbeat).getTime() < 5 * 60 * 1000
}

const formatDate = (d: string | null) => {
  if (!d) return '\u2014'
  return new Date(d).toLocaleString('sv-SE')
}

const editAgent = (agent: any) => { editingAgent.value = agent }

const handleRegistered = (result: { id: string; token: string; name: string }) => {
  showRegister.value = false
  setupContext.value = { id: result.id, name: result.name, token: result.token }
  fetchData()
}

const handleSaved = () => {
  editingAgent.value = null
  fetchData()
}

const confirmRegenerate = (agent: any) => {
  regeneratingAgent.value = agent
}

const doRegenerate = async () => {
  if (!regeneratingAgent.value) return
  regenerating.value = true
  try {
    const res = await $fetch<any>(`/api/certificates/agents/${regeneratingAgent.value.id}/regenerate-token`, {
      method: 'POST'
    })
    const agent = regeneratingAgent.value
    regeneratingAgent.value = null
    setupContext.value = { id: agent.id, name: agent.name, token: res.token }
  } catch {
    // error handling — keep dialog open
  } finally {
    regenerating.value = false
  }
}

onMounted(() => fetchData())
</script>
