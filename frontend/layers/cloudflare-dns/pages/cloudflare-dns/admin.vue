<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Cloudflare DNS</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">Organisationens konfiguration</h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Lägg in API-token per organisation och verifiera anslutningen. Token visas inte efter sparad lagring.
      </p>
    </header>

    <CloudflareStatusCard :summary="statusSummary" />

    <section class="mod-cloudflare-dns-panel space-y-4">
      <header class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">API-token</p>
          <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">Cloudflare credentials</h2>
        </div>
        <span class="text-xs text-slate-500 dark:text-slate-400">
          Token lagras krypterat. Vi visar aldrig hela token.
        </span>
      </header>

      <form class="space-y-3" @submit.prevent="saveConfig">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">API token</label>
            <input
              v-model="form.apiToken"
              class="input"
              type="password"
              name="apiToken"
              autocomplete="off"
              placeholder="Cloudflare API token"
              required
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Senast sparad: {{ config?.config?.tokenMasked || 'ingen' }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Account ID (valfritt)</label>
            <input
              v-model="form.accountId"
              class="input"
              type="text"
              name="accountId"
              placeholder="Account ID"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Används vid skapande av zoner. Lämna tomt om token redan är scoperad.
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            :disabled="saving"
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:opacity-60"
          >
            <Icon icon="mdi:content-save-outline" class="h-4 w-4" />
            Spara och verifiera
          </button>
          <button
            type="button"
            :disabled="testing"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
            @click="testConnection"
          >
            <Icon icon="mdi:check-decagram-outline" class="h-4 w-4" />
            Testa anslutning
          </button>
        </div>
        <p v-if="message" class="text-sm text-green-600">{{ message }}</p>
        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CloudflareStatusCard from '@cloudflare-dns/components/CloudflareStatusCard.vue'

const { data: config, refresh: refreshConfig } = useAsyncData('cloudflare-config', () =>
  $fetch('/api/dns/cloudflare/config')
)
const { data: status, refresh: refreshStatus } = useAsyncData('cloudflare-status', () =>
  $fetch('/api/dns/cloudflare/status/summary')
)

const form = reactive({
  apiToken: '',
  accountId: ''
})
const saving = ref(false)
const testing = ref(false)
const message = ref('')
const errorMessage = ref('')

const statusSummary = computed(() => ({
  zones: status.value?.zones ?? 0,
  lastSyncAt: status.value?.lastSyncAt ?? null,
  lastSyncStatus: status.value?.lastSyncStatus ?? null,
  lastSyncError: status.value?.lastSyncError ?? null,
  lastValidatedAt: status.value?.lastValidatedAt ?? null
}))

const saveConfig = async () => {
  message.value = ''
  errorMessage.value = ''
  saving.value = true
  try {
    await $fetch('/api/dns/cloudflare/config', {
      method: 'PUT',
      body: {
        apiToken: form.apiToken,
        accountId: form.accountId || null
      }
    })
    form.apiToken = ''
    await Promise.all([refreshConfig(), refreshStatus()])
    message.value = 'Token sparad och verifierad.'
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? 'Kunde inte spara token.'
  } finally {
    saving.value = false
  }
}

const testConnection = async () => {
  message.value = ''
  errorMessage.value = ''
  testing.value = true
  try {
    await $fetch('/api/dns/cloudflare/test-connection', { method: 'POST' })
    await refreshStatus()
    message.value = 'Anslutningen verifierades.'
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? 'Test misslyckades.'
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.input {
  @apply rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50;
}
</style>


