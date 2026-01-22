<template>
  <section class="space-y-6">
    <NuxtLink
      to="/settings"
      class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
    >
      {{ t('settings.branding.backToSettings') }}
    </NuxtLink>

    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ t('settings.branding.category') }}</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.branding.title') }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ t('settings.branding.pageDescription', { orgName: activeOrganisationName }) }}
      </p>
    </div>

    <div v-if="!showContent" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
      {{ t('settings.branding.loading') }}
    </div>

    <div v-else class="space-y-6">
      <div
        v-if="isSettingsLocked"
        class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
      >
        {{ t('settings.branding.noActiveOrg') }}
      </div>

      <div
        class="space-y-6"
        :class="{
          'pointer-events-none opacity-50': isSettingsLocked
        }"
      >
        <div class="space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <Icon icon="mdi:palette-outline" class="h-6 w-6 text-brand" />
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.branding.appBranding.title') }}</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ t('settings.branding.appBranding.description') }}
                </p>
              </div>
            </div>
            <span class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {{ activeOrganisationName }}
            </span>
          </div>

          <div v-if="brandingError" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {{ brandingError }}
          </div>
          <div v-else>
            <div v-if="brandingLoading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.branding.appBranding.loadingBranding') }}
            </div>
            <div v-else class="space-y-6">
              <div class="grid gap-6 lg:grid-cols-2">
                <div class="space-y-4">
                  <div
                    class="flex h-32 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-white"
                    :style="{ backgroundColor: navigationPreviewColor }"
                  >
                    <img :src="currentLogo" :alt="t('settings.branding.logoPreview', { orgName: activeOrganisationName })" class="max-h-20 w-auto object-contain" />
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('settings.branding.appBranding.logoSource', { source: logoSourceLabel }) }}</p>
                  <div class="flex flex-wrap items-center gap-3">
                    <button
                      class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
                      type="button"
                      :disabled="isUploading"
                      @click="triggerFilePicker"
                    >
                      {{ isUploading ? t('settings.branding.appBranding.uploading') : t('settings.branding.appBranding.changeLogo') }}
                    </button>
                    <button
                      v-if="hasCustomLogo"
                      class="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                      type="button"
                      :disabled="isUploading"
                      @click="removeLogo"
                    >
                      {{ isUploading ? t('settings.branding.appBranding.removing') : t('settings.branding.appBranding.removeLogo') }}
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
                  <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ t('settings.branding.appBranding.maxSize') }}</p>
                </div>

                <div class="space-y-4">
                <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.branding.accentColor.title') }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ t('settings.branding.accentColor.description') }}
                      </p>
                    </div>
                    <div
                      class="flex h-10 w-24 items-center justify-center rounded-lg text-xs font-semibold text-white"
                      :style="{ backgroundColor: activeAccentColor }"
                    >
                      {{ t('settings.branding.accentColor.label') }}
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
                      {{ accentSaving ? t('settings.branding.accentColor.saving') : t('settings.branding.accentColor.save') }}
                    </button>
                    <button
                      v-if="organizationHasCustomAccent"
                      class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                      type="button"
                      :disabled="accentSaving"
                      @click="resetAccent"
                    >
                      {{ t('settings.branding.accentColor.reset') }}
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
                      <span class="sr-only">{{ t('settings.branding.accentColor.select', { label: t(`settings.branding.palette.${option.key}`) }) }}</span>
                    </button>
                  </div>
                </div>

                <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <div class="flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.branding.navigation.title') }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ t('settings.branding.navigation.description') }}
                      </p>
                    </div>
                    <div
                      class="flex h-10 w-24 items-center justify-center rounded-lg text-xs font-semibold text-white"
                      :style="{ backgroundColor: navigationPreviewColor }"
                    >
                      {{ t('settings.branding.navigation.label') }}
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
                      {{ navSaving ? t('settings.branding.accentColor.saving') : t('settings.branding.accentColor.save') }}
                    </button>
                    <button
                      v-if="navColor"
                      class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                      type="button"
                      :disabled="navSaving"
                      @click="resetNavigationColor"
                    >
                      {{ t('settings.branding.accentColor.reset') }}
                    </button>
                  </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="option in paletteOptions"
                    :key="`nav-${option.key}`"
                    class="h-8 w-8 rounded-full border border-slate-200 transition hover:-translate-y-0.5 dark:border-white/10"
                    :style="{ backgroundColor: option.hex }"
                    :disabled="navSaving"
                    @click="applyNavPreset(option.hex)"
                  >
                    <span class="sr-only">{{ t('settings.branding.navigation.select', { label: t(`settings.branding.palette.${option.key}`) }) }}</span>
                  </button>
                </div>
                  <p
                    v-if="navStatus"
                    class="text-xs font-semibold"
                    :class="navStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'"
                  >
                    {{ navStatus.text }}
                  </p>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <Icon icon="mdi:login" class="h-6 w-6 text-brand" />
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.branding.loginBranding.title') }}</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {{ t('settings.branding.loginBranding.description') }}
                </p>
              </div>
            </div>
          </div>
          <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {{ t('settings.branding.loginBranding.autoSelect') }}
          </p>
          <LoginBrandingAssets
            v-if="currentOrgId && brandingDetails"
            class="mt-4"
            mode="organization"
            :target-id="currentOrgId"
            :branding="brandingDetails"
            @updated="refreshBranding"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from '#imports'
