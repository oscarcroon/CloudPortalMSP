<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-2">
      <NuxtLink
        :to="`/tenant-admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        {{ t('adminTenants.branding.backToTenant') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ t('adminTenants.branding.category') }}</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ tenantInfo?.name ?? t('adminTenants.branding.loading') }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ tenantTypeLabel }}
        </p>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:palette-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('adminTenants.branding.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.branding.description', { tenantType: tenantTypeLabel.toLowerCase() }) }}
            </p>
          </div>
        </div>

      <div v-if="brandingError" class="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
        {{ brandingError }}
      </div>

      <div v-else>
        <div v-if="brandingLoading" class="py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ t('adminTenants.branding.loadingBranding') }}
        </div>
        <div v-else class="mt-4 space-y-6">
          <div class="grid gap-6 lg:grid-cols-2">
            <div class="space-y-4">
              <div
                class="flex h-32 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-white"
                :style="{ backgroundColor: navigationPreviewColor }"
              >
                <img
                  :src="currentLogo"
                  :alt="`Logo preview for ${tenantInfo?.name}`"
                  class="max-h-20 w-auto object-contain"
                />
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('adminTenants.branding.logo.source', { source: logoSourceLabel }) }}</p>
              <div class="flex flex-wrap items-center gap-3">
                <button
                  class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
                  type="button"
                  :disabled="isUploading"
                  @click="triggerFilePicker"
                >
                  {{ isUploading ? t('adminTenants.branding.logo.uploading') : t('adminTenants.branding.logo.change') }}
                </button>
                <button
                  v-if="hasCustomLogo"
                  class="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                  type="button"
                  :disabled="isUploading"
                  @click="removeLogo"
                >
                  {{ isUploading ? t('adminTenants.branding.logo.removing') : t('adminTenants.branding.logo.remove') }}
                </button>
                <input
                  ref="logoInputRef"
                  type="file"
                  class="sr-only"
                  accept=".jpg,.jpeg,.png,.svg,.webp"
                  @change="handleLogoSelection"
                />
              </div>
              <p v-if="uploadError" class="text-xs font-semibold text-red-600">
                {{ uploadError }}
              </p>
              <p v-else-if="uploadSuccessMessage" class="text-xs font-semibold text-emerald-600">
                {{ uploadSuccessMessage }}
              </p>
                <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {{ t('adminTenants.branding.logo.maxSize') }}
                </p>
            </div>

            <div class="space-y-4">
              <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('adminTenants.branding.accentColor.title') }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      {{ t('adminTenants.branding.accentColor.description') }}
                    </p>
                </div>
                  <div
                    class="flex h-10 w-24 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    :style="{ backgroundColor: activeAccentColor }"
                  >
                    {{ t('adminTenants.branding.accentColor.label') }}
                </div>
              </div>
                <div class="flex flex-wrap items-center gap-3">
                  <input
                    v-model="accentForm.customColor"
                    type="color"
                    class="h-10 w-14 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-transparent"
                  />
                  <input
                    v-model="accentForm.customColor"
                    type="text"
                    class="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-transparent dark:text-slate-100"
                    placeholder="#005BFF"
                  />
                  <button
                    class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
                    type="button"
                    :disabled="accentSaving"
                    @click="saveCustomAccent"
                  >
                    {{ accentSaving ? t('adminTenants.branding.accentColor.saving') : t('adminTenants.branding.accentColor.save') }}
                  </button>
                  <button
                    v-if="tenantHasCustomAccent"
                    class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                    type="button"
                    :disabled="accentSaving"
                    @click="resetAccent"
                  >
                    {{ t('adminTenants.branding.accentColor.reset') }}
                  </button>
                </div>
                <p
                  v-if="accentStatus"
                  class="text-xs font-semibold"
                  :class="accentStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'"
                >
                  {{ accentStatus.text }}
                </p>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="option in paletteOptions"
                    :key="option.key"
                    class="h-8 w-8 rounded-full border border-slate-200 transition hover:-translate-y-0.5 dark:border-white/10"
                    :style="{ backgroundColor: option.hex }"
                    :disabled="accentSaving"
                    @click="applyAccentPreset(option.hex)"
                  >
                    <span class="sr-only">{{ t('adminTenants.branding.accentColor.select', { label: option.label }) }}</span>
                  </button>
                </div>
              </div>
              <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('adminTenants.branding.navigation.title') }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      {{ t('adminTenants.branding.navigation.description') }}
                    </p>
                  </div>
                  <div
                    class="flex h-10 w-24 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    :style="{ backgroundColor: navigationPreviewColor }"
                  >
                    {{ t('adminTenants.branding.navigation.label') }}
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <input
                    v-model="navColorInput"
                    type="color"
                    class="h-10 w-14 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-transparent"
                  />
                  <input
                    v-model="navColor"
                    type="text"
                    class="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-transparent dark:text-slate-100"
                    placeholder="#0F1C2F"
                  />
                  <button
                    class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
                    type="button"
                    :disabled="navSaving"
                    @click="saveNavigationColor"
                  >
                    {{ navSaving ? t('adminTenants.branding.navigation.saving') : t('adminTenants.branding.navigation.save') }}
                  </button>
                  <button
                    v-if="navColor"
                    class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                    type="button"
                    :disabled="navSaving"
                    @click="resetNavigationColor"
                  >
                    {{ t('adminTenants.branding.navigation.reset') }}
                  </button>
                </div>
                <p
                  v-if="navStatus"
                  class="text-xs font-semibold"
                  :class="navStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'"
                >
                  {{ navStatus.text }}
                </p>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="option in paletteOptions"
                    :key="`nav-${option.key}`"
                    class="h-8 w-8 rounded-full border border-slate-200 transition hover:-translate-y-0.5 dark:border-white/10"
                    :style="{ backgroundColor: option.hex }"
                    :disabled="navSaving"
                    @click="applyNavPreset(option.hex)"
                  >
                    <span class="sr-only">{{ t('adminTenants.branding.navigation.select', { label: option.label }) }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-200 pt-4 dark:border-white/10" v-if="brandingLayers.length">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.branding.inheritedChain.title') }}</p>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <div
                v-for="layer in brandingLayers"
                :key="layer.title"
                class="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10"
              >
                <p class="font-semibold text-slate-900 dark:text-slate-100">{{ layer.title }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ layer.name }}</p>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.branding.inheritedChain.logo') }} <span class="font-semibold">{{ layer.hasLogo ? t('adminTenants.branding.inheritedChain.custom') : t('adminTenants.branding.inheritedChain.inherited') }}</span>
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.branding.inheritedChain.accent') }} <span class="font-semibold">{{ layer.hasAccent ? t('adminTenants.branding.inheritedChain.custom') : t('adminTenants.branding.inheritedChain.inherited') }}</span>
                </p>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-200 pt-6 dark:border-white/10">
            <div class="flex items-center gap-3">
              <Icon icon="mdi:login" class="h-6 w-6 text-brand" />
              <div>
                <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {{ t('adminTenants.branding.loginBranding.title') }}
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.branding.loginBranding.description', { tenantType: tenantTypeLabel.toLowerCase() }) }}
                </p>
              </div>
            </div>
            <LoginBrandingAssets
              v-if="brandingDetails"
              class="mt-4"
              mode="tenant"
              :target-id="tenantId"
              :branding="brandingDetails"
              @updated="fetchBranding"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-3">
            <Icon icon="mdi:earth" class="h-6 w-6 text-brand" />
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('adminTenants.branding.loginDomain.title') }}</h2>
          </div>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ t('adminTenants.branding.loginDomain.description') }}
          </p>
          <p v-if="suggestedLoginDomain" class="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {{ t('adminTenants.branding.loginDomain.default') }} <code class="rounded bg-slate-100 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-100">https://{{ suggestedLoginDomain }}</code>
          </p>
        </div>
        <span
          class="rounded-full px-3 py-1 text-xs font-semibold"
          :class="domainVerificationMeta.class"
        >
          {{ domainVerificationMeta.label }}
        </span>
      </div>
      <div class="mt-4 space-y-3">
        <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.branding.loginDomain.customDomain') }}</label>
        <input
          v-model="customDomainForm.value"
          type="text"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-transparent dark:text-slate-100"
          :placeholder="t('adminTenants.branding.loginDomain.placeholder')"
        />
        <div class="flex flex-wrap items-center gap-3">
          <button
            class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
            type="button"
            :disabled="customDomainSaving"
            @click="saveCustomDomain"
          >
            {{ customDomainSaving ? t('adminTenants.branding.loginDomain.saving') : t('adminTenants.branding.loginDomain.save') }}
          </button>
          <button
            v-if="tenantInfo?.customDomain"
            class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
            type="button"
            :disabled="verifyDomainLoading"
            @click="verifyCustomDomain"
          >
            {{ verifyDomainLoading ? t('adminTenants.branding.loginDomain.verifying') : t('adminTenants.branding.loginDomain.verify') }}
          </button>
        </div>
        <p v-if="customDomainStatus" class="text-xs font-semibold" :class="customDomainStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'">
          {{ customDomainStatus.text }}
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          {{ t('adminTenants.branding.loginDomain.cnameHint', { domain: suggestedLoginDomain || 'login.<slug>' }) }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, useRoute, useRuntimeConfig } from '#imports'
import { Icon } from '@iconify/vue'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { normalizeLogoUrl } from '~/utils/logo'
import type { BrandingState, BrandingThemeSource } from '~/types/auth'
import {
  BRANDING_PALETTE,
  DEFAULT_BRANDING_ACCENT,
  DEFAULT_NAV_BACKGROUND,
  normalizeHexColor
} from '~~/shared/branding'
import LoginBrandingAssets from '~/components/branding/LoginBrandingAssets.vue'
import { useI18n } from '#imports'

