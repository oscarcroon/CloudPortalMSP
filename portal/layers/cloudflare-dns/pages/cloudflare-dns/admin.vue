<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <!-- Access denied -->
    <div
      v-if="accessDenied"
      class="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
    >
      <div class="flex items-start gap-3">
        <Icon icon="mdi:shield-lock-outline" class="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div class="space-y-2">
          <p class="font-semibold">{{ t('cloudflareDns.admin.accessDenied') }}</p>
          <p>{{ t('cloudflareDns.admin.accessDeniedDescription') }}</p>
          <NuxtLink
            to="/cloudflare-dns"
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px]"
          >
            <Icon icon="mdi:arrow-left" class="h-4 w-4" />
            {{ t('cloudflareDns.admin.backToZones') }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <template v-else>
    <header class="flex flex-col gap-2">
      <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {{ t('cloudflareDns.admin.label') }}
      </p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
        {{ t('cloudflareDns.admin.title') }}
      </h1>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        {{ t('cloudflareDns.admin.subtitle') }}
      </p>
    </header>

    <!-- Setup guide (collapsible) -->
    <section class="rounded-2xl border border-blue-200 bg-blue-50/60 shadow-sm dark:border-blue-800 dark:bg-blue-950/40">
      <button
        class="flex w-full items-center gap-3 p-4 text-left"
        @click="guideExpanded = !guideExpanded"
      >
        <Icon icon="mdi:information-outline" class="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <span class="flex-1 text-sm font-semibold text-blue-900 dark:text-blue-100">
          {{ t('cloudflareDns.admin.guide.title') }}
        </span>
        <Icon
          :icon="guideExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          class="h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400"
        />
      </button>

      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[500px]"
        leave-from-class="opacity-100 max-h-[500px]"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="guideExpanded" class="overflow-hidden">
          <ol class="list-decimal space-y-1.5 px-4 pb-4 pl-12 text-xs leading-relaxed text-blue-900 dark:text-blue-100">
            <li>
              <i18n-t keypath="cloudflareDns.admin.guide.step1" tag="span">
                <template #link>
                  <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" class="font-medium underline">dash.cloudflare.com</a>
                </template>
              </i18n-t>
            </li>
            <li>
              <i18n-t keypath="cloudflareDns.admin.guide.step2" tag="span">
                <template #manageAccount><strong>Manage Account</strong></template>
                <template #accountApiTokens><strong>Account API Tokens</strong></template>
              </i18n-t>
            </li>
            <li>
              <i18n-t keypath="cloudflareDns.admin.guide.step3" tag="span">
                <template #createToken><strong>Create Token</strong></template>
                <template #createCustomToken><strong>Create Custom Token</strong></template>
              </i18n-t>
            </li>
            <li>{{ t('cloudflareDns.admin.guide.step4') }}</li>
            <li>
              <i18n-t keypath="cloudflareDns.admin.guide.step5" tag="span">
                <template #zoneRead><code class="rounded bg-blue-100 px-1 py-0.5 text-[11px] dark:bg-blue-900">Zone – Zone – Read</code></template>
                <template #dnsEdit><code class="rounded bg-blue-100 px-1 py-0.5 text-[11px] dark:bg-blue-900">Zone – DNS – Edit</code></template>
              </i18n-t>
            </li>
            <li>
              <i18n-t keypath="cloudflareDns.admin.guide.step6" tag="span">
                <template #includeAll><strong>Include – All zones</strong></template>
              </i18n-t>
            </li>
            <li>
              <i18n-t keypath="cloudflareDns.admin.guide.step7" tag="span">
                <template #continue><strong>Continue to summary</strong></template>
                <template #create><strong>Create Token</strong></template>
              </i18n-t>
            </li>
            <li>{{ t('cloudflareDns.admin.guide.step8') }}</li>
          </ol>

          <div class="px-4 pb-4">
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
            >
              <Icon icon="mdi:open-in-new" class="h-3.5 w-3.5" />
              {{ t('cloudflareDns.admin.guide.dashboardLink') }}
            </a>
          </div>
        </div>
      </Transition>
    </section>

    <CloudflareStatusCard :summary="statusSummary" />

    <section class="mod-cloudflare-dns-panel space-y-4">
      <header class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('cloudflareDns.admin.token.label') }}
          </p>
          <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {{ t('cloudflareDns.admin.token.title') }}
          </h2>
        </div>
        <span class="text-xs text-slate-500 dark:text-slate-400">
          {{ t('cloudflareDns.admin.token.helper') }}
        </span>
      </header>

      <form class="space-y-3" autocomplete="off" @submit.prevent="saveConfig">
        <div class="grid gap-3 md:grid-cols-2">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              {{ t('cloudflareDns.admin.form.apiToken') }}
            </label>
            <input
              v-model="form.apiToken"
              class="input"
              type="password"
              name="cf-api-token"
              autocomplete="new-password"
              :placeholder="t('cloudflareDns.admin.form.apiTokenPlaceholder')"
              required
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('cloudflareDns.admin.form.lastSaved', { value: config?.config?.tokenMasked || t('cloudflareDns.admin.form.none') }) }}
            </p>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
              {{ t('cloudflareDns.admin.form.accountId') }}
            </label>
            <input
              v-model="form.accountId"
              class="input"
              type="text"
              name="cf-account-id"
              autocomplete="off"
              :placeholder="t('cloudflareDns.admin.form.accountIdPlaceholder')"
            />
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('cloudflareDns.admin.form.accountIdHelper') }}
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
            {{ t('cloudflareDns.admin.actions.saveVerify') }}
          </button>
          <button
            type="button"
            :disabled="testing"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:text-slate-100"
            @click="testConnection"
          >
            <Icon icon="mdi:check-decagram-outline" class="h-4 w-4" />
            {{ t('cloudflareDns.admin.actions.test') }}
          </button>
          <button
            v-if="config?.config?.tokenMasked"
            type="button"
            :disabled="deleting"
            class="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400/60 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            @click="deleteToken"
          >
            <Icon icon="mdi:delete-outline" class="h-4 w-4" />
            {{ t('cloudflareDns.admin.actions.delete') }}
          </button>
        </div>
        <p v-if="message" class="text-sm text-green-600">{{ message }}</p>
        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      </form>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CloudflareStatusCard from '@cloudflare-dns/components/CloudflareStatusCard.vue'