import { Icon } from '@iconify/vue'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { useAuth } from '~/composables/useAuth'
import { useI18n } from '#imports'

const { t } = useI18n()
import LoginBrandingAssets from '~/components/branding/LoginBrandingAssets.vue'
import { normalizeLogoUrl } from '~/utils/logo'
import type { BrandingState, BrandingThemeSource } from '~/types/auth'
import {
  BRANDING_PALETTE,
  DEFAULT_BRANDING_ACCENT,
  DEFAULT_NAV_BACKGROUND,
  normalizeHexColor
} from '~~/shared/branding'

const auth = useAuth()

onMounted(async () => {
  if (!auth.state.value.initialized && !auth.state.value.loading) {
    await auth.bootstrap()
  }
})

const currentOrgId = computed(() => auth.state.value.data?.currentOrgId ?? null)
const activeOrganisationName = computed(() => auth.currentOrg.value?.name ?? 'Ingen organisation vald')
const hasActiveOrg = computed(() => Boolean(currentOrgId.value))
const isSettingsLocked = computed(() => !hasActiveOrg.value)
const showContent = computed(() => auth.state.value.initialized && !auth.state.value.loading)

const defaultLogo = defaultLogoAsset
const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccessMessage = ref<string | null>(null)
const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp']
const maxLogoBytes = 2 * 1024 * 1024
const brandingDetails = ref<BrandingState | null>(null)
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
const paletteOptions = BRANDING_PALETTE

watch(
  () => currentOrgId.value,
  () => {
    refreshBranding()
  },
  { immediate: true }
)

const currentLogo = computed(() => {
  const brandingLogo = brandingDetails.value?.activeTheme.logoUrl ?? auth.branding.value?.activeTheme.logoUrl
  const orgLogoUrl = brandingLogo ?? auth.currentOrg.value?.logoUrl
  const normalized = normalizeLogoUrl(orgLogoUrl)
  return normalized ?? defaultLogo
})

const hasCustomLogo = computed(() => Boolean(brandingDetails.value?.organizationTheme?.logoUrl))
const activeAccentColor = computed(
  () =>
    brandingDetails.value?.activeTheme.accentColor ??
    auth.branding.value?.activeTheme.accentColor ??
    DEFAULT_BRANDING_ACCENT
)
const activeNavBackgroundColor = computed(
  () =>
    brandingDetails.value?.activeTheme.navigationBackgroundColor ??
    auth.branding.value?.activeTheme.navigationBackgroundColor ??
    DEFAULT_NAV_BACKGROUND
)
const navColorInput = computed({
  get: () => navColor.value || activeNavBackgroundColor.value,
  set: value => {
    navColor.value = value
  }
})
const navigationPreviewColor = computed(() => navColor.value || activeNavBackgroundColor.value)
const logoSourceLabel = computed(() =>
  formatBrandingSource(brandingDetails.value?.activeTheme.logoSource ?? auth.branding.value?.activeTheme.logoSource)
)
const organizationHasCustomAccent = computed(() =>
  Boolean(brandingDetails.value?.organizationTheme?.accentColor)
)

watch(
  () => brandingDetails.value?.organizationTheme?.navigationBackgroundColor,
  value => {
    navColor.value = value ?? ''
  },
  { immediate: true }
)

function triggerFilePicker() {
  uploadError.value = null
  uploadSuccessMessage.value = null
  logoInputRef.value?.click()
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !allowedExtensions.includes(extension)) {
    return t('settings.branding.messages.invalidFileFormat')
  }
  if (file.size > maxLogoBytes) {
    return t('settings.branding.messages.fileTooLarge')
  }
  return null
}

async function handleLogoSelection(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    target.value = ''
    return
  }
  uploadError.value = null
  uploadSuccessMessage.value = null

  const validationError = validateFile(file)
  if (validationError) {
    uploadError.value = validationError
    target.value = ''
    return
  }

  const activeOrgId = currentOrgId.value
  if (!activeOrgId) {
    uploadError.value = t('settings.branding.messages.noActiveOrg')
    target.value = ''
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('logo', file)
    const result = await $fetch<{ logoUrl: string }>(`/api/organizations/${activeOrgId}/logo`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    if (result?.logoUrl) {
      uploadSuccessMessage.value = t('settings.branding.messages.logoUpdated')
      await auth.fetchMe()
      await refreshBranding()
    } else {
      uploadError.value = t('settings.branding.messages.logoUploadErrorNoResponse')
    }
  } catch (error: any) {
    const errorMessage = error?.data?.message || error?.message || t('settings.branding.messages.logoUploadError')
    uploadError.value = errorMessage
  } finally {
    isUploading.value = false
    target.value = ''
    scheduleUploadStatusClear()
  }
}