const { t } = useI18n()

const route = useRoute()
const tenantId = computed(() => route.params.id as string)

const defaultLogo = defaultLogoAsset
const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccessMessage = ref<string | null>(null)
const brandingDetails = ref<BrandingState | null>(null)
const tenantInfo = ref<{
  name: string
  type: 'provider' | 'distributor'
  slug: string
  customDomain: string | null
  customDomainVerificationStatus: string
  customDomainVerifiedAt: number | null
} | null>(null)
const brandingLoading = ref(false)
const brandingError = ref<string | null>(null)
const accentSaving = ref(false)
const accentStatus = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const navColor = ref('')
const navSaving = ref(false)
const navStatus = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const accentForm = reactive({
  customColor: ''
})
const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp']
const maxLogoBytes = 2 * 1024 * 1024
const paletteOptions = BRANDING_PALETTE
const runtimeConfig = useRuntimeConfig()
const slugSuffixes = runtimeConfig.public.loginBranding?.slugSuffixes ?? []
const defaultSlugSuffix = computed(() => slugSuffixes[0] ?? '')
const customDomainForm = reactive({
  value: ''
})
const customDomainSaving = ref(false)
const customDomainStatus = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const verifyDomainLoading = ref(false)

watch(
  () => tenantId.value,
  () => {
    fetchBranding()
  },
  { immediate: true }
)

