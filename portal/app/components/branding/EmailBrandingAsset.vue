<template>
  <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
    <div class="flex items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <Icon icon="mdi:email-outline" class="h-6 w-6 text-brand" />
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ t('settings.branding.emailBranding.title') }}
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ t('settings.branding.emailBranding.description') }}
          </p>
        </div>
      </div>
    </div>

    <div class="mt-4 space-y-4">
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="space-y-4">
          <div
            class="flex h-32 w-full max-w-sm items-center justify-center rounded-xl border border-dashed border-white/10 px-4 text-white"
            :style="{ backgroundColor: navigationBackgroundColor }"
          >
            <img
              v-if="previewLogo"
              :src="previewLogo"
              :alt="t('settings.branding.emailBranding.previewAlt')"
              class="max-h-20 w-auto object-contain"
            />
            <span v-else class="text-xs uppercase tracking-[0.3em] text-slate-400">
              {{ t('settings.branding.emailBranding.noLogo') }}
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ statusLabel }}
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <button
              class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
              type="button"
              :disabled="isUploading"
              @click="triggerFilePicker"
            >
              {{ isUploading ? t('settings.branding.emailBranding.uploading') : t('settings.branding.emailBranding.upload') }}
            </button>
            <button
              v-if="hasEmailLogo"
              class="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
              type="button"
              :disabled="isUploading"
              @click="removeLogo"
            >
              {{ isUploading ? t('settings.branding.emailBranding.removing') : t('settings.branding.emailBranding.remove') }}
            </button>
            <input
              ref="fileInputRef"
              type="file"
              class="sr-only"
              accept=".jpg,.jpeg,.png,.webp"
              @change="handleFileSelection"
            />
          </div>
          <p v-if="uploadError" class="text-xs font-semibold text-red-600">
            {{ uploadError }}
          </p>
          <p v-else-if="uploadSuccess" class="text-xs font-semibold text-emerald-600">
            {{ uploadSuccess }}
          </p>
          <p class="text-xs text-slate-400 dark:text-slate-500">
            {{ t('settings.branding.emailBranding.helper') }}
          </p>
        </div>

        <div class="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
          <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {{ t('settings.branding.emailBranding.reasonTitle') }}
          </p>
          <ul class="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <li class="flex items-start gap-2">
              <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{{ t('settings.branding.emailBranding.reasonOutlookSvg') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{{ t('settings.branding.emailBranding.reasonUniversal') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{{ t('settings.branding.emailBranding.reasonSeparate') }}</span>
            </li>
            <li class="flex items-start gap-2">
              <Icon icon="mdi:information" class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <span>{{ t('settings.branding.emailBranding.reasonFallback') }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref, useI18n } from '#imports'
import { normalizeLogoUrl } from '~/utils/logo'
import type { BrandingState } from '~/types/auth'
import { DEFAULT_NAV_BACKGROUND } from '~~/shared/branding'

const props = defineProps<{
  mode: 'organization' | 'tenant' | 'global'
  targetId: string
  branding: BrandingState | null
}>()

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'updated'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccess = ref<string | null>(null)

const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp']
const maxLogoBytes = 2 * 1024 * 1024

const basePath = computed(() => {
  if (props.mode === 'organization') {
    return `/api/organizations/${props.targetId}/logo`
  }
  if (props.mode === 'tenant') {
    return `/api/admin/tenants/${props.targetId}/branding/logo`
  }
  return `/api/admin/branding/logo`
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

const hasEmailLogo = computed(() => Boolean(localTheme.value?.emailLogoUrl))

const currentEmailLogo = computed(() => {
  const emailLogo = localTheme.value?.emailLogoUrl
  if (emailLogo) {
    return normalizeLogoUrl(emailLogo)
  }
  return null
})

const fallbackLogo = computed(() => {
  const logo =
    props.branding?.activeTheme.appLogoLightUrl ??
    props.branding?.activeTheme.logoUrl ??
    null
  return normalizeLogoUrl(logo)
})

const previewLogo = computed(() => currentEmailLogo.value ?? fallbackLogo.value ?? null)
const usesFallbackLogo = computed(() => !currentEmailLogo.value && Boolean(fallbackLogo.value))
const statusLabel = computed(() => {
  if (hasEmailLogo.value) {
    return t('settings.branding.emailBranding.customLabel')
  }
  if (usesFallbackLogo.value) {
    return t('settings.branding.emailBranding.usesAppLogo')
  }
  return t('settings.branding.emailBranding.noLogo')
})

const navigationBackgroundColor = computed(
  () => props.branding?.activeTheme.navigationBackgroundColor ?? DEFAULT_NAV_BACKGROUND
)

function triggerFilePicker() {
  uploadError.value = null
  uploadSuccess.value = null
  fileInputRef.value?.click()
}

function validateFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !allowedExtensions.includes(extension)) {
    return t('settings.branding.emailBranding.invalidFormat')
  }
  if (file.size > maxLogoBytes) {
    return t('settings.branding.emailBranding.fileTooLarge')
  }
  return null
}

async function handleFileSelection(event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return

  const file = target.files[0]
  if (!file) return
  uploadError.value = null
  uploadSuccess.value = null

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
    await ($fetch as any)(`${basePath.value}?variant=email-logo`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })
    uploadSuccess.value = t('settings.branding.emailBranding.updated')
    emit('updated')
  } catch (error: any) {
    uploadError.value =
      error?.data?.message || error?.message || t('settings.branding.emailBranding.uploadError')
  } finally {
    isUploading.value = false
    target.value = ''
    scheduleStatusClear()
  }
}

async function removeLogo() {
  if (!confirm(t('settings.branding.emailBranding.removeConfirm'))) {
    return
  }
  isUploading.value = true
  uploadError.value = null
  uploadSuccess.value = null
  try {
    await ($fetch as any)(`${basePath.value}?variant=email-logo`, {
      method: 'DELETE',
      credentials: 'include'
    })
    uploadSuccess.value = t('settings.branding.emailBranding.removed')
    emit('updated')
  } catch (error: any) {
    uploadError.value =
      error?.data?.message || error?.message || t('settings.branding.emailBranding.removeError')
  } finally {
    isUploading.value = false
    scheduleStatusClear()
  }
}

function scheduleStatusClear() {
  if (uploadSuccess.value) {
    setTimeout(() => {
      uploadSuccess.value = null
    }, 4000)
  }
  if (uploadError.value) {
    setTimeout(() => {
      uploadError.value = null
    }, 6000)
  }
}
</script>
