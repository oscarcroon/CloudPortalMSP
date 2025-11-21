<template>
  <section class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Administration</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Inställningar</h1>
    </header>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Organisationer</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Byt aktiv organisation och se roller.</p>
        <ul class="mt-4 space-y-3">
          <li
            v-for="org in auth.organizations.value"
            :key="org.id"
            class="flex items-center justify-between rounded-xl border px-4 py-3"
            :class="
              org.id === auth.state.value.data?.currentOrgId
                ? 'border-brand bg-brand-light/40 dark:border-brand/70 dark:bg-brand/10'
                : 'border-slate-200 dark:border-slate-700 dark:bg-slate-900/40'
            "
          >
            <div>
              <p class="font-semibold text-slate-900 dark:text-slate-100">{{ org.name }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Roll: {{ org.role }}</p>
            </div>
            <button
              class="rounded-full border border-slate-200 px-3 py-1 text-xs transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              @click="auth.switchOrganization(org.id)"
            >
              Aktivera
            </button>
          </li>
        </ul>
      </div>

      <div class="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Branding</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Byt logotyp för den aktiva organisationen.</p>
          </div>
          <span class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Max 2 MB</span>
        </div>

        <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div
            class="flex h-24 w-full max-w-xs items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#0f1c2f] px-4 text-white"
          >
            <img
              :src="currentLogo"
              :alt="`Logo preview for ${activeOrganisationName}`"
              class="max-h-14 w-auto object-contain"
            />
          </div>

          <div class="flex flex-1 flex-col gap-3">
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Tillåtna format: .jpg, .png, .svg och .webp. Bilden skalas automatiskt så att navigationen
              behåller sitt utseende.
            </p>

            <div class="flex flex-wrap items-center gap-3">
              <button
                class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-brand/40"
                type="button"
                :disabled="isUploading || !auth.currentOrg.value"
                @click="triggerFilePicker"
              >
                {{ isUploading ? 'Laddar upp...' : 'Byt logotyp' }}
              </button>
              <input
                ref="logoInputRef"
                type="file"
                class="sr-only"
                accept=".jpg,.jpeg,.png,.svg,.webp"
                @change="handleLogoSelection"
              />
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Aktiv: {{ activeOrganisationName }}
              </span>
            </div>

            <p v-if="uploadError" class="text-xs font-semibold text-red-600">
              {{ uploadError }}
            </p>
            <p v-else-if="uploadSuccessMessage" class="text-xs font-semibold text-emerald-600">
              {{ uploadSuccessMessage }}
            </p>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">API tokens</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Hantera autentisering mot externa leverantörer.</p>
        <div class="mt-4 space-y-3">
          <div
            v-for="token in tokens"
            :key="token.name"
            class="rounded-xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-600 dark:bg-slate-900/40"
          >
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ token.name }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ token.description }}</p>
            <button class="mt-2 text-xs font-semibold text-brand hover:text-brand-dark dark:text-brand-light">
              Konfigurera
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { useAuth } from '~/composables/useAuth'
import { useApiClient } from '~/composables/useApiClient'

const auth = useAuth()
const api = useApiClient()
const defaultLogo = defaultLogoAsset
const logoInputRef = ref<HTMLInputElement | null>(null)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccessMessage = ref<string | null>(null)
const allowedExtensions = ['jpg', 'jpeg', 'png', 'svg', 'webp']
const maxLogoBytes = 2 * 1024 * 1024

const tokens = [
  { name: 'Cloudflare API Token', description: 'DNS edit, zone read' },
  { name: 'Incus Client Cert', description: 'Projekt access per tenant' },
  { name: 'ESXi/Morpheus Service Account', description: 'VM control plane' },
  { name: 'WordPress Management Token', description: 'REST Application password' }
]

const currentLogo = computed(() => auth.currentOrg.value?.logoUrl ?? defaultLogo)
const activeOrganisationName = computed(() => auth.currentOrg.value?.name ?? 'CoreIT')

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

  const activeOrgId = auth.state.value.data?.currentOrgId
  if (!activeOrgId) {
    uploadError.value = 'Ingen aktiv organisation vald.'
    target.value = ''
    return
  }

  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('logo', file)
    await api(`/organisations/${activeOrgId}/logo`, {
      method: 'POST',
      body: formData
    })
    uploadSuccessMessage.value = 'Logotypen uppdaterades.'
    await auth.fetchMe()
  } catch (error) {
    uploadError.value =
      error instanceof Error ? error.message : 'Kunde inte ladda upp logotypen.'
  } finally {
    isUploading.value = false
    target.value = ''
    if (uploadSuccessMessage.value) {
      setTimeout(() => {
        uploadSuccessMessage.value = null
      }, 4000)
    }
  }
}
</script>

