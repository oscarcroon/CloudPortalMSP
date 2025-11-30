<template>
  <div class="space-y-6">
    <div
      v-for="asset in assetDefinitions"
      :key="asset.key"
      class="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
    >
      <div class="flex flex-col gap-4 md:flex-row">
        <div
          class="flex h-32 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 dark:border-white/10"
          :class="asset.previewClasses"
          :style="assetPreviewStyle(asset.key)"
        >
          <img
            v-if="asset.type !== 'background' && previewUrl(asset.key)"
            :src="previewUrl(asset.key)"
            class="max-h-20 w-auto object-contain drop-shadow"
            :alt="asset.title"
          />
          <span
            v-else-if="asset.type !== 'background'"
            class="text-xs uppercase tracking-[0.3em] text-slate-400"
          >
            Ingen logotyp
          </span>
          <span
            v-else
            class="text-xs uppercase tracking-[0.3em] text-white"
          >
            {{ backgroundLabel }}
          </span>
        </div>
        <div class="flex flex-1 flex-col justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ asset.title }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ asset.description }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button
              class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
              type="button"
              :disabled="assetStates[asset.key].uploading"
              @click="triggerFilePicker(asset.key)"
            >
              {{ assetStates[asset.key].uploading ? 'Laddar upp...' : 'Byt fil' }}
            </button>
            <button
              v-if="assetHasCustomValue(asset.key)"
              class="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
              type="button"
              :disabled="assetStates[asset.key].uploading"
              @click="removeAsset(asset.key)"
            >
              {{ assetStates[asset.key].uploading ? 'Tar bort...' : 'Ta bort' }}
            </button>
            <input
              type="file"
              class="sr-only"
              :accept="asset.accept"
              :ref="(el) => setFileInput(asset.key, el as HTMLInputElement | null)"
              @change="(event) => handleSelection(asset.key, event)"
            />
          </div>
          <div class="space-y-1 text-xs">
            <p class="text-slate-500 dark:text-slate-400">Källa: <span class="font-semibold">{{ assetSourceLabel(asset.key) }}</span></p>
            <p v-if="assetStates[asset.key].error" class="font-semibold text-red-600">
              {{ assetStates[asset.key].error }}
            </p>
            <p v-else-if="assetStates[asset.key].success" class="font-semibold text-emerald-600">
              {{ assetStates[asset.key].success }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
      <div class="flex flex-col gap-2">
        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">Bakgrundstint</p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Ange hex-färg för överlägg på bakgrundsbilden. Lämna tomt för standard.
        </p>
      </div>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <input
          v-model="backgroundTint"
          type="color"
          class="h-12 w-14 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-transparent"
        />
        <input
          v-model="backgroundTint"
          type="text"
          placeholder="#0f172a"
          class="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-transparent dark:text-slate-100"
        />
        <div class="flex flex-col gap-2">
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Intensitet
          </p>
          <div class="flex w-full max-w-xs items-center gap-3">
            <input
              v-model.number="backgroundTintOpacityPercent"
              type="range"
              min="0"
              max="100"
              step="5"
              class="h-2 w-32 flex-1 appearance-none rounded bg-slate-200 accent-brand dark:bg-slate-700"
            />
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ backgroundTintOpacityPercent }}%
            </span>
          </div>
        </div>
        <button
          class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
          type="button"
          :disabled="tintSaving"
          @click="saveBackgroundTint"
        >
          {{ tintSaving ? 'Sparar...' : 'Spara' }}
        </button>
        <button
          v-if="hasCustomTint"
          class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          type="button"
          :disabled="tintSaving"
          @click="resetBackgroundTint"
        >
          Återställ
        </button>
      </div>
      <p v-if="tintStatus" class="mt-2 text-xs font-semibold" :class="tintStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'">
        {{ tintStatus.message }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BrandingState, BrandingThemeSource } from '~/types/auth'
import { DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY } from '~~/shared/branding'

type AssetVariant = 'login-light' | 'login-dark' | 'login-background'

interface AssetDefinition {
  key: AssetVariant
  title: string
  description: string
  type: 'logo' | 'background'
  accept: string
  previewClasses?: string
}

const props = defineProps<{
  mode: 'organization' | 'tenant' | 'global'
  targetId: string
  branding: BrandingState | null
}>()

const emit = defineEmits<{
  (event: 'updated'): void
}>()