watch(
  () => brandingDetails.value?.tenantTheme?.navigationBackgroundColor,
  value => {
    navColor.value = value ?? ''
  },
  { immediate: true }
)

const currentLogo = computed(() => {
  const brandingLogo = brandingDetails.value?.activeTheme.logoUrl
  const normalized = normalizeLogoUrl(brandingLogo)
  return normalized ?? defaultLogo
})

const tenantTypeLabel = computed(() => {
  if (!tenantInfo.value) return 'Tenant'
  return tenantInfo.value.type === 'provider' ? t('adminTenants.branding.types.provider') : t('adminTenants.branding.types.distributor')
})

const activeAccentColor = computed(
  () => brandingDetails.value?.activeTheme.accentColor ?? DEFAULT_BRANDING_ACCENT
)
const activeNavBackgroundColor = computed(
  () => brandingDetails.value?.activeTheme.navigationBackgroundColor ?? DEFAULT_NAV_BACKGROUND
)
const navColorInput = computed({
  get: () => navColor.value || activeNavBackgroundColor.value,
  set: (value: string) => {
    navColor.value = value
  }
})
const navigationPreviewColor = computed(() => navColor.value || activeNavBackgroundColor.value)

const suggestedLoginDomain = computed(() => {
  if (!tenantInfo.value?.slug || !defaultSlugSuffix.value) {
    return ''
  }
  const suffix = defaultSlugSuffix.value.startsWith('.')
    ? defaultSlugSuffix.value
    : `.${defaultSlugSuffix.value}`
  return `${tenantInfo.value.slug}${suffix}`
})

const hasCustomLogo = computed(() => Boolean(brandingDetails.value?.tenantTheme?.logoUrl))
const logoSourceLabel = computed(() => formatSource(brandingDetails.value?.activeTheme.logoSource))
const tenantHasCustomAccent = computed(() =>
  Boolean(brandingDetails.value?.tenantTheme?.accentColor)
)
const brandingLayers = computed(() => {
  if (!brandingDetails.value) {
    return []
  }
  const layers = []
  if (brandingDetails.value.tenantTheme) {
    layers.push({
      title: tenantTypeLabel.value,
      name: brandingDetails.value.tenantTheme.name,
      hasLogo: Boolean(brandingDetails.value.tenantTheme.logoUrl),
      hasAccent: Boolean(
        brandingDetails.value.tenantTheme.accentColor || brandingDetails.value.tenantTheme.paletteKey
      )
    })
  }
  if (brandingDetails.value.distributorTheme) {
    layers.push({
      title: t('adminTenants.branding.types.distributor'),
      name: brandingDetails.value.distributorTheme.name,
      hasLogo: Boolean(brandingDetails.value.distributorTheme.logoUrl),
      hasAccent: Boolean(
        brandingDetails.value.distributorTheme.accentColor ||
          brandingDetails.value.distributorTheme.paletteKey
      )
    })
  }
  return layers
})