async function removeLogo() {
  const activeOrgId = currentOrgId.value
  if (!activeOrgId) {
    uploadError.value = t('settings.branding.messages.noActiveOrg')
    return
  }

  if (!confirm(t('settings.branding.messages.logoRemoveConfirm'))) {
    return
  }

  isUploading.value = true
  uploadError.value = null
  uploadSuccessMessage.value = null

  try {
    await $fetch(`/api/organizations/${activeOrgId}/logo`, {
      method: 'DELETE',
      credentials: 'include'
    })
    uploadSuccessMessage.value = t('settings.branding.messages.logoRemoved')
    await auth.fetchMe()
    await refreshBranding()
  } catch (error: any) {
    const errorMessage = error?.data?.message || error?.message || t('settings.branding.messages.logoRemoveError')
    uploadError.value = errorMessage
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

async function refreshBranding() {
  const activeOrgId = currentOrgId.value
  if (!activeOrgId) {
    brandingDetails.value = null
    return
  }
  brandingLoading.value = true
  brandingError.value = null
  try {
    brandingDetails.value = await $fetch<BrandingState>(`/api/organizations/${activeOrgId}/branding`, {
      credentials: 'include'
    })
    const theme = brandingDetails.value?.organizationTheme
    accentForm.customColor = theme?.accentColor ?? ''
  } catch (error: any) {
    brandingError.value = error?.data?.message || error?.message || t('settings.branding.messages.brandingLoadError')
  } finally {
    brandingLoading.value = false
  }
}

async function saveCustomAccent() {
  const activeOrgId = currentOrgId.value
  if (!activeOrgId || accentSaving.value) {
    return
  }
  if (!accentForm.customColor.trim()) {
    accentStatus.value = { type: 'error', text: t('settings.branding.messages.accentMissingColor') }
    return
  }
  let normalized: string
  try {
    normalized = normalizeHexColor(accentForm.customColor)
  } catch {
    accentStatus.value = { type: 'error', text: t('settings.branding.messages.accentInvalidColor') }
    return
  }

  accentSaving.value = true
  accentStatus.value = null
  try {
    const currentNavColor = brandingDetails.value?.organizationTheme?.navigationBackgroundColor
    await $fetch(`/api/organizations/${activeOrgId}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { 
        accentColor: normalized,
        navigationBackgroundColor: currentNavColor ?? undefined
      }
    })
    await auth.fetchMe()
    await refreshBranding()
    accentStatus.value = { type: 'success', text: t('settings.branding.messages.accentUpdated') }
  } catch (error: any) {
    accentStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('settings.branding.messages.accentUpdateError')
    }
  } finally {
    accentSaving.value = false
    scheduleAccentStatusClear()
  }
}

async function resetAccent() {
  const activeOrgId = currentOrgId.value
  if (!activeOrgId || accentSaving.value) {
    return
  }
  accentSaving.value = true
  accentStatus.value = null
  try {
    const currentNavColor = brandingDetails.value?.organizationTheme?.navigationBackgroundColor
    await $fetch(`/api/organizations/${activeOrgId}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { 
        accentColor: null,
        paletteKey: null,
        navigationBackgroundColor: currentNavColor ?? undefined
      }
    })
    await auth.fetchMe()
    await refreshBranding()
    accentStatus.value = { type: 'success', text: t('settings.branding.messages.accentReset') }
  } catch (error: any) {
    accentStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('settings.branding.messages.accentResetError')
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
  const activeOrgId = auth.state.value.data?.currentOrgId
  if (!activeOrgId || navSaving.value) {
    return
  }
  navSaving.value = true
  navStatus.value = null
  try {
    const currentAccentColor = brandingDetails.value?.organizationTheme?.accentColor
    const currentPaletteKey = brandingDetails.value?.organizationTheme?.paletteKey
    await $fetch(`/api/organizations/${activeOrgId}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { 
        navigationBackgroundColor: navColor.value || null,
        accentColor: currentAccentColor ?? undefined,
        paletteKey: currentPaletteKey ?? undefined
      }
    })
    await auth.fetchMe()
    await refreshBranding()
    navStatus.value = { type: 'success', text: t('settings.branding.messages.navUpdated') }
  } catch (error: any) {
    navStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || t('settings.branding.messages.navUpdateError')
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

function formatBrandingSource(source?: BrandingThemeSource | null) {
  if (!source || source.targetType === 'default') {
    return t('settings.branding.sourceLabels.default')
  }
  const label = t(`settings.branding.sourceLabels.${source.targetType}`)
  return source.name ? `${label}: ${source.name}` : label
}
</script>