import { useI18n } from '#imports'

const accessDenied = ref(false)

const { data: config, refresh: refreshConfig } = useAsyncData('cloudflare-config', async () => {
  try {
    return await $fetch('/api/dns/cloudflare/config')
  } catch (err: any) {
    if (err?.statusCode === 403 || err?.status === 403) {
      accessDenied.value = true
    }
    throw err
  }
})
const { data: status, refresh: refreshStatus } = useAsyncData('cloudflare-status', () =>
  $fetch('/api/dns/cloudflare/status/summary')
)

const { t } = useI18n()

const form = reactive({
  apiToken: '',
  accountId: ''
})
const guideExpanded = ref(false)
const saving = ref(false)
const testing = ref(false)
const deleting = ref(false)
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
    message.value = t('cloudflareDns.admin.messages.saved')
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? t('cloudflareDns.admin.messages.saveError')
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
    message.value = t('cloudflareDns.admin.messages.testOk')
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? t('cloudflareDns.admin.messages.testError')
  } finally {
    testing.value = false
  }
}

const deleteToken = async () => {
  if (!confirm(t('cloudflareDns.admin.messages.deleteConfirm'))) {
    return
  }

  message.value = ''
  errorMessage.value = ''
  deleting.value = true
  try {
    await $fetch('/api/dns/cloudflare/config', { method: 'DELETE' })
    form.apiToken = ''
    form.accountId = ''
    await Promise.all([refreshConfig(), refreshStatus()])
    message.value = t('cloudflareDns.admin.messages.deleted')
  } catch (error: any) {
    errorMessage.value = error?.data?.message ?? t('cloudflareDns.admin.messages.deleteError')
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.input {
  @apply rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50;
}
</style>


