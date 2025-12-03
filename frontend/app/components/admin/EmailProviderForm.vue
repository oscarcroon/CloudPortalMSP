<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <header class="mb-4">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{
            mode === 'global'
              ? 'Global avsändare'
              : mode === 'provider'
                ? 'E-postinställning för leverantör'
                : mode === 'distributor'
                  ? 'E-postinställning för distributör'
                  : 'E-postinställning för organisationen'
          }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Ange avsändaradress, svarsmail och leverantör som ska gälla för utskick.
        </p>
      </header>
      <div v-if="mode === 'organization'" class="mb-4 flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
        <input id="use-override" v-model="useOverride" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
        <label for="use-override" class="text-sm text-slate-700 dark:text-slate-200">
          Använd organisationsspecifik e-postprovider (annars ärvs inställningar från leverantör → distributör → global)
        </label>
      </div>
      <div class="grid gap-4 md:grid-cols-2" :class="{ 'opacity-60 pointer-events-none': !isEditable }">
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Avsändarnamn</label>
          <input
            v-model="form.fromName"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="Cloud Portal"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Avsändaradress</label>
          <input
            v-model="form.fromEmail"
            type="email"
            required
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="no-reply@example.com"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ämnesprefix (valfritt)</label>
          <input
            v-model="form.subjectPrefix"
            type="text"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="[Cloud Portal]"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Supportkontakt (valfritt)</label>
          <input
            v-model="form.supportContact"
            type="text"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="support@example.com"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Svar-adress</label>
          <input
            v-model="form.replyToEmail"
            type="email"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="support@example.com"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktiv</label>
          <div class="mt-1 flex items-center gap-3">
            <button
              type="button"
              :disabled="!isEditable"
              :class="[
                'relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
                form.isActive
                  ? 'bg-brand'
                  : 'bg-slate-300 dark:bg-slate-600'
              ]"
              @click="form.isActive = !form.isActive"
            >
              <span
                :class="[
                  'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
                  form.isActive ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ form.isActive ? 'Utskick aktiverat' : 'Utskick inaktiverat' }}
            </span>
          </div>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-posttema</label>
          <div class="mt-1 flex items-center gap-3">
            <input
              id="email-dark-mode"
              v-model="form.emailDarkMode"
              type="checkbox"
              :disabled="!isEditable"
              class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20 disabled:opacity-50"
            />
            <label for="email-dark-mode" class="text-sm font-medium text-slate-700 dark:text-slate-200">
              Mörkt läge (standard är ljust läge)
            </label>
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            I mörkt läge används mörka färger för e-postinnehållet och bakgrunden. Bakgrunden bakom loggan använder NavBar-färgen från brandingen.
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <header class="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Leverantör</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400">Välj SMTP eller Microsoft Graph och fyll i nödvändiga värden.</p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border px-4 py-1 text-sm font-semibold text-slate-600 transition dark:text-slate-200"
            :class="form.providerType === 'smtp' ? activeTabClass : inactiveTabClass"
            @click="switchProvider('smtp')"
          >
            <Icon icon="mdi:email-send" class="h-4 w-4" />
            SMTP
          </button>
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border px-4 py-1 text-sm font-semibold text-slate-600 transition dark:text-slate-200"
            :class="form.providerType === 'graph' ? activeTabClass : inactiveTabClass"
            @click="switchProvider('graph')"
          >
            <Icon icon="mdi:microsoft" class="h-4 w-4" />
            Microsoft Graph
          </button>
        </div>
      </header>

      <div v-if="form.providerType === 'smtp'" class="grid gap-4 md:grid-cols-2" :class="{ 'opacity-60 pointer-events-none': !isEditable }">
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">SMTP-host</label>
          <input
            v-model="form.smtp.host"
            type="text"
            required
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="smtp.example.com"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Port</label>
          <input
            v-model.number="form.smtp.port"
            type="number"
            min="1"
            required
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
          <input id="smtp-secure" v-model="form.smtp.secure" type="checkbox" :disabled="!isEditable" class="rounded border-slate-300 dark:border-white/20" />
          <label for="smtp-secure" class="text-sm text-slate-700 dark:text-slate-200">Anslutning med TLS/SSL</label>
        </div>
        <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
          <input id="smtp-ignore-tls" v-model="form.smtp.ignoreTls" type="checkbox" :disabled="!isEditable" class="rounded border-slate-300 dark:border-white/20" />
          <label for="smtp-ignore-tls" class="text-sm text-slate-700 dark:text-slate-200">Tillåt osignerade certifikat</label>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Användarnamn</label>
          <input
            v-model="form.smtp.authUser"
            type="text"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Lösenord</label>
          <input
            v-model="form.smtp.authPass"
            type="password"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            :placeholder="form.smtp.hasStoredSecret ? 'Lämna tomt för att behålla' : ''"
          />
        </div>
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2" :class="{ 'opacity-60 pointer-events-none': !isEditable }">
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant ID</label>
          <input
            v-model="form.graph.tenantId"
            type="text"
            required
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Client ID</label>
          <input
            v-model="form.graph.clientId"
            type="text"
            required
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Client Secret</label>
          <input
            v-model="form.graph.clientSecret"
            type="password"
            :disabled="!isEditable"
            :placeholder="form.graph.hasStoredSecret ? 'Lämna tomt för att behålla' : ''"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Avsändar-ID (valfritt)</label>
          <input
            v-model="form.graph.senderUserId"
            type="text"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="user@domain.com"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Scope (valfritt)</label>
          <input
            v-model="form.graph.scope"
            type="text"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="https://graph.microsoft.com/.default"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Endpoint (valfritt)</label>
          <input
            v-model="form.graph.endpoint"
            type="text"
            :disabled="!isEditable"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="https://graph.microsoft.com/v1.0"
          />
        </div>
      </div>
    </section>

    <section
      v-if="props.mode === 'organization'"
      class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5"
    >
      <header class="mb-4 space-y-1">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Egen disclaimer</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Texten läggs längst ner i alla utskick (även om e-post provider ärvs). Markdown stöds för länkar, listor och betoning.
        </p>
      </header>
      <div class="grid gap-6 lg:grid-cols-2">
        <div>
          <textarea
            v-model="form.disclaimerMarkdown"
            rows="8"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            placeholder="Exempel: Detta meddelande är konfidentiellt..."
          />
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Lämna tomt för att använda kedjans standardtext.</p>
        </div>
        <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm dark:border-white/10 dark:bg-white/5">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Förhandsvisning</p>
          <div
            v-if="disclaimerPreview.html"
            class="prose prose-sm mt-3 max-w-none text-slate-700 dark:prose-invert dark:text-slate-200"
            v-html="disclaimerPreview.html"
          />
          <p v-else class="mt-3 text-slate-400 dark:text-slate-500">Ingen text angiven ännu.</p>
        </div>
      </div>
    </section>

    <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex-1">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Status & Test</p>
          <div class="mt-2 space-y-1">
            <p v-if="summary?.lastTestedAt" class="text-sm text-slate-500 dark:text-slate-400">
              Senaste test: {{ formatTimestamp(summary.lastTestedAt) }} •
              <span :class="summary.lastTestStatus === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-500'">
                {{ summary.lastTestStatus === 'success' ? 'Lyckades' : 'Misslyckades' }}
              </span>
            </p>
            <p v-else class="text-sm text-slate-500 dark:text-slate-400">Inga tester körda ännu.</p>
            <p v-if="summary?.lastTestError" class="text-xs text-red-500 dark:text-red-300">
              {{ summary.lastTestError }}
            </p>
            <p v-if="form.providerType === 'graph' && summary?.lastTestStatus === 'success'" class="text-xs text-emerald-600 dark:text-emerald-300">
              ✓ OAuth-token verifierad
            </p>
            <p v-if="form.providerType === 'graph' && summary?.lastTestedAt" class="text-xs text-slate-500 dark:text-slate-400">
              Senast beviljad: {{ formatTimestamp(summary.lastTestedAt) }}
            </p>
          </div>
        </div>
        <div class="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            v-model="form.testEmail"
            type="email"
            :disabled="!isEditable"
            placeholder="Testmottagare"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
          <button
            type="button"
            class="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
            :disabled="!isEditable || testing"
            @click="handleTest"
          >
            <Icon icon="mdi:email-send" class="h-4 w-4" />
            {{ testing ? 'Skickar...' : 'Skicka test' }}
          </button>
          <button
            v-if="form.providerType === 'graph'"
            type="button"
            class="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
            :disabled="!isEditable"
            @click="handleReconnect"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" />
            Återanslut Microsoft 365
          </button>
        </div>
      </div>
      <div
        v-if="props.testMessage"
        class="mt-4 rounded-lg px-4 py-3 text-sm"
        :class="variantClass(props.testVariant)"
      >
        {{ props.testMessage }}
      </div>
    </section>

    <div
      v-if="props.statusMessage"
      class="rounded-lg px-4 py-3 text-sm"
      :class="variantClass(props.statusVariant)"
    >
      {{ props.statusMessage }}
    </div>

    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
      <div class="flex flex-wrap gap-2">
        <button
          v-if="props.mode === 'global' || props.mode === 'organization' || props.mode === 'provider' || props.mode === 'distributor'"
          type="button"
          class="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="showPreview('invitation')"
        >
          <Icon icon="mdi:email-open" class="h-4 w-4" />
          Förhandsgranska inbjudningsmail
        </button>
        <button
          v-if="props.mode === 'global' || props.mode === 'organization' || props.mode === 'provider' || props.mode === 'distributor'"
          type="button"
          class="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="showPreview('password-reset')"
        >
          <Icon icon="mdi:lock-reset" class="h-4 w-4" />
          Förhandsgranska återställningsmail
        </button>
      </div>
      <button
        type="submit"
        class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
        :disabled="!isEditable || saving"
      >
        {{ saving ? 'Sparar...' : 'Spara inställningar' }}
      </button>
    </div>

    <EmailPreviewModal
      :is-open="previewModalOpen"
      :title="previewType === 'invitation' ? 'Förhandsgranska inbjudningsmail' : 'Förhandsgranska återställningsmail'"
      :type="previewType"
      :organization-id="previewOrganizationId"
      :tenant-id="previewTenantId"
      :disclaimer-markdown="props.mode === 'organization' ? form.disclaimerMarkdown : null"
      :is-dark-mode="form.emailDarkMode"
      @close="previewModalOpen = false"
    />
  </form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { renderMarkdown } from '~~/shared/markdown'