const domainVerificationMeta = computed(() => {
  if (!tenantInfo.value?.customDomain) {
    return {
      label: t('adminTenants.branding.loginDomain.status.notConfigured'),
      class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    }
  }
  switch (tenantInfo.value.customDomainVerificationStatus) {
    case 'verified':
      return {
        label: t('adminTenants.branding.loginDomain.status.verified'),
        class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100'
      }
    case 'pending':
      return {
        label: t('adminTenants.branding.loginDomain.status.pending'),
        class: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100'
      }
    case 'failed':
      return {
        label: t('adminTenants.branding.loginDomain.status.failed'),
        class: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-100'
      }
    default:
      return {
        label: t('adminTenants.branding.loginDomain.status.unverified'),
        class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      }
  }
})

function triggerFilePicker() {
  uploadError.value = null
  uploadSuccessMessage.value = null
  logoInputRef.value?.click()
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !allowedExtensions.includes(extension)) {
    return t('adminTenants.branding.logo.invalidFormat')
  }
  if (file.size > maxLogoBytes) {
    return t('adminTenants.branding.logo.fileTooLarge')
  }
  return null
}

async function handleLogoSelection(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  uploadError.value = null
  uploadSuccessMessage.value = null

  const validationError = validateFile(file)
  if (validationError) {
    uploadError.value = validationError
    target.value = ''
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('logo', file)
    const result = await $fetch<{ logoUrl: string }>(
      `/api/admin/tenants/${tenantId.value}/branding/logo`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include'
      }
    )
    if (result?.logoUrl) {
      uploadSuccessMessage.value = t('adminTenants.branding.logo.updated')
      await fetchBranding()
    } else {
      uploadError.value = t('adminTenants.branding.logo.uploadErrorNoResponse')
    }
  } catch (error: any) {
    uploadError.value = error?.data?.message || error?.message || t('adminTenants.branding.logo.uploadError')
  } finally {
    isUploading.value = false
    target.value = ''
    scheduleUploadStatusClear()
  }
}

async function removeLogo() {
  if (!confirm(t('adminTenants.branding.logo.removeConfirm'))) {
    return
  }
  isUploading.value = true
  uploadError.value = null
  uploadSuccessMessage.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding/logo`, {
      method: 'DELETE',
      credentials: 'include'
    })
    uploadSuccessMessage.value = t('adminTenants.branding.logo.removed')
    await fetchBranding()
  } catch (error: any) {
    uploadError.value = error?.data?.message || error?.message || t('adminTenants.branding.logo.removeError')
  } finally {
    isUploading.value = false
    scheduleUploadStatusClear()
  }
}

function scheduleUploadStatusClear() {
  if (uploadSuccessMessage.value) {
    setTimeout(() => {
      uploadSuccessMessage.value = null
    }, 4000)
  }
  if (uploadError.value) {
    setTimeout(() => {
      uploadError.value = null
    }, 6000)
  }
}

async function saveCustomDomain() {
  if (!tenantId.value) return
  customDomainSaving.value = true
  customDomainStatus.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/domain`, {
      method: 'PUT',
      credentials: 'include',
      body: {
        customDomain: customDomainForm.value.trim() || null
      }
    })
    customDomainStatus.value = { type: 'success', text: t('adminTenants.branding.loginDomain.updated') }
    await fetchBranding()
  } catch (error: any) {
    customDomainStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('adminTenants.branding.loginDomain.saveError')
    }
  } finally {
    customDomainSaving.value = false
  }
}

