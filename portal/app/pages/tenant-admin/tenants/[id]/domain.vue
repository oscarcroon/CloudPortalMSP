<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        :to="`/tenant-admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('adminTenants.domain.backToTenant') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
          {{ tenantTypeLabel }}
        </p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ t('adminTenants.domain.title') }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.domain.description', { name: tenantName }) }}
        </p>
      </div>
    </header>

    <div class="space-y-6">
      <!-- Current Domain Status -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#0c1524]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:web" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {{ t('adminTenants.domain.currentDomain.title') }}
              </h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.domain.currentDomain.description') }}
            </p>
            <p v-if="suggestedLoginDomain" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.domain.currentDomain.default') }}
              <code class="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-100">https://{{ suggestedLoginDomain }}</code>
            </p>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="mt-6 flex items-center justify-center py-8">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        </div>

        <div v-else class="mt-6 space-y-6">
          <!-- Domain Status Display -->
          <div v-if="domainData?.customDomain" class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div class="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.domain.currentDomain.label') }}
                </p>
                <p class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {{ domainData.customDomain }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                    statusClasses
                  ]"
                >
                  <span class="h-2 w-2 rounded-full" :class="statusDotClass" />
                  {{ statusLabel }}
                </span>
              </div>
            </div>
            
            <!-- Verification info when verified -->
            <div v-if="domainData.customDomainVerificationStatus === 'verified'" class="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
              <Icon icon="mdi:check-circle" class="inline-block h-4 w-4" />
              {{ t('adminTenants.domain.verification.verifiedAt', { date: formatDate(domainData.customDomainVerifiedAt) }) }}
            </div>
          </div>

          <div v-else class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-white/5">
            <Icon icon="mdi:web-off" class="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p class="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
              {{ t('adminTenants.domain.currentDomain.noDomain') }}
            </p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.domain.currentDomain.noDomainHint') }}
            </p>
          </div>

          <!-- Domain Input Form -->
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                {{ t('adminTenants.domain.form.domainLabel') }}
              </label>
              <div class="flex gap-3">
                <input
                  v-model="form.customDomain"
                  type="text"
                  :placeholder="t('adminTenants.domain.form.domainPlaceholder')"
                  class="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
                <button
                  class="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="saving || !form.customDomain"
                  @click="saveDomain"
                >
                  <Icon v-if="saving" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                  {{ saving ? t('adminTenants.domain.form.saving') : t('adminTenants.domain.form.save') }}
                </button>
              </div>
              <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.domain.form.hint') }}
              </p>
            </div>

            <div v-if="domainData?.customDomain" class="flex gap-3">
              <button
                class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                :disabled="verifying || domainData.customDomainVerificationStatus === 'verified'"
                @click="verifyDomain"
              >
                <Icon v-if="verifying" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                <Icon v-else icon="mdi:check-decagram" class="h-4 w-4" />
                {{ verifying ? t('adminTenants.domain.verification.checking') : t('adminTenants.domain.verification.verify') }}
              </button>
              <button
                class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                :disabled="saving"
                @click="removeDomain"
              >
                <Icon icon="mdi:delete-outline" class="h-4 w-4" />
                {{ t('adminTenants.domain.form.remove') }}
              </button>
            </div>
          </div>

          <!-- Status Messages -->
          <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
            {{ errorMessage }}
          </div>

          <div v-if="successMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200">
            {{ successMessage }}
          </div>
        </div>
      </div>

      <!-- CNAME Instructions (always visible when custom domain is set) -->
      <div 
        v-if="domainData?.customDomain && domainData.cnameTarget" 
        :class="[
          'rounded-2xl border p-6 shadow-card',
          domainData.customDomainVerificationStatus === 'verified'
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
            : 'border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10'
        ]"
      >
        <div class="flex items-center gap-3">
          <div 
            :class="[
              'flex h-8 w-8 items-center justify-center rounded-full text-white',
              domainData.customDomainVerificationStatus === 'verified' ? 'bg-emerald-500' : 'bg-blue-500'
            ]"
          >
            <Icon v-if="domainData.customDomainVerificationStatus === 'verified'" icon="mdi:check" class="h-5 w-5" />
            <span v-else class="text-sm font-bold">1</span>
          </div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ domainData.customDomainVerificationStatus === 'verified' 
              ? t('adminTenants.domain.cname.titleVerified') 
              : t('adminTenants.domain.cname.title') }}
          </h2>
        </div>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {{ domainData.customDomainVerificationStatus === 'verified'
            ? t('adminTenants.domain.cname.descriptionVerified')
            : t('adminTenants.domain.cname.description') }}
        </p>

        <div 
          :class="[
            'mt-4 rounded-xl border bg-white p-4 dark:bg-white/5',
            domainData.customDomainVerificationStatus === 'verified'
              ? 'border-emerald-200 dark:border-emerald-500/20'
              : 'border-blue-200 dark:border-blue-500/20'
          ]"
        >
          <div class="space-y-3">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.domain.cname.recordType') }}
              </p>
              <p class="font-mono text-sm text-slate-900 dark:text-slate-100">CNAME</p>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.domain.cname.recordName') }}
              </p>
              <div class="flex items-center gap-2">
                <code class="flex-1 rounded bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 dark:bg-white/10 dark:text-slate-100">
                  {{ domainData.customDomain }}
                </code>
                <button
                  class="rounded p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                  @click="copyToClipboard(domainData.customDomain!)"
                >
                  <Icon icon="mdi:content-copy" class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.domain.cname.target') }}
              </p>
              <div class="flex items-center gap-2">
                <code class="flex-1 rounded bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 dark:bg-white/10 dark:text-slate-100">
                  {{ domainData.cnameTarget }}
                </code>
                <button
                  class="rounded p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                  @click="copyToClipboard(domainData.cnameTarget!)"
                >
                  <Icon icon="mdi:content-copy" class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <p 
          :class="[
            'mt-3 text-xs',
            domainData.customDomainVerificationStatus === 'verified'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-blue-700 dark:text-blue-300'
          ]"
        >
          {{ t('adminTenants.domain.cname.example', { domain: domainData.customDomain, target: domainData.cnameTarget }) }}
        </p>
      </div>

      <!-- Verification Instructions (Step 2) -->
      <div v-if="domainData?.customDomain && domainData.customDomainVerificationStatus !== 'verified' && verificationInstructions" class="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-card dark:border-amber-500/30 dark:bg-amber-500/10">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
            <span class="text-sm font-bold">2</span>
          </div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ t('adminTenants.domain.verification.title') }}
          </h2>
        </div>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {{ t('adminTenants.domain.verification.instructions') }}
        </p>

        <div class="mt-4 space-y-4">
          <div class="rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-500/20 dark:bg-white/5">
            <div class="space-y-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.domain.verification.recordType') }}
                </p>
                <p class="font-mono text-sm text-slate-900 dark:text-slate-100">{{ verificationInstructions.recordType }}</p>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.domain.verification.recordName') }}
                </p>
                <div class="flex items-center gap-2">
                  <code class="flex-1 rounded bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 dark:bg-white/10 dark:text-slate-100">
                    {{ verificationInstructions.recordName }}
                  </code>
                  <button
                    class="rounded p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                    @click="copyToClipboard(verificationInstructions.recordName)"
                  >
                    <Icon icon="mdi:content-copy" class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.domain.verification.recordValue') }}
                </p>
                <div class="flex items-center gap-2">
                  <code class="flex-1 rounded bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 dark:bg-white/10 dark:text-slate-100">
                    {{ verificationInstructions.recordValue }}
                  </code>
                  <button
                    class="rounded p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                    @click="copyToClipboard(verificationInstructions.recordValue)"
                  >
                    <Icon icon="mdi:content-copy" class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p class="text-xs text-amber-700 dark:text-amber-300">
            {{ t('adminTenants.domain.verification.note') }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const { t } = useI18n()
const route = useRoute()
const runtimeConfig = useRuntimeConfig()

const tenantId = computed(() => route.params.id as string)

interface DomainData {
  tenantId: string
  name: string
  type: 'provider' | 'distributor'
  slug: string
  customDomain: string | null
  customDomainVerificationStatus: string
  customDomainVerifiedAt: string | null
  cnameTarget: string | null
  defaultDomain: string | null
  verificationInstructions?: {
    recordType: string
    recordName: string
    recordValue: string
    note: string
  } | null
}

const domainData = ref<DomainData | null>(null)
const verificationInstructions = ref<DomainData['verificationInstructions']>(null)
const loading = ref(true)
const saving = ref(false)
const verifying = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  customDomain: ''
})