import EmailPreviewModal from '~/components/email/EmailPreviewModal.vue'
import type {
  AdminEmailProviderPayload,
  AdminEmailProviderSummary,
  AdminEmailProviderTestPayload
} from '~/types/admin'

const props = defineProps<{
  summary: AdminEmailProviderSummary | null
  mode: 'global' | 'provider' | 'distributor' | 'organization'
  saving?: boolean
  testing?: boolean
  statusMessage?: string
  statusVariant?: 'success' | 'error' | ''
  testMessage?: string
  testVariant?: 'success' | 'error'
  organizationId?: string | null
  tenantId?: string | null
}>()

const emit = defineEmits<{
  (e: 'submit', payload: AdminEmailProviderPayload): void
  (e: 'test', payload: AdminEmailProviderTestPayload): void
}>()

const activeTabClass =
  'border-brand bg-brand/10 text-brand dark:border-brand/80 dark:bg-brand/10 dark:text-brand/80'
const inactiveTabClass =
  'border-slate-200 text-slate-600 hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-300'

const useOverride = ref(true)

const form = reactive({
  fromName: '',
  fromEmail: '',
  replyToEmail: '',
  providerType: 'smtp' as 'smtp' | 'graph',
  isActive: false,
  subjectPrefix: '',
  supportContact: '',
  emailDarkMode: false,
  disclaimerMarkdown: '',
  smtp: {
    host: '',
    port: 587,
    secure: true,
    ignoreTls: false,
    authUser: '',
    authPass: '',
    hasStoredSecret: false
  },
  graph: {
    tenantId: '',
    clientId: '',
    clientSecret: '',
    scope: '',
    endpoint: '',
    senderUserId: '',
    hasStoredSecret: false
  },
  testEmail: ''
})

