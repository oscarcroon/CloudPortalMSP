<template>
  <section class="space-y-6">
    <NuxtLink
      to="/settings"
      class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
    >
      ← Inställningar
    </NuxtLink>

    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Branding</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Branding & login</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Hantera logotyper, accentfärg och login-branding för {{ activeOrganisationName }}.
      </p>
    </div>

    <div v-if="!showContent" class="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
      Hämtar organisationsinformation...
    </div>

    <div v-else class="space-y-6">
      <div
        v-if="isSettingsLocked"
        class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
      >
        Välj en aktiv organisation för att kunna ändra branding.
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
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">App-branding</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Styr logotyp och accentfärg som visas i hela portalen.
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
              Hämtar brandinginformation...
            </div>
            <div v-else class="space-y-6">
              <div class="grid gap-6 lg:grid-cols-2">
                <div class="space-y-4">
                  <div
                    class="flex h-32 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0f1c2f] px-4 text-white"
                  >
                    <img :src="currentLogo" :alt="`Logo preview for ${activeOrganisationName}`" class="max-h-20 w-auto object-contain" />
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
                          brandingDetails?.organizationTheme?.paletteKey === option.key
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
                        v-if="organizationHasCustomAccent"
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
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Login-branding</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Ladda upp separata logotyper (ljus/mörk) och bakgrundsbild för inloggningssidan.
                </p>
              </div>
            </div>
          </div>
          <p class="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Branding väljs automatiskt baserat på host (slug eller verifierad custom domain) och ärver från leverantör/distributör.
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
import LoginBrandingAssets from '~/components/branding/LoginBrandingAssets.vue'
import { normalizeLogoUrl } from '~/utils/logo'
import type { BrandingState, BrandingThemeSource } from '~/types/auth'
import { BRANDING_PALETTE, DEFAULT_BRANDING_ACCENT, normalizeHexColor } from '~~/shared/branding'

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
const accentForm = reactive({
  paletteKey: '',
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

const logoSourceLabel = computed(() =>
  formatBrandingSource(brandingDetails.value?.activeTheme.logoSource ?? auth.branding.value?.activeTheme.logoSource)
)
const accentSourceLabel = computed(() =>
  formatBrandingSource(brandingDetails.value?.activeTheme.accentSource ?? auth.branding.value?.activeTheme.accentSource)
)

const organizationHasCustomAccent = computed(() =>
  Boolean(brandingDetails.value?.organizationTheme?.accentColor || brandingDetails.value?.organizationTheme?.paletteKey)
)

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

  const activeOrgId = currentOrgId.value
  if (!activeOrgId) {
    uploadError.value = 'Ingen aktiv organisation vald.'
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
      uploadSuccessMessage.value = 'Logotypen uppdaterades.'
      await auth.fetchMe()
      await refreshBranding()
    } else {
      uploadError.value = 'Kunde inte ladda upp logotypen. Inget svar från servern.'
    }
  } catch (error: any) {
    const errorMessage = error?.data?.message || error?.message || 'Kunde inte ladda upp logotypen.'
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
    uploadError.value = 'Ingen aktiv organisation vald.'
    return
  }

  if (!confirm('Vill du ta bort den anpassade logotypen? Standardlogotypen kommer att användas istället.')) {
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
    uploadSuccessMessage.value = 'Logotypen togs bort.'
    await auth.fetchMe()
    await refreshBranding()
  } catch (error: any) {
    const errorMessage = error?.data?.message || error?.message || 'Kunde inte ta bort logotypen.'
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
    accentForm.paletteKey = theme?.paletteKey ?? ''
    accentForm.customColor = theme?.accentColor ?? ''
  } catch (error: any) {
    brandingError.value = error?.data?.message || error?.message || 'Kunde inte hämta brandinginformation.'
  } finally {
    brandingLoading.value = false
  }
}

async function applyPalette(paletteKey: string) {
  const activeOrgId = currentOrgId.value
  if (!activeOrgId || accentSaving.value) {
    return
  }
  accentSaving.value = true
  accentStatus.value = null
  try {
    await $fetch(`/api/organizations/${activeOrgId}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { paletteKey }
    })
    await auth.fetchMe()
    await refreshBranding()
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
  const activeOrgId = currentOrgId.value
  if (!activeOrgId || accentSaving.value) {
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
    await $fetch(`/api/organizations/${activeOrgId}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { accentColor: normalized }
    })
    await auth.fetchMe()
    await refreshBranding()
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
  const activeOrgId = currentOrgId.value
  if (!activeOrgId || accentSaving.value) {
    return
  }
  accentSaving.value = true
  accentStatus.value = null
  try {
    await $fetch(`/api/organizations/${activeOrgId}/branding`, {
      method: 'PUT',
      credentials: 'include',
      body: { accentColor: null, paletteKey: null }
    })
    await auth.fetchMe()
    await refreshBranding()
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

function formatBrandingSource(source?: BrandingThemeSource | null) {
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

