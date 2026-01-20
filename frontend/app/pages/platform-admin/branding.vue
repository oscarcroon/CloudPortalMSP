<template>
  <section class="space-y-6">
    <header class="space-y-1">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Global branding</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Justera portalens standardlogotyp, accentfärg och login-branding. Dessa värden används när ingen
        organisation eller tenant har egna inställningar.
      </p>
    </header>

    <div v-if="brandingError" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ brandingError }}
    </div>

    <div
      v-else
      class="space-y-6"
    >
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:palette-outline" class="h-6 w-6 text-brand" />
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">App-branding</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Standardlogotyp och accentfärg för hela portalen.
              </p>
            </div>
          </div>
        </div>

        <div v-if="brandingLoading" class="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Hämtar brandinginformation...
        </div>
        <div v-else class="space-y-6">
          <div class="grid gap-6 lg:grid-cols-2">
            <div class="space-y-4">
              <div
                class="flex h-32 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-white"
                :style="{ backgroundColor: navigationPreviewColor }"
              >
                <img :src="currentLogo" alt="Global logo preview" class="max-h-20 w-auto object-contain" />
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Logokälla: {{ logoSourceLabel }}</p>
              <div class="flex flex-wrap items-center gap-3">
                <button
                  class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
                  type="button"
                  :disabled="isUploading"
                  @click="triggerFilePicker"
                >
                  {{ isUploading ? 'Laddar upp...' : 'Byt logotyp' }}
                </button>
                <button
                  v-if="hasCustomLogo"
                  class="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                  type="button"
                  :disabled="isUploading"
                  @click="removeLogo"
                >
                  {{ isUploading ? 'Tar bort...' : 'Ta bort logotyp' }}
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
              <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Max 2 MB</p>
            </div>

            <div class="space-y-4">
              <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Accentfärg</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      Globala accentfärgen används genom hela portalen.
                    </p>
                  </div>
                  <div
                    class="flex h-10 w-24 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    :style="{ backgroundColor: activeAccentColor }"
                  >
                    Accent
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
                    {{ accentSaving ? 'Sparar...' : 'Spara' }}
                  </button>
                  <button
                    v-if="globalHasCustomAccent"
                    class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                    type="button"
                    :disabled="accentSaving"
                    @click="resetAccent"
                  >
                    Återställ
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
                    :key="`accent-${option.key}`"
                    class="h-8 w-8 rounded-full border border-slate-200 transition hover:-translate-y-0.5 dark:border-white/10"
                    :style="{ backgroundColor: option.hex }"
                    :disabled="accentSaving"
                    @click="applyAccentPreset(option.hex)"
                  >
                    <span class="sr-only">Välj {{ option.label }}</span>
                  </button>
                </div>
              </div>

              <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Navigation</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">
                      Bakgrundsfärg för huvudmenyn i hela portalen.
                    </p>
                  </div>
                  <div
                    class="flex h-10 w-24 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    :style="{ backgroundColor: navigationPreviewColor }"
                  >
                    Nav
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
                    {{ navSaving ? 'Sparar...' : 'Spara' }}
                  </button>
                  <button
                    v-if="navColor"
                    class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                    type="button"
                    :disabled="navSaving"
                    @click="resetNavigationColor"
                  >
                    Återställ
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
                    <span class="sr-only">Välj {{ option.label }}</span>
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

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <Icon icon="mdi:login" class="h-6 w-6 text-brand" />
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Login-branding</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Loginlogotyper och bakgrund som används som global default.
              </p>
            </div>
          </div>
        </div>
        <LoginBrandingAssets
          class="mt-4"
          mode="global"
          target-id="global"
          :branding="brandingDetails"
          @updated="fetchBranding"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, reactive, ref, watch } from '#imports'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import LoginBrandingAssets from '~/components/branding/LoginBrandingAssets.vue'
import { normalizeLogoUrl } from '~/utils/logo'
import type { BrandingState, BrandingThemeSource } from '~/types/auth'
import {
  BRANDING_PALETTE,
  DEFAULT_BRANDING_ACCENT,
  DEFAULT_NAV_BACKGROUND,
  normalizeHexColor
} from '~~/shared/branding'

definePageMeta({
  superAdmin: true
})

const defaultLogo = defaultLogoAsset
const paletteOptions = BRANDING_PALETTE

const brandingDetails = ref<BrandingState | null>(null)
const brandingLoading = ref(false)
const brandingError = ref<string | null>(null)

const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccessMessage = ref<string | null>(null)
const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp']
const maxLogoBytes = 2 * 1024 * 1024

const accentSaving = ref(false)
const accentStatus = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const navColor = ref('')
const navSaving = ref(false)
const navStatus = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const accentForm = reactive({
  customColor: ''
})

const globalTheme = computed(() => brandingDetails.value?.globalTheme ?? null)

const currentLogo = computed(() => {
  const brandingLogo = brandingDetails.value?.activeTheme.logoUrl
  const normalized = normalizeLogoUrl(brandingLogo)
  return normalized ?? defaultLogo
})

const hasCustomLogo = computed(() => Boolean(globalTheme.value?.logoUrl))