const isEditable = computed(() => {
  if (props.mode === 'organization') {
    return useOverride.value
  }
  // Global, provider, and distributor are always editable
  return true
})

const switchProvider = (type: 'smtp' | 'graph') => {
  if (!isEditable.value) return
  form.providerType = type
}

const variantClass = (variant?: 'success' | 'error' | '') => {
  if (variant === 'error') {
    return 'border border-red-200 bg-red-500/10 text-red-600 dark:border-red-500/50 dark:text-red-300'
  }
  if (variant === 'success') {
    return 'border border-emerald-200 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/40 dark:text-emerald-300'
  }
  return 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:text-slate-200'
}

const applySummary = (summary: AdminEmailProviderSummary | null) => {
  form.fromName = summary?.fromName ?? ''
  form.fromEmail = summary?.fromEmail ?? ''
  form.replyToEmail = summary?.replyToEmail ?? ''
  form.subjectPrefix = summary?.subjectPrefix ?? ''
  form.supportContact = summary?.supportContact ?? ''
  form.emailDarkMode = summary?.emailDarkMode ?? false
  form.disclaimerMarkdown = summary?.disclaimerMarkdown ?? ''
  form.providerType = summary?.settings?.type ?? summary?.providerType ?? 'smtp'
  form.isActive = summary?.isActive ?? false
  form.smtp.host = summary?.settings?.type === 'smtp' ? summary.settings.host : ''
  form.smtp.port = summary?.settings?.type === 'smtp' ? summary.settings.port : 587
  form.smtp.secure =
    summary?.settings?.type === 'smtp' ? summary.settings.secure : form.smtp.secure
  form.smtp.ignoreTls =
    summary?.settings?.type === 'smtp' ? Boolean(summary.settings.ignoreTls) : false
  form.smtp.authUser =
    summary?.settings?.type === 'smtp' ? summary.settings.authUser ?? '' : ''
  form.smtp.authPass = ''
  form.smtp.hasStoredSecret = Boolean(summary?.settings?.type === 'smtp' && summary.settings.authUser)

  form.graph.tenantId = summary?.settings?.type === 'graph' ? summary.settings.tenantId : ''
  form.graph.clientId = summary?.settings?.type === 'graph' ? summary.settings.clientId : ''
  form.graph.senderUserId =
    summary?.settings?.type === 'graph' ? summary.settings.senderUserId ?? '' : ''
  form.graph.scope = summary?.settings?.type === 'graph' ? summary.settings.scope ?? '' : ''
  form.graph.endpoint =
    summary?.settings?.type === 'graph' ? summary.settings.endpoint ?? '' : ''
  form.graph.clientSecret = ''
  form.graph.hasStoredSecret = summary?.settings?.type === 'graph' ? true : false

  if (props.mode === 'organization') {
    useOverride.value = summary?.isActive ?? false
  } else {
    // Global, provider, and distributor: useOverride is always true (they can always configure)
    // But isActive should reflect the actual saved value
    useOverride.value = true
    // Don't override form.isActive here - it's already set from summary above
  }
}

