<template>
  <section class="space-y-6">
    <header class="text-center">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Cloud Portal</p>
      <h1 class="mt-2 text-2xl font-semibold">{{ t('auth.loginTitle') }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ t('auth.loginSubtitle') }}
      </p>
    </header>

    <form class="space-y-4" @submit.prevent="step === 'email' ? handleEmailSubmit() : handlePasswordSubmit()">
      <div>
        <label for="email" class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >{{ t('auth.email') }}</label
        >
        <input
          id="email"
          v-model="email"
          type="email"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:disabled:bg-slate-900/30 dark:disabled:text-slate-500 dark:disabled:border-white/5"
          :placeholder="t('auth.emailPlaceholder')"
          :disabled="step === 'password'"
        />
      </div>

      <div v-if="step === 'password'" class="space-y-3">
        <label for="password" class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >{{ t('auth.password') }}</label
        >
        <input
          id="password"
          ref="passwordInput"
          v-model="password"
          type="password"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400"
        />
        <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            class="text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
            @click="resetToEmailStep"
          >
            {{ t('auth.changeEmail') }}
          </button>
          <NuxtLink
            to="/forgot-password"
            class="text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
          >
            {{ t('auth.forgotPassword') }}
          </NuxtLink>
        </div>
      </div>

      <p v-if="providers.restrictSso" class="rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
        {{ t('auth.restrictSso') }}
      </p>

      <p v-if="errorMessage" class="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-900 dark:text-red-200">
        {{ errorMessage }}
      </p>

      <div
        v-if="providers.identityProviders.length"
        class="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
      >
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ t('auth.ssoOrganizations') }}
        </p>
        <div class="space-y-2">
          <a
            v-for="provider in providers.identityProviders"
            :key="provider.slug"
            :href="buildSsoUrl(provider.slug)"
            class="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <span>{{ provider.organizationName }}</span>
            <span class="text-xs uppercase text-slate-500 dark:text-slate-400">
              {{ providerLabel(provider.provider) }}
            </span>
          </a>
        </div>
      </div>

      <button
        type="submit"
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        :disabled="auth.loading.value"
      >
        <span v-if="step === 'email'">{{ t('auth.continue') }}</span>
        <span v-else>{{ t('auth.login') }}</span>
      </button>
    </form>

    <p class="text-center text-xs text-slate-400 dark:text-slate-500">
      {{ t('auth.cloudflareNote') }}
      <code class="rounded bg-slate-100 px-1 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >{{ t('auth.cloudflareCode') }}</code
      >
      {{ t('auth.cloudflareNoteEnd') }}
    </p>
    <p v-if="brandingSourceLabel" class="text-center text-xs text-slate-400 dark:text-slate-500">
      {{ t('auth.loginBranding') }} {{ brandingSourceLabel }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from '#imports'
import type { FetchError } from 'ofetch'
import { useAuth } from '~/composables/useAuth'
import { useLoginBranding } from '~/composables/useLoginBranding'

definePageMeta({
  layout: 'auth',
  public: true
})

const auth = useAuth()
const loginBranding = useLoginBranding()
const route = useRoute()
const step = ref<'email' | 'password'>('email')
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const passwordInput = ref<HTMLInputElement | null>(null)
interface IdentityProviderSummary {
  organizationId: string
  organizationName: string
  slug: string
  requireSso: boolean
  provider: string
}

interface ProvidersResponse {
  userExists: boolean
  requiresSso: boolean
  identityProviders: IdentityProviderSummary[]
}

const providers = ref<{ restrictSso: boolean; identityProviders: IdentityProviderSummary[] }>({
  restrictSso: false,
  identityProviders: []
})
const redirectTarget = computed(() => {
  const raw = route.query.redirect
  if (typeof raw === 'string' && raw.startsWith('/')) {
    return raw
  }
  return '/'
})

const { t } = useI18n()

const providerLabel = (value: string) => {
  if (value === 'entra') return t('auth.providers.entra')
  if (value === 'openid') return t('auth.providers.openid')
  if (value === 'saml') return t('auth.providers.saml')
  return value.toUpperCase()
}

const buildSsoUrl = (slug: string) => {
  const params = new URLSearchParams()
  if (redirectTarget.value) {
    params.set('redirect', redirectTarget.value)
  }
  const query = params.toString()
  return `/api/auth/sso/${slug}/init${query ? `?${query}` : ''}`
}

const handleEmailSubmit = async () => {
  errorMessage.value = ''
  try {
    const response = await ($fetch as any)('/api/auth/sso/providers', {
      params: { email: email.value }
    }) as ProvidersResponse
    providers.value.restrictSso = Boolean(response.requiresSso)
    providers.value.identityProviders = response.identityProviders ?? []
    step.value = 'password'
  } catch (unknownError) {
    const fetchError = unknownError as FetchError | undefined
    const status =
      fetchError?.statusCode ?? fetchError?.status ?? fetchError?.response?.status ?? null
    
    if (status === 400 || status === 422) {
      errorMessage.value = t('auth.errors.invalidEmail')
    } else if (status != null && status >= 500) {
      errorMessage.value = t('auth.errors.serverError')
    } else if (status === 404) {
      errorMessage.value = t('auth.errors.notFound')
    } else {
      errorMessage.value = t('auth.errors.verifyFailed')
    }
  }
}

const handlePasswordSubmit = async () => {
  errorMessage.value = ''
  try {
    await auth.login({ email: email.value, password: password.value })
    await navigateTo(redirectTarget.value)
  } catch (unknownError) {
    const fetchError = unknownError as FetchError | undefined
    const status =
      fetchError?.statusCode ?? fetchError?.status ?? fetchError?.response?.status ?? null
    if (status === 401) {
      errorMessage.value = t('auth.errors.invalidCredentials')
      password.value = ''
      return
    }
    if (status === 403) {
      errorMessage.value = t('auth.errors.ssoRequired')
      return
    }
    errorMessage.value = t('auth.errors.loginFailed')
  }
}

const resetToEmailStep = () => {
  step.value = 'email'
  password.value = ''
  providers.value.restrictSso = false
  providers.value.identityProviders = []
  errorMessage.value = ''
}

// Auto-focus password field when step changes to 'password'
watch(step, async (newStep) => {
  if (newStep === 'password') {
    await nextTick()
    passwordInput.value?.focus()
  }
})

const brandingSourceLabel = computed(() =>
  formatBrandingSource(
    loginBranding.branding.value?.activeTheme.loginLogoSource ??
      loginBranding.branding.value?.activeTheme.logoSource
  )
)

function formatBrandingSource(source?: { name: string | null; targetType: string } | null) {
  if (!source) {
    return ''
  }
  if (source.targetType === 'default' || !source.name) {
    return t('auth.globalDefault')
  }
  return source.name
}
</script>