const activeAccentColor = computed(
  () => brandingDetails.value?.activeTheme.accentColor ?? DEFAULT_BRANDING_ACCENT
)
const activeNavBackgroundColor = computed(
  () => brandingDetails.value?.activeTheme.navigationBackgroundColor ?? DEFAULT_NAV_BACKGROUND
)
const navColorInput = computed({
  get: () => navColor.value || activeNavBackgroundColor.value,
  set: value => {
    navColor.value = value
  }
})
const navigationPreviewColor = computed(() => navColor.value || activeNavBackgroundColor.value)

const logoSourceLabel = computed(() => formatBrandingSource(brandingDetails.value?.activeTheme.logoSource))

const globalHasCustomAccent = computed(() => Boolean(globalTheme.value?.accentColor))

watch(
  () => globalTheme.value?.navigationBackgroundColor,
  value => {
    navColor.value = value ?? ''
  },
  { immediate: true }
)

onMounted(() => {
  fetchBranding()
})

function triggerFilePicker() {
  uploadError.value = null
  uploadSuccessMessage.value = null
  logoInputRef.value?.click()
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !allowedExtensions.includes(extension)) {
    return 'Ogiltigt filformat. Tillåtna format: .jpg, .png, .svg, .webp.'
  }
  if (file.size > maxLogoBytes) {
    return 'Filen får vara max 2 MB.'
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
    const result = await $fetch<{ logoUrl?: string }>(`/api/admin/branding/logo`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    if (result?.logoUrl || result?.url) {
      uploadSuccessMessage.value = 'Logotypen uppdaterades.'
      await fetchBranding()
    } else {
      uploadError.value = 'Kunde inte ladda upp logotypen. Inget svar från servern.'
    }
  } catch (error: any) {
    uploadError.value = error?.data?.message || error?.message || 'Kunde inte ladda upp logotypen.'
  } finally {
    isUploading.value = false
    target.value = ''
    scheduleUploadStatusClear()
  }
}

async function removeLogo() {
  if (!confirm('Vill du ta bort den globala logotypen?')) {
    return
  }
  isUploading.value = true
  uploadError.value = null
  uploadSuccessMessage.value = null
  try {
    await $fetch(`/api/admin/branding/logo`, {
      method: 'DELETE',
      credentials: 'include'
    })
    uploadSuccessMessage.value = 'Logotypen togs bort.'
    await fetchBranding()
  } catch (error: any) {
    uploadError.value = error?.data?.message || error?.message || 'Kunde inte ta bort logotypen.'
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

async function fetchBranding() {
  brandingLoading.value = true
  brandingError.value = null
  try {
    brandingDetails.value = await $fetch<BrandingState>(`/api/admin/branding`, {
      credentials: 'include'
    })
    accentForm.customColor = globalTheme.value?.accentColor ?? ''
  } catch (error: any) {
    brandingError.value =
      error?.data?.message || error?.message || 'Kunde inte hämta brandinginformation.'
  } finally {
    brandingLoading.value = false
  }
}

async function saveCustomAccent() {
  if (accentSaving.value) {
    return
  }
  if (!accentForm.customColor.trim()) {
    accentStatus.value = { type: 'error', text: 'Ange en giltig färgkod.' }
    return
  }
  let normalized: string
  try {
    normalized = normalizeHexColor(accentForm.customColor)
  } catch {
    accentStatus.value = { type: 'error', text: 'Ogiltig färgkod.' }
    return
  }

  accentSaving.value = true
  accentStatus.value = null
  try {
    await $fetch('/api/admin/branding', {
      method: 'PUT',
      credentials: 'include',
      body: { accentColor: normalized }
    })
    await fetchBranding()
    accentStatus.value = { type: 'success', text: 'Accentfärgen uppdaterades.' }
  } catch (error: any) {
    accentStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || 'Kunde inte uppdatera accentfärgen.'
    }
  } finally {
    accentSaving.value = false
    scheduleAccentStatusClear()
  }
}

async function resetAccent() {
  if (accentSaving.value) {
    return
  }
  accentSaving.value = true
  accentStatus.value = null
  try {
    await $fetch('/api/admin/branding', {
      method: 'PUT',
      credentials: 'include',
      body: { accentColor: null }
    })
    await fetchBranding()
    accentStatus.value = { type: 'success', text: 'Accentfärgen återställdes.' }
  } catch (error: any) {
    accentStatus.value = {
      type: 'error',
      text: error?.data?.message || error?.message || 'Kunde inte återställa accentfärgen.'
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
    await $fetch('/api/admin/branding', {
      method: 'PUT',
      credentials: 'include',
      body: { navigationBackgroundColor: navColor.value || null }
    })
    await fetchBranding()
    navStatus.value = { type: 'success', text: 'Navigationsbakgrunden uppdaterades.' }
  } catch (error: any) {
    navStatus.value = {
      type: 'error',
      text:
        error?.data?.message || error?.message || 'Kunde inte uppdatera navigationsbakgrunden.'
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
    return 'Standard'
  }
  const label =
    source.targetType === 'organization'
      ? 'Organisation'
      : source.targetType === 'provider'
        ? 'Leverantör'
        : source.targetType === 'distributor'
          ? 'Distributör'
          : 'Global'
  return source.name ? `${label}: ${source.name}` : label
}
</script>