watch(
  () => props.summary,
  (value) => {
    applySummary(value ?? null)
  },
  { immediate: true }
)

watch(
  () => useOverride.value,
  (value) => {
    if (props.mode === 'organization') {
      form.isActive = value ? (props.summary?.isActive ?? true) : false
    }
    // For global, provider, and distributor, don't automatically change isActive
    // It's already set correctly from applySummary, and the user can control it via the toggle
  }
)

const formatTimestamp = (value: string | number) => {
  const date = typeof value === 'string' ? new Date(value) : new Date(value)
  return date.toLocaleString('sv-SE')
}

const normalize = (value: string) => value.trim()

const buildPayload = (): AdminEmailProviderPayload => {
  const baseFields: Partial<AdminEmailProviderPayload> = {
    fromEmail: normalize(form.fromEmail),
    fromName: form.fromName.trim() || undefined,
    replyToEmail: form.replyToEmail.trim() || undefined,
    subjectPrefix: form.subjectPrefix,
    supportContact: form.supportContact,
    emailDarkMode: form.emailDarkMode,
    isActive: form.isActive
  }

  if (props.mode === 'organization') {
    baseFields.disclaimerMarkdown = form.disclaimerMarkdown
  }

  if (form.providerType === 'smtp') {
    const userInput = form.smtp.authUser.trim()
    const passInput = form.smtp.authPass
    let auth: { user?: string; pass?: string } | null | undefined = undefined
    if (userInput || passInput) {
      auth = {
        user: userInput || undefined,
        pass: passInput || undefined
      }
    } else if (!form.smtp.hasStoredSecret) {
      auth = null
    } else {
      auth = undefined
    }
    return {
      ...(baseFields as AdminEmailProviderPayload),
      provider: {
        type: 'smtp',
        host: form.smtp.host.trim(),
        port: Number(form.smtp.port),
        secure: form.smtp.secure,
        ignoreTls: form.smtp.ignoreTls,
        auth
      }
    }
  }

  return {
    ...(baseFields as AdminEmailProviderPayload),
    provider: {
      type: 'graph',
      tenantId: form.graph.tenantId.trim(),
      clientId: form.graph.clientId.trim(),
      clientSecret: form.graph.clientSecret ? form.graph.clientSecret : undefined,
      scope: form.graph.scope || undefined,
      endpoint: form.graph.endpoint || undefined,
      senderUserId: form.graph.senderUserId || undefined
    }
  }
}

