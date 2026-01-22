<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/tenant-admin"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Auth &amp; SSO</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Välj Identity Provider, följ guiden och styr om SSO ska krävas för organisationen.
        </p>
      </div>
    </header>

    <OrganizationTabs :slug="slug" active="auth" />

    <div
      v-if="pending"
      class="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-[#0c1524] dark:text-slate-300"
    >
      Hämtar auth-inställningar...
    </div>

    <div
      v-else-if="errorMessage && !organization"
      class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200"
    >
      {{ errorMessage }}
    </div>

    <form
      v-else-if="organization"
      class="space-y-6"
      @submit.prevent="handleSave"
    >
      <div
        v-if="successMessage"
        class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200"
      >
        {{ successMessage }}
      </div>
      <div
        v-if="errorMessage"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200"
      >
        {{ errorMessage }}
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisation</p>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ organization.name }}</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Slug: {{ organization.slug }}</p>
          </div>
          <button
            type="submit"
            class="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand/85 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? 'Sparar...' : 'Spara ändringar' }}
          </button>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
            <input
              id="admin-auth-require-sso"
              v-model="form.requireSso"
              type="checkbox"
              class="rounded border-slate-300 dark:border-white/20"
              :disabled="requireSsoDisabled"
            />
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Kräv SSO</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Alla användare måste logga in via vald IdP.
              </p>
              <p v-if="requireSsoDisabled" class="text-xs text-amber-600 dark:text-amber-300">
                {{ requireSsoDisabledMessage }}
              </p>
            </div>
          </label>

          <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
            <input
              id="admin-auth-owner-local"
              v-model="form.allowLocalLoginForOwners"
              type="checkbox"
              class="rounded border-slate-300 dark:border-white/20"
            />
            <div>
              <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Tillåt lokalt login för ägare</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">Behåll fallback via lösenord för ägare.</p>
            </div>
          </label>
        </div>

      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Identity Provider</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Välj vilken IdP som ska vara aktiv och fyll i OIDC-detaljer. Organisationen kan endast ha en IdP åt gången.
          </p>
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-3">
          <label
            v-for="option in providerOptions"
            :key="option.value"
            class="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition cursor-pointer"
            :class="
              form.idpProvider === option.value
                ? 'border-brand bg-brand/5 text-brand dark:border-brand/80 dark:text-brand-light'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800/50'
            "
          >
            <input
              type="radio"
              name="idpProvider"
              :value="option.value"
              v-model="form.idpProvider"
              class="text-brand focus:ring-brand"
            />
            <IconifyIcon
              :icon="option.icon"
              class="h-5 w-5 flex-shrink-0"
            />
            <span class="font-semibold">{{ option.label }}</span>
          </label>
        </div>

        <div v-if="form.idpProvider !== 'none'" class="mt-6 space-y-4">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Fyll i uppgifterna enligt guiden. Redirect-URL för denna organisation:
            <code class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-white/10 dark:text-slate-200">{{ redirectUriHint }}</code>
          </p>

          <div v-if="form.idpProvider === 'openid'" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Issuer (Discovery URL)</label>
              <input
                v-model="form.openid.issuer"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Metadata URL (valfri)</label>
              <input
                v-model="form.openid.metadataUrl"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com/.well-known/openid-configuration"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Client ID</label>
              <input
                v-model="form.openid.clientId"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Client Secret</label>
              <input
                v-model="form.openid.clientSecret"
                type="password"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Redirect URL</label>
              <input
                v-model="form.openid.redirectUri"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                :placeholder="redirectUriHint"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Scopes (valfri)</label>
              <input
                v-model="form.openid.scopes"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="openid email profile"
              />
            </div>
          </div>

          <div v-else-if="form.idpProvider === 'entra'" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tenant ID</label>
              <input
                v-model="form.entra.tenantId"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Client ID</label>
              <input
                v-model="form.entra.clientId"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Client Secret</label>
              <input
                v-model="form.entra.clientSecret"
                type="password"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Redirect URL</label>
              <input
                v-model="form.entra.redirectUri"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                :placeholder="redirectUriHint"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Scopes (valfri)</label>
              <input
                v-model="form.entra.scopes"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="openid email profile offline_access"
              />
            </div>
          </div>
          <div v-else-if="form.idpProvider === 'saml'" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Entry Point (SSO URL)</label>
              <input
                v-model="form.saml.entryPoint"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com/saml/login"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Issuer (Entity ID)</label>
              <input
                v-model="form.saml.issuer"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://idp.example.com/metadata"
              />
            </div>
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Audience (valfri)</label>
              <input
                v-model="form.saml.audience"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="https://customer-portal.example.com"
              />
            </div>
            <div class="md:col-span-2">
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Publikt certifikat</label>
              <textarea
                v-model="form.saml.certificate"
                rows="5"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-[#0f172a] dark:text-white"
                placeholder="-----BEGIN CERTIFICATE-----"
              />
            </div>
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
              <input
                v-model="form.saml.signRequest"
                type="checkbox"
                class="rounded border-slate-300 dark:border-white/20"
              />
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Signera AuthnRequest</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Rekommenderas: IdP förväntar sig signerade requests.</p>
              </div>
            </label>
            <label class="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-white/10">
              <input
                v-model="form.saml.wantAssertionsSigned"
                type="checkbox"
                class="rounded border-slate-300 dark:border-white/20"
              />
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Kräv signerade assertioner</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">Säkerställer att IdP signerar svaren.</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div v-if="form.idpProvider !== 'none'" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#101932]">
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Konfigurationsguide</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Snabbguide för att konfigurera {{ selectedGuide?.title || 'din valda IdP' }}.
          </p>
        </div>

        <div v-if="selectedGuide" class="mt-4">
          <article class="rounded-xl border border-brand bg-brand/5 p-4 dark:border-brand/60">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-base font-semibold text-slate-900 dark:text-white">{{ selectedGuide.title }}</h3>
              <NuxtLink
                :to="selectedGuide.localDocUrl"
                class="text-xs font-semibold text-brand hover:underline"
              >
                Läs mer i docs
              </NuxtLink>
            </div>
            <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li v-for="step in selectedGuide.steps" :key="step">
                {{ step }}
              </li>
            </ol>
          </article>
        </div>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { Icon as IconifyIcon } from '@iconify/vue'
import { computed, reactive, ref, useFetch, useRoute, useRuntimeConfig, watch } from '#imports'
import OrganizationTabs from '~/components/admin/OrganizationTabs.vue'
import type { AdminOrganizationDetail } from '~/types/admin'

definePageMeta({
  layout: 'default'
  // API endpoint validates tenant permissions
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const errorMessage = ref('')
const successMessage = ref('')
const saving = ref(false)

const providerOptions = [
  { value: 'none', label: 'Ingen IdP', icon: 'mdi:cancel' },
  { value: 'openid', label: 'OpenID Connect', icon: 'simple-icons:openid' },
  { value: 'entra', label: 'Microsoft Entra ID', icon: 'simple-icons:microsoftazure' },
  { value: 'saml', label: 'SAML 2.0', icon: 'mdi:shield-lock' }
] as const

const form = reactive({
  requireSso: false,
  allowLocalLoginForOwners: true,
  idpProvider: 'none' as 'none' | 'openid' | 'entra' | 'saml',
  openid: {
    issuer: '',
    metadataUrl: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scopes: ''
  },
  entra: {
    tenantId: '',
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scopes: ''
  },
  saml: {
    entryPoint: '',
    issuer: '',
    certificate: '',
    audience: '',
    signRequest: true,
    wantAssertionsSigned: true
  }
})

const { data, pending, refresh, error } = await useFetch<AdminOrganizationDetail>(
  `/api/admin/organizations/${slug.value}`,
  {
    watch: [slug],
    server: true
  }
)

watch(
  error,
  (value) => {
    if (!value) return
    errorMessage.value = value.message ?? 'Kunde inte hämta auth-inställningar.'
  },
  { immediate: true }
)

const organization = computed(() => data.value?.organization ?? null)
const runtimeConfig = useRuntimeConfig()

const normalizeRedirectBase = () => {
  if (process.client && typeof window !== 'undefined') {
    return window.location.origin
  }
  const publicUrl = runtimeConfig.public?.appBase ?? runtimeConfig.public?.siteUrl
  return typeof publicUrl === 'string' && publicUrl.length > 0 ? publicUrl : ''
}

const redirectUriHint = computed(() => {
  const slugValue = organization.value?.slug ?? ':slug'
  const base = normalizeRedirectBase()
  if (!base) {
    return `/api/auth/sso/${slugValue}/callback`
  }
  return `${base.replace(/\/$/, '')}/api/auth/sso/${slugValue}/callback`
})

const providerGuides = computed(() => {
  const redirect = redirectUriHint.value
  return [
    {
      provider: 'openid',
      title: 'OpenID Connect (OneLogin m.fl.)',
      localDocUrl: '/docs/auth/openid',
      docUrl: 'https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/onelogin-oidc/',
      steps: [
        'Skapa en ny OIDC-app i din IdP (t.ex. OneLogin) och välj Web-klient.',
        `Ange ${redirect} som Redirect URL i din IdP.`,
        'Kopiera Issuer/Discovery URL, Client ID och Client Secret från IdP:n.',
        'Fyll i dessa värden i CloudPortal under Auth-inställningar för din organisation.',
        'Testa inloggningen innan du aktiverar "Kräv SSO" i CloudPortal.'
      ],
      summary:
        'Följ guiden för att konfigurera OIDC med din IdP och fyll i värdena i CloudPortal.'
    },
    {
      provider: 'entra',
      title: 'Microsoft Entra ID (Azure AD)',
      localDocUrl: '/docs/auth/entra',
      docUrl: 'https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/entra-id/',
      steps: [
        'Registrera en ny Entra-app (App registration) och välj Web som plattform.',
        `Sätt Redirect URI till ${redirect} i Microsoft Entra ID.`,
        'Anteckna Application (client) ID, Directory (tenant) ID och skapa ett Client secret.',
        'Fyll i dessa värden i CloudPortal under Auth-inställningar för din organisation.',
        'Tilldela användare och testa inloggningen, fyll sedan i Tenant ID, Client ID/Secret här innan du kräver SSO.'
      ],
      summary:
        'Följ guiden för att konfigurera Microsoft Entra ID och fyll i värdena i CloudPortal.'
    },
    {
      provider: 'saml',
      title: 'SAML 2.0 (Azure AD, Okta m.fl.)',
      localDocUrl: '/docs/auth/saml',
      docUrl: 'https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/saml/',
      steps: [
        'Skapa en ny SAML-app i din IdP och ange ACS/Callback URL till redirect-URL:en ovan.',
        'Kopiera Issuer/Entity ID, Entry Point (SSO URL) och publik X.509-certifikat från IdP:n.',
        'Fyll i dessa värden i CloudPortal under Auth-inställningar för din organisation.',
        'Ange eventuella Audience/Entity ID som förväntas av IdP:n och välj om AuthnRequests ska signeras.',
        'Testa inloggningen innan du aktiverar "Kräv SSO" i CloudPortal.'
      ],
      summary:
        'Standard-SAML-flöde: CloudPortal fungerar som SP och behöver IdP:ns entrypoint, issuer och certifikat för att verifiera assertioner.'
    }
  ]
})

const selectedGuide = computed(() => {
  if (form.idpProvider === 'none') return null
  return providerGuides.value.find(guide => guide.provider === form.idpProvider) || null
})

const populateForm = () => {
  if (!data.value) return
  const { organization: org, authSettings } = data.value
  form.requireSso = org.requireSso
  form.allowLocalLoginForOwners = authSettings.allowLocalLoginForOwners

  if (authSettings.idpType === 'oidc' && authSettings.idpConfig) {
    const provider = (authSettings.idpConfig.provider as 'openid' | 'entra' | undefined) ?? 'openid'
    form.idpProvider = provider
    if (provider === 'openid') {
      form.openid.issuer = (authSettings.idpConfig.issuer as string) ?? ''
      form.openid.metadataUrl = (authSettings.idpConfig.metadataUrl as string) ?? ''
      form.openid.clientId = (authSettings.idpConfig.clientId as string) ?? ''
      form.openid.clientSecret = (authSettings.idpConfig.clientSecret as string) ?? ''
      form.openid.redirectUri =
        (authSettings.idpConfig.redirectUri as string) ?? redirectUriHint.value
      form.openid.scopes = (authSettings.idpConfig.scopes as string) ?? ''
    } else {
      form.entra.tenantId = (authSettings.idpConfig.tenantId as string) ?? ''
      form.entra.clientId = (authSettings.idpConfig.clientId as string) ?? ''
      form.entra.clientSecret = (authSettings.idpConfig.clientSecret as string) ?? ''
      form.entra.redirectUri =
        (authSettings.idpConfig.redirectUri as string) ?? redirectUriHint.value
      form.entra.scopes = (authSettings.idpConfig.scopes as string) ?? ''
    }
  } else if (authSettings.idpType === 'saml' && authSettings.idpConfig) {
    form.idpProvider = 'saml'
    form.saml.entryPoint = (authSettings.idpConfig.entryPoint as string) ?? ''
    form.saml.issuer = (authSettings.idpConfig.issuer as string) ?? ''
    form.saml.certificate = (authSettings.idpConfig.certificate as string) ?? ''
    form.saml.audience = (authSettings.idpConfig.audience as string) ?? ''
    form.saml.signRequest =
      (authSettings.idpConfig.signRequest as boolean | undefined) ?? true
    form.saml.wantAssertionsSigned =
      (authSettings.idpConfig.wantAssertionsSigned as boolean | undefined) ?? true
  } else {
    form.idpProvider = 'none'
  }

  if (!form.openid.redirectUri) {
    form.openid.redirectUri = redirectUriHint.value
  }
  if (!form.entra.redirectUri) {
    form.entra.redirectUri = redirectUriHint.value
  }
}

watch(
  () => data.value,
  () => {
    populateForm()
  },
  { immediate: true }
)

watch(
  () => form.idpProvider,
  (provider) => {
    if (provider === 'none') {
      form.requireSso = false
    }
    errorMessage.value = ''
    successMessage.value = ''
  }
)

const providerConfigured = computed(() => {
  if (form.idpProvider === 'openid') {
    return Boolean(
      form.openid.issuer &&
        form.openid.clientId &&
        form.openid.clientSecret &&
        form.openid.redirectUri
    )
  }
  if (form.idpProvider === 'entra') {
    return Boolean(
      form.entra.tenantId &&
        form.entra.clientId &&
        form.entra.clientSecret &&
        form.entra.redirectUri
    )
  }
  if (form.idpProvider === 'saml') {
    return Boolean(form.saml.entryPoint && form.saml.issuer && form.saml.certificate)
  }
  return false
})

const requireSsoDisabled = computed(() => form.idpProvider === 'none' || !providerConfigured.value)
const requireSsoDisabledMessage = computed(() =>
  form.idpProvider === 'none'
    ? 'Konfigurera en IdP innan SSO kan krävas.'
    : 'Fyll i alla obligatoriska IdP-fält för att kunna kräva SSO.'
)

const buildPayload = () => {
  const payload: Record<string, unknown> = {
    requireSso: form.requireSso,
    allowLocalLoginForOwners: form.allowLocalLoginForOwners
  }

  if (form.idpProvider === 'none') {
    payload.idpType = 'none'
    payload.idpConfig = null
    return payload
  }

  if (form.idpProvider === 'saml') {
    payload.idpType = 'saml'
    payload.idpConfig = {
      entryPoint: form.saml.entryPoint,
      issuer: form.saml.issuer,
      certificate: form.saml.certificate,
      audience: form.saml.audience || undefined,
      signRequest: form.saml.signRequest,
      wantAssertionsSigned: form.saml.wantAssertionsSigned
    }
    return payload
  }

  payload.idpType = 'oidc'

  if (form.idpProvider === 'openid') {
    payload.idpConfig = {
      provider: 'openid',
      issuer: form.openid.issuer,
      metadataUrl: form.openid.metadataUrl || undefined,
      clientId: form.openid.clientId,
      clientSecret: form.openid.clientSecret,
      redirectUri: form.openid.redirectUri,
      scopes: form.openid.scopes || undefined
    }
  } else {
    payload.idpConfig = {
      provider: 'entra',
      tenantId: form.entra.tenantId,
      clientId: form.entra.clientId,
      clientSecret: form.entra.clientSecret,
      redirectUri: form.entra.redirectUri,
      scopes: form.entra.scopes || undefined
    }
  }

  return payload
}

const validateProvider = (): string | null => {
  if (form.idpProvider === 'none') {
    return null
  }
  if (!providerConfigured.value) {
    return 'Fyll i alla obligatoriska IdP-fält innan du sparar.'
  }
  return null
}

const handleSave = async () => {
  if (!organization.value) {
    errorMessage.value = 'Ingen organisation är vald.'
    return
  }

  const providerError = validateProvider()
  if (providerError) {
    errorMessage.value = providerError
    return
  }

  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await $fetch(`/api/admin/organizations/${slug.value}/auth`, {
      method: 'PATCH',
      body: buildPayload()
    })
    await refresh()
    successMessage.value = 'Auth-inställningarna uppdaterades.'
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Kunde inte spara auth-inställningarna.'
  } finally {
    saving.value = false
  }
}
</script>

