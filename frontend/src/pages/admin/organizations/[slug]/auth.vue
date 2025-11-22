<template>
  <section class="space-y-8">
    <header>
      <NuxtLink to="/admin/organizations" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        ← Tillbaka till listan
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Autentisering & SSO</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Styr hur organisationen loggar in och om självregistrering är aktiverad.</p>
    </header>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="pending" class="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      Laddar autentiseringsinställningar...
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSave">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Säkerhetsregler</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Aktivera SSO och kontrollera om självregistrering ska vara tillåten.</p>
          </div>
          <button
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="saving"
          >
            {{ saving ? 'Sparar...' : 'Spara' }}
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="auth-require-sso" v-model="form.requireSso" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="auth-require-sso" class="text-sm text-slate-700 dark:text-slate-200">
              Kräv SSO för alla användare
            </label>
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="auth-self-signup" v-model="form.allowSelfSignup" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="auth-self-signup" class="text-sm text-slate-700 dark:text-slate-200">
              Tillåt självregistrering
            </label>
          </div>
          <div class="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
            <input id="auth-owner-local" v-model="form.allowLocalLoginForOwners" type="checkbox" class="rounded border-slate-300 dark:border-white/20" />
            <label for="auth-owner-local" class="text-sm text-slate-700 dark:text-slate-200">
              Tillåt lokalt login för ägare
            </label>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Identity Provider</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Välj IdP-typ och ange eventuell konfiguration. Funktionaliteten är en stub tills SAML/OIDC integreras fullt ut.</p>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">IdP-typ</label>
            <select
              v-model="form.idpType"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option value="none">Ingen</option>
              <option value="saml">SAML</option>
              <option value="oidc">OIDC</option>
            </select>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">IdP-konfiguration (JSON)</label>
            <textarea
              v-model="form.idpConfig"
              rows="5"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder='ex: {"issuer":"https://login.example.com"}'
            />
          </div>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, watch } from '#imports'
import type { AdminOrganizationDetail, AdminUpdateAuthSettingsPayload } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const saving = ref(false)
const errorMessage = ref('')

const form = reactive({
  requireSso: false,
  allowSelfSignup: false,
  allowLocalLoginForOwners: true,
  idpType: 'none',
  idpConfig: ''
})

const parseIdpConfig = (value: unknown) => {
  if (!value) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

const { data, pending, refresh, error } = await useFetch<AdminOrganizationDetail>(
  `/api/admin/organizations/${slug.value}`,
  {
    watch: [slug]
  }
)

if (error.value) {
  errorMessage.value = error.value.message
}

const populateForm = () => {
  if (!data.value) return
  const { organization, authSettings } = data.value
  form.requireSso = organization.requireSso
  form.allowSelfSignup = organization.allowSelfSignup
  form.allowLocalLoginForOwners = authSettings.allowLocalLoginForOwners
  form.idpType = authSettings.idpType
  form.idpConfig = parseIdpConfig(authSettings.idpConfig)
}

watch(
  () => data.value,
  () => {
    populateForm()
  },
  { immediate: true }
)

const handleSave = async () => {
  saving.value = true
  errorMessage.value = ''
  let parsedConfig: Record<string, unknown> | null = null
  if (form.idpConfig.trim()) {
    try {
      parsedConfig = JSON.parse(form.idpConfig)
    } catch (err) {
      errorMessage.value = 'IdP-konfigurationen måste vara giltig JSON.'
      saving.value = false
      return
    }
  }

  const payload: AdminUpdateAuthSettingsPayload = {
    requireSso: form.requireSso,
    allowSelfSignup: form.allowSelfSignup,
    allowLocalLoginForOwners: form.allowLocalLoginForOwners,
    idpType: form.idpType,
    idpConfig: parsedConfig
  }

  try {
    await $fetch(`/api/admin/organizations/${slug.value}/auth`, {
      method: 'PATCH',
      body: payload
    })
    await refresh()
    populateForm()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte uppdatera auth-inställningarna.'
  } finally {
    saving.value = false
  }
}
</script>