const handleSubmit = () => {
  if (!isEditable.value) return
  const payload = buildPayload()
  emit('submit', payload)
}

const handleTest = () => {
  if (!isEditable.value || !form.testEmail) return
  const payload = buildPayload()
  const testPayload: AdminEmailProviderTestPayload = {
    ...payload,
    testEmail: form.testEmail
  }
  emit('test', testPayload)
}

const disclaimerPreview = computed(() => renderMarkdown(form.disclaimerMarkdown))

// Preview modal
const previewModalOpen = ref(false)
const previewType = ref<'invitation' | 'password-reset'>('invitation')
const previewOrganizationId = ref<string | null>(null)
const previewTenantId = ref<string | null>(null)

const showPreview = (type: 'invitation' | 'password-reset') => {
  previewType.value = type
  // Get organization/tenant ID from props if available
  // Prefer explicit props over summary values
  if (props.mode === 'organization') {
    previewOrganizationId.value = props.organizationId ?? props.summary?.organisationId ?? null
    previewTenantId.value = null
  } else if (props.mode === 'global') {
    previewOrganizationId.value = null
    previewTenantId.value = null
  } else if (props.mode === 'provider' || props.mode === 'distributor') {
    // For provider/distributor, use tenantId
    previewOrganizationId.value = null
    previewTenantId.value = props.tenantId ?? props.summary?.tenantId ?? null
  } else {
    previewOrganizationId.value = null
    previewTenantId.value = null
  }
  previewModalOpen.value = true
}

const handleReconnect = async () => {
  // Trigger a test to re-authenticate
  if (!form.testEmail) {
    alert('Ange en testmottagare för att återansluta.')
    return
  }
  await handleTest()
}
</script>