async function verifyCustomDomain() {
  if (!tenantId.value || !tenantInfo.value?.customDomain) {
    return
  }
  verifyDomainLoading.value = true
  customDomainStatus.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/domain/verify`, {
      method: 'POST',
      credentials: 'include'
    })
    customDomainStatus.value = { type: 'success', text: t('adminTenants.branding.loginDomain.verified') }
    await fetchBranding()
  } catch (error: any) {
    customDomainStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('adminTenants.branding.loginDomain.verifyError')
    }
  } finally {
    verifyDomainLoading.value = false
  }
}

async function fetchBranding() {
  if (!tenantId.value) return
  brandingLoading.value = true
  brandingError.value = null
  try {
    const response = await $fetch<{
      branding: BrandingState
      tenant: {
        name: string
        type: 'provider' | 'distributor'
        slug: string
        customDomain: string | null
        customDomainVerificationStatus: string
        customDomainVerifiedAt: number | null
      }
    }>(
      `/api/admin/tenants/${tenantId.value}/branding`,
      {
        credentials: 'include'
      }
    )
    brandingDetails.value = response.branding
    tenantInfo.value = response.tenant
    const theme = brandingDetails.value?.tenantTheme
    accentForm.customColor = theme?.accentColor ?? ''
    navColor.value = theme?.navigationBackgroundColor ?? ''
    customDomainForm.value = tenantInfo.value?.customDomain ?? ''
  } catch (error: any) {
    brandingError.value =
      error?.data?.message || error?.message || t('adminTenants.branding.errors.loadFailed')
  } finally {
    brandingLoading.value = false
  }
}

async function saveCustomAccent() {
  if (!accentForm.customColor.trim()) {
    accentStatus.value = { type: 'error', text: t('adminTenants.branding.accentColor.missingColor') }
    return
  }
  let normalized: string
  try {
    normalized = normalizeHexColor(accentForm.customColor)
  } catch {
    accentStatus.value = { type: 'error', text: t('adminTenants.branding.accentColor.invalidColor') }
    return
  }
  accentSaving.value = true
  accentStatus.value = null
  try {
    const currentNavColor = brandingDetails.value?.tenantTheme?.navigationBackgroundColor
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { 
        accentColor: normalized,
        navigationBackgroundColor: currentNavColor ?? undefined
      }
    })
    await fetchBranding()
    accentStatus.value = { type: 'success', text: t('adminTenants.branding.accentColor.updated') }
  } catch (error: any) {
    accentStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('adminTenants.branding.accentColor.updateError')
    }
  } finally {
    accentSaving.value = false
    scheduleAccentStatusClear()
  }
}

async function resetAccent() {
  accentSaving.value = true
  accentStatus.value = null
  try {
    const currentNavColor = brandingDetails.value?.tenantTheme?.navigationBackgroundColor
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { 
        accentColor: null,
        paletteKey: null,
        navigationBackgroundColor: currentNavColor ?? undefined
      }
    })
    await fetchBranding()
    accentStatus.value = { type: 'success', text: t('adminTenants.branding.accentColor.resetMessage') }
  } catch (error: any) {
    accentStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('adminTenants.branding.accentColor.resetError')
    }
  } finally {
    accentSaving.value = false
    scheduleAccentStatusClear()
  }
}

function scheduleAccentStatusClear() {
  if (!accentStatus.value) {
    return
  }
  const timeout = accentStatus.value.type === 'success' ? 4000 : 6000
  setTimeout(() => {
    accentStatus.value = null
  }, timeout)
}

async function applyAccentPreset(hex: string) {
  accentForm.customColor = hex
  await saveCustomAccent()
}

async function saveNavigationColor() {
  if (navSaving.value) {
    return
  }
  navSaving.value = true
  navStatus.value = null
  try {
    const currentAccentColor = brandingDetails.value?.tenantTheme?.accentColor
    const currentPaletteKey = brandingDetails.value?.tenantTheme?.paletteKey
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { 
        navigationBackgroundColor: navColor.value || null,
        accentColor: currentAccentColor ?? undefined,
        paletteKey: currentPaletteKey ?? undefined
      }
    })
    await fetchBranding()
    navStatus.value = { type: 'success', text: t('adminTenants.branding.navigation.updated') }
  } catch (error: any) {
    navStatus.value = {
      type: 'error',
      text:
        error?.data?.message || error?.message || t('adminTenants.branding.navigation.updateError')
    }
  } finally {
    navSaving.value = false
    scheduleNavStatusClear()
  }
}

async function resetNavigationColor() {
  navColor.value = ''
  await saveNavigationColor()
}

function scheduleNavStatusClear() {
  if (!navStatus.value) {
    return
  }
  const timeout = navStatus.value.type === 'success' ? 4000 : 6000
  setTimeout(() => {
    navStatus.value = null
  }, timeout)
}

async function applyNavPreset(hex: string) {
  navColor.value = hex
  await saveNavigationColor()
}

function formatSource(source?: BrandingThemeSource | null) {
  if (!source || source.targetType === 'default') {
    return t('adminTenants.branding.sourceLabels.default')
  }
  const labelKey = `adminTenants.branding.sourceLabels.${source.targetType}`
  const label = t(labelKey)
  return source.name ? `${label}: ${source.name}` : label
}
</script>