const tenantName = computed(() => domainData.value?.name ?? '')
const tenantTypeLabel = computed(() => {
  if (!domainData.value) return ''
  return domainData.value.type === 'provider'
    ? t('adminTenants.domain.types.provider')
    : t('adminTenants.domain.types.distributor')
})

const slugSuffixes = runtimeConfig.public.loginBranding?.slugSuffixes ?? []
const defaultSlugSuffix = computed(() => slugSuffixes[0] ?? '')

const suggestedLoginDomain = computed(() => {
  if (!domainData.value?.slug || !defaultSlugSuffix.value) {
    return ''
  }
  const suffix = defaultSlugSuffix.value.startsWith('.')
    ? defaultSlugSuffix.value
    : `.${defaultSlugSuffix.value}`
  return `${domainData.value.slug}${suffix}`
})

const statusClasses = computed(() => {
  const status = domainData.value?.customDomainVerificationStatus
  switch (status) {
    case 'verified':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    case 'pending':
    case 'verifying':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400'
  }
})

const statusDotClass = computed(() => {
  const status = domainData.value?.customDomainVerificationStatus
  switch (status) {
    case 'verified':
      return 'bg-emerald-500'
    case 'pending':
    case 'verifying':
      return 'bg-amber-500'
    default:
      return 'bg-slate-400'
  }
})

