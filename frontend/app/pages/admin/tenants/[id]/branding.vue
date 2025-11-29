<template>
  <section class="space-y-6">
    <div class="flex flex-col gap-2">
      <NuxtLink
        :to="`/admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Branding</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {{ tenantInfo?.name ?? 'Laddar...' }}
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
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Branding</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Uppdatera logotyp och accentfärg för {{ tenantTypeLabel.toLowerCase() }}n.
            </p>
          </div>
        </div>

      <div v-if="brandingError" class="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
        {{ brandingError }}
      </div>

      <div v-else>
        <div v-if="brandingLoading" class="py-8 text-sm text-slate-500 dark:text-slate-400">
          Hämtar brandinginformation...
        </div>
        <div v-else class="mt-4 space-y-6">
          <div class="grid gap-6 lg:grid-cols-2">
            <div class="space-y-4">
              <div
                class="flex h-28 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0f1c2f] px-4 text-white"
              >
                <img :src="currentLogo" :alt="`Logo preview for ${tenantInfo?.name}`" class="max-h-16 w-auto object-contain" />
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
                <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Max 2 MB
                </p>
            </div>

            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <div
                  class="h-12 w-12 rounded-full border border-slate-200 shadow-inner dark:border-white/10"
                  :style="{ backgroundColor: activeAccentColor }"
                />
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Accentfärg</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Källa: {{ accentSourceLabel }}</p>
                </div>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Palett</p>
                  <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <button
                    v-for="option in paletteOptions"
                    :key="option.key"
                    class="flex flex-col items-center rounded-xl border px-3 py-2 text-xs font-semibold transition"
                    :class="[
                      brandingDetails?.tenantTheme?.paletteKey === option.key
                        ? 'border-brand text-brand'
                        : 'border-slate-200 text-slate-600 hover:border-brand/50 hover:text-brand',
                      accentSaving ? 'opacity-50 cursor-not-allowed' : ''
                    ]"
                    :disabled="accentSaving"
                    @click="applyPalette(option.key)"
                  >
                      <span
                        class="mb-2 flex h-10 w-10 items-center justify-center rounded-full"
                        :style="{ backgroundColor: option.hex }"
                      />
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <div class="space-y-2">
                <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Egen färg</p>
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
                    v-if="tenantHasCustomAccent"
                    class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                    type="button"
                    :disabled="accentSaving"
                    @click="resetAccent"
                  >
                    Återställ
                  </button>
                </div>
                <p v-if="accentStatus" :class="accentStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'" class="text-xs font-semibold">
                  {{ accentStatus.text }}
                </p>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-200 pt-4 dark:border-white/10" v-if="brandingLayers.length">
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Ärvd kedja</p>
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              <div
                v-for="layer in brandingLayers"
                :key="layer.title"
                class="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10"
              >
                <p class="font-semibold text-slate-900 dark:text-slate-100">{{ layer.title }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ layer.name }}</p>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Logo: <span class="font-semibold">{{ layer.hasLogo ? 'Egen' : 'Ärvs' }}</span>
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  Accent: <span class="font-semibold">{{ layer.hasAccent ? 'Egen' : 'Ärvs' }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, useRoute } from '#imports'
import { Icon } from '@iconify/vue'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { normalizeLogoUrl } from '~/utils/logo'
import type { BrandingState, BrandingThemeSource } from '~/types/auth'
import { BRANDING_PALETTE, DEFAULT_BRANDING_ACCENT, normalizeHexColor } from '~~/shared/branding'

const route = useRoute()
const tenantId = computed(() => route.params.id as string)

const defaultLogo = defaultLogoAsset
const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccessMessage = ref<string | null>(null)
const brandingDetails = ref<BrandingState | null>(null)
const tenantInfo = ref<{ name: string; type: 'provider' | 'distributor' } | null>(null)
const brandingLoading = ref(false)
const brandingError = ref<string | null>(null)
const accentSaving = ref(false)
const accentStatus = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const accentForm = reactive({
  paletteKey: '',
  customColor: ''
})
const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp']
const maxLogoBytes = 2 * 1024 * 1024
const paletteOptions = BRANDING_PALETTE

watch(
  () => tenantId.value,
  () => {
    fetchBranding()
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
  return tenantInfo.value.type === 'provider' ? 'Leverantör' : 'Distributör'
})

const hasCustomLogo = computed(() => Boolean(brandingDetails.value?.tenantTheme?.logoUrl))
const activeAccentColor = computed(
  () => brandingDetails.value?.activeTheme.accentColor ?? DEFAULT_BRANDING_ACCENT
)
const logoSourceLabel = computed(() => formatSource(brandingDetails.value?.activeTheme.logoSource))
const accentSourceLabel = computed(() => formatSource(brandingDetails.value?.activeTheme.accentSource))
const tenantHasCustomAccent = computed(() =>
  Boolean(brandingDetails.value?.tenantTheme?.accentColor || brandingDetails.value?.tenantTheme?.paletteKey)
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
      title: 'Distributör',
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
    const result = await $fetch<{ logoUrl: string }>(
      `/api/admin/tenants/${tenantId.value}/branding/logo`,
      {
        method: 'POST',
        body: formData,
        credentials: 'include'
      }
    )
    if (result?.logoUrl) {
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
  if (!confirm('Vill du ta bort den anpassade logotypen?')) {
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
  if (!tenantId.value) return
  brandingLoading.value = true
  brandingError.value = null
  try {
    const response = await $fetch<{ branding: BrandingState; tenant: { name: string; type: 'provider' | 'distributor' } }>(
      `/api/admin/tenants/${tenantId.value}/branding`,
      {
        credentials: 'include'
      }
    )
    brandingDetails.value = response.branding
    tenantInfo.value = response.tenant
    const theme = brandingDetails.value?.tenantTheme
    accentForm.paletteKey = theme?.paletteKey ?? ''
    accentForm.customColor = theme?.accentColor ?? ''
  } catch (error: any) {
    brandingError.value =
      error?.data?.message || error?.message || 'Kunde inte hämta brandinginformation.'
  } finally {
    brandingLoading.value = false
  }
}

async function applyPalette(paletteKey: string) {
  accentSaving.value = true
  accentStatus.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { paletteKey }
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

async function saveCustomAccent() {
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
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding`, {
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
  accentSaving.value = true
  accentStatus.value = null
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { accentColor: null, paletteKey: null }
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
  if (!accentStatus.value) return
  const timeout = accentStatus.value.type === 'success' ? 4000 : 6000
  setTimeout(() => {
    accentStatus.value = null
  }, timeout)
}

function formatSource(source?: BrandingThemeSource | null) {
  if (!source || source.targetType === 'default') {
    return 'Standard'
  }
  const label =
    source.targetType === 'organization'
      ? 'Organisation'
      : source.targetType === 'provider'
        ? 'Leverantör'
        : 'Distributör'
  return source.name ? `${label}: ${source.name}` : label
}
</script>

