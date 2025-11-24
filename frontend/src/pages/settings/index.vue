<template>
  <section class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Administration</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Inställningar</h1>
    </header>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:office-building-outline" class="h-6 w-6 text-brand" />
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Organisationer</h2>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Byt aktiv organisation och se roller.</p>
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
              {{ org.id === auth.state.value.data?.currentOrgId ? 'Aktiv' : 'Välj' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:account-group-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Medlemmar</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Lista alla medlemmar i organisationen och hantera roller.
            </p>
          </div>
          <NuxtLink
            to="/settings/members"
            class="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200"
          >
            Öppna
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• Se status för aktiva och väntande medlemmar</li>
          <li>• Uppdatera roller för owner, admin och member</li>
          <li>• Ta bort åtkomst för användare som lämnar</li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:shield-lock-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Auth &amp; SSO</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Aktivera Identity Provider, konfigurera OpenID eller Entra och styr om SSO ska krävas.
            </p>
          </div>
          <NuxtLink
            to="/settings/auth"
            class="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200"
          >
            Öppna
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• Välj IdP-typ (OpenID eller Entra AD)</li>
          <li>• Följ guiden för att konfigurera Cloudflare Access</li>
          <li>• Aktivera “Kräv SSO” när IdP är klar</li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:email-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">E-postoverride</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Ställ in organisationens egen SMTP- eller Graph-provider, inklusive branding och testutskick.
            </p>
          </div>
          <NuxtLink
            to="/settings/email"
            class="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200"
          >
            Öppna
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• Aktivera override för utskick inom organisationen</li>
          <li>• Konfigurera SMTP med eller utan auth, eller Microsoft Graph</li>
          <li>• Anpassa logotyp, färger och testkör direkt från formuläret</li>
        </ul>
      </div>

      <div class="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:palette-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Branding</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Byt logotyp för den aktiva organisationen.</p>
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
              <button
                v-if="hasCustomLogo"
                class="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                type="button"
                :disabled="isUploading || !auth.currentOrg.value"
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
        <div class="flex items-center gap-3">
          <Icon icon="mdi:key-outline" class="h-6 w-6 text-brand" />
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">API tokens</h2>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Hantera autentisering mot externa leverantörer.</p>
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
import { Icon } from '@iconify/vue'
import defaultLogoAsset from '~/assets/images/coreit-logo-neg.svg'
import { useAuth } from '~/composables/useAuth'
import { normalizeLogoUrl } from '~/utils/logo'

const auth = useAuth()
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

const currentLogo = computed(() => {
  const orgLogoUrl = auth.currentOrg.value?.logoUrl
  const normalized = normalizeLogoUrl(orgLogoUrl)
  return normalized ?? defaultLogo
})
const hasCustomLogo = computed(() => {
  const orgLogoUrl = auth.currentOrg.value?.logoUrl
  return Boolean(orgLogoUrl && normalizeLogoUrl(orgLogoUrl))
})
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
  uploadError.value = null
  uploadSuccessMessage.value = null
  
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
    } else {
      uploadError.value = 'Kunde inte ladda upp logotypen. Inget svar från servern.'
    }
  } catch (error: any) {
    console.error('[logo-upload] Error:', error)
    const errorMessage = error?.data?.message || error?.message || 'Kunde inte ladda upp logotypen.'
    uploadError.value = errorMessage
  } finally {
    isUploading.value = false
    target.value = ''
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
}

async function removeLogo() {
  const activeOrgId = auth.state.value.data?.currentOrgId
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
  } catch (error: any) {
    console.error('[logo-remove] Error:', error)
    const errorMessage = error?.data?.message || error?.message || 'Kunde inte ta bort logotypen.'
    uploadError.value = errorMessage
  } finally {
    isUploading.value = false
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
}
</script>