const assetDefinitions: AssetDefinition[] = [
  {
    key: 'login-light',
    title: 'Logotyp (ljus bakgrund)',
    description: 'Visas när användaren har ljust tema.',
    type: 'logo',
    accept: '.jpg,.jpeg,.png,.svg,.webp',
    previewClasses: 'bg-slate-50'
  },
  {
    key: 'login-dark',
    title: 'Logotyp (mörk bakgrund)',
    description: 'Visas när användaren har mörkt tema.',
    type: 'logo',
    accept: '.jpg,.jpeg,.png,.svg,.webp',
    previewClasses: 'bg-slate-900'
  },
  {
    key: 'login-background',
    title: 'Bakgrundsbild',
    description: 'Valfri bild som visas bakom login-formuläret.',
    type: 'background',
    accept: '.jpg,.jpeg,.png,.webp',
    previewClasses: 'bg-slate-900 text-white'
  }
]

interface AssetState {
  uploading: boolean
  error: string | null
  success: string | null
}

const assetStates = reactive<Record<AssetVariant, AssetState>>({
  'login-light': { uploading: false, error: null, success: null },
  'login-dark': { uploading: false, error: null, success: null },
  'login-background': { uploading: false, error: null, success: null }
})

const fileInputs = ref<Record<AssetVariant, HTMLInputElement | null>>({
  'login-light': null,
  'login-dark': null,
  'login-background': null
})

const tintSaving = ref(false)
const tintStatus = ref<{ type: 'success' | 'error'; message: string } | null>(null)
const backgroundTint = ref('')

const baseLogoPath = computed(() => {
  if (props.mode === 'organization') {
    return `/api/organizations/${props.targetId}/logo`
  }
  if (props.mode === 'tenant') {
    return `/api/admin/tenants/${props.targetId}/branding/logo`
  }
  return `/api/admin/branding/logo`
})

const brandingUpdatePath = computed(() => {
  if (props.mode === 'organization') {
    return `/api/organizations/${props.targetId}/branding`
  }
  if (props.mode === 'tenant') {
    return `/api/admin/tenants/${props.targetId}/branding`
  }
  return `/api/admin/branding`
})

const localTheme = computed(() => {
  if (props.mode === 'organization') {
    return props.branding?.organizationTheme ?? null
  }
  if (props.mode === 'tenant') {
    return props.branding?.tenantTheme ?? null
  }
  return props.branding?.globalTheme ?? null
})

const hasCustomTint = computed(() => {
  const tint = localTheme.value?.loginBackgroundTint
  const opacity = localTheme.value?.loginBackgroundTintOpacity
  const hasOpacity =
    typeof opacity === 'number' &&
    Math.abs(opacity - DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY) > 0.001
  return Boolean(tint) || hasOpacity
})
const backgroundLabel = computed(() =>
  props.branding?.activeTheme.loginBackgroundUrl ? 'Förhandsvisning' : 'Ingen bakgrund'
)

watch(
  () => localTheme.value?.loginBackgroundTint,
  (value) => {
    backgroundTint.value = value ?? ''
  },
  { immediate: true }
)

const backgroundTintOpacityPercent = ref(
  Math.round(DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY * 100)
)

watch(
  () => props.branding?.activeTheme.loginBackgroundTintOpacity,
  (value) => {
    const numeric =
      typeof value === 'number' ? value : DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY
    backgroundTintOpacityPercent.value = Math.round(numeric * 100)
  },
  { immediate: true }
)

function triggerFilePicker(variant: AssetVariant) {
  assetStates[variant].error = null
  assetStates[variant].success = null
  fileInputs.value[variant]?.click()
}

function setFileInput(variant: AssetVariant, input: HTMLInputElement | null) {
  fileInputs.value[variant] = input
}

function previewUrl(variant: AssetVariant) {
  const theme = props.branding?.activeTheme
  if (!theme) return null
  if (variant === 'login-light') {
    return (
      theme.loginLogoLightUrl ??
      theme.appLogoLightUrl ??
      theme.logoUrl
    )
  }
  if (variant === 'login-dark') {
    return (
      theme.loginLogoDarkUrl ??
      theme.loginLogoLightUrl ??
      theme.appLogoDarkUrl ??
      theme.appLogoLightUrl ??
      theme.logoUrl
    )
  }
  return theme.loginBackgroundUrl ?? null
}