const statusLabel = computed(() => {
  const status = domainData.value?.customDomainVerificationStatus
  switch (status) {
    case 'verified':
      return t('adminTenants.domain.status.verified')
    case 'pending':
      return t('adminTenants.domain.status.pending')
    case 'verifying':
      return t('adminTenants.domain.status.verifying')
    default:
      return t('adminTenants.domain.status.unverified')
  }
})

async function fetchDomainData() {
  if (!tenantId.value) return
  
  loading.value = true
  errorMessage.value = ''
  
  try {
    const response = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/domain`)
    domainData.value = response as DomainData
    form.customDomain = response.customDomain || ''
    verificationInstructions.value = response.verificationInstructions || null
  } catch (error: any) {
    errorMessage.value = error.data?.message || t('adminTenants.domain.error.fetchFailed')
  } finally {
    loading.value = false
  }
}

async function saveDomain() {
  if (!tenantId.value || !form.customDomain) return
  
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    const response = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/domain`, {
      method: 'PUT',
      body: { customDomain: form.customDomain }
    })
    
    domainData.value = { ...domainData.value, ...response } as DomainData
    verificationInstructions.value = response.verificationInstructions || null
    successMessage.value = t('adminTenants.domain.success.saved')
    
    setTimeout(() => { successMessage.value = '' }, 5000)
  } catch (error: any) {
    errorMessage.value = error.data?.message || t('adminTenants.domain.error.saveFailed')
  } finally {
    saving.value = false
  }
}

async function removeDomain() {
  if (!tenantId.value) return
  
  if (!confirm(t('adminTenants.domain.confirm.remove'))) return
  
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    const response = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/domain`, {
      method: 'PUT',
      body: { customDomain: null }
    })
    
    domainData.value = { ...domainData.value, ...response } as DomainData
    verificationInstructions.value = null
    form.customDomain = ''
    successMessage.value = t('adminTenants.domain.success.removed')
    
    setTimeout(() => { successMessage.value = '' }, 5000)
  } catch (error: any) {
    errorMessage.value = error.data?.message || t('adminTenants.domain.error.removeFailed')
  } finally {
    saving.value = false
  }
}

async function verifyDomain() {
  if (!tenantId.value) return
  
  verifying.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    const response = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/domain/verify`, {
      method: 'POST'
    })
    
    if (response.customDomainVerificationStatus === 'verified') {
      domainData.value = { ...domainData.value, ...response } as DomainData
      successMessage.value = t('adminTenants.domain.success.verified')
    } else {
      errorMessage.value = (response as any).error || t('adminTenants.domain.error.verificationFailed')
    }
    
    setTimeout(() => { successMessage.value = '' }, 5000)
  } catch (error: any) {
    errorMessage.value = error.data?.message || t('adminTenants.domain.error.verificationFailed')
  } finally {
    verifying.value = false
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    successMessage.value = t('adminTenants.domain.success.copied')
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch {
    errorMessage.value = t('adminTenants.domain.error.copyFailed')
  }
}

watch(tenantId, () => {
  fetchDomainData()
}, { immediate: true })
</script>