function assetSourceLabel(variant: AssetVariant) {
  const theme = props.branding?.activeTheme
  const source =
    variant === 'login-background'
      ? theme?.loginBackgroundSource
      : theme?.loginLogoSource
  return formatSource(source)
}

function formatSource(source?: BrandingThemeSource | null) {
  if (!source) {
    return 'Standard'
  }
  if (source.targetType === 'default') {
    return 'Global standard'
  }
  if (source.targetType === 'global') {
    return 'Global'
  }
  return source.name ?? source.targetType
}

function assetHasCustomValue(variant: AssetVariant) {
  const field = variantFieldMap[variant]
  return Boolean(localTheme.value && (localTheme.value as any)[field])
}

const variantFieldMap: Record<AssetVariant, keyof NonNullable<BrandingState['activeTheme']>> = {
  'login-light': 'loginLogoLightUrl',
  'login-dark': 'loginLogoDarkUrl',
  'login-background': 'loginBackgroundUrl'
}

function assetPreviewStyle(variant: AssetVariant) {
  if (variant !== 'login-background') {
    return {}
  }
  const url = previewUrl(variant)
  if (!url) {
    return {}
  }
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }
}

async function handleSelection(variant: AssetVariant, event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  const file = input.files[0]
  assetStates[variant].error = null
  assetStates[variant].success = null

  const validationError = validateFile(variant, file)
  if (validationError) {
    assetStates[variant].error = validationError
    input.value = ''
    return
  }

  assetStates[variant].uploading = true
  try {
    const formData = new FormData()
    formData.append('logo', file)
    await $fetch(`${baseLogoPath.value}?variant=${variant}`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    assetStates[variant].success = 'Uppdaterad.'
    emit('updated')
  } catch (error: any) {
    assetStates[variant].error =
      error?.data?.message || error?.message || 'Uppladdningen misslyckades.'
  } finally {
    assetStates[variant].uploading = false
    input.value = ''
    scheduleStatusClear(variant)
  }
}

async function removeAsset(variant: AssetVariant) {
  if (!confirm('Vill du ta bort denna fil?')) {
    return
  }
  assetStates[variant].uploading = true
  assetStates[variant].error = null
  assetStates[variant].success = null
  try {
    await $fetch(`${baseLogoPath.value}?variant=${variant}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    assetStates[variant].success = 'Borttagen.'
    emit('updated')
  } catch (error: any) {
    assetStates[variant].error =
      error?.data?.message || error?.message || 'Kunde inte ta bort filen.'
  } finally {
    assetStates[variant].uploading = false
    scheduleStatusClear(variant)
  }
}

function validateFile(variant: AssetVariant, file: File) {
  const maxBytes = variant === 'login-background' ? 5 * 1024 * 1024 : 2 * 1024 * 1024
  const extension = file.name.split('.').pop()?.toLowerCase()
  const allowed = variant === 'login-background'
    ? ['jpg', 'jpeg', 'png', 'webp']
    : ['jpg', 'jpeg', 'png', 'svg', 'webp']
  if (!extension || !allowed.includes(extension)) {
    return `Ogiltigt format. Tillåtna: ${allowed.join(', ')}.`
  }
  if (file.size > maxBytes) {
    return `Filen får vara max ${variant === 'login-background' ? '5' : '2'} MB.`
  }
  return null
}

function scheduleStatusClear(variant: AssetVariant) {
  setTimeout(() => {
    assetStates[variant].success = null
  }, 4000)
  setTimeout(() => {
    assetStates[variant].error = null
  }, 6000)
}

async function saveBackgroundTint() {
  tintSaving.value = true
  tintStatus.value = null
  try {
    await $fetch(brandingUpdatePath.value, {
      method: 'PUT',
      body: {
        loginBackgroundTint: backgroundTint.value || null,
        loginBackgroundTintOpacity: backgroundTintOpacityPercent.value / 100
      },
      credentials: 'include'
    })
    tintStatus.value = { type: 'success', message: 'Bakgrundstint sparades.' }
    emit('updated')
  } catch (error: any) {
    tintStatus.value = {
      type: 'error',
      message: error?.data?.message || error?.message || 'Kunde inte spara tint.'
    }
  } finally {
    tintSaving.value = false
  }
}

async function resetBackgroundTint() {
  backgroundTint.value = ''
  backgroundTintOpacityPercent.value = Math.round(
    DEFAULT_LOGIN_BACKGROUND_TINT_OPACITY * 100
  )
  await saveBackgroundTint()
}

</script>

