<template>
  <section class="space-y-6">
    <header class="text-center">
      <h1 class="text-2xl font-semibold">{{ t('auth.loginTitle') }}</h1>
    </header>

    <form class="space-y-4" @submit.prevent="step === 'email' ? handleEmailSubmit() : step === 'mfa' ? handleMfaSubmit() : handlePasswordSubmit()">
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

      <!-- Password field: only show when no SSO providers exist for the domain -->
      <div v-if="step === 'password' && !providers.identityProviders.length" class="space-y-3">
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

      <!-- Turnstile widget on password step (only when no SSO providers) -->
      <div v-if="step === 'password' && !providers.identityProviders.length" class="flex justify-center">
        <NuxtTurnstile ref="turnstileRef" v-model="turnstileToken" />
      </div>

      <!-- MFA Code field -->
      <div v-if="step === 'mfa'" class="space-y-3">
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('auth.mfaPrompt') }}
        </p>
        <label for="mfaCode" class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >{{ t('auth.mfaCode') }}</label
        >
        <input
          id="mfaCode"
          ref="mfaCodeInput"
          v-model="mfaCode"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="8"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-lg font-mono tracking-widest text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400"
          :placeholder="t('auth.mfaCodePlaceholder')"
        />
        <div class="mt-1">
          <button
            type="button"
            class="text-xs text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
            @click="showMfaHelp = !showMfaHelp"
          >
            {{ t('auth.mfaTroubleLink') }}
          </button>
          <div v-if="showMfaHelp" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 space-y-1.5">
            <p>{{ t('auth.mfaHelpBackupCodes') }}</p>
            <p>{{ t('auth.mfaHelpContact') }}</p>
          </div>
        </div>
        <button
          type="button"
          class="text-sm text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
          @click="resetToEmailStep"
        >
          {{ t('auth.changeEmail') }}
        </button>
      </div>

      <!-- SSO enforced message -->
      <p v-if="providers.restrictSso" class="rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
        {{ t('auth.restrictSso') }}
      </p>

      <p v-if="errorMessage" class="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-900 dark:text-red-200">
        {{ errorMessage }}
      </p>

      <!-- SSO provider buttons -->
      <template v-if="providers.identityProviders.length">
        <div class="space-y-2">
          <a
            v-for="provider in providers.identityProviders"
            :key="provider.slug"
            :href="buildSsoUrl(provider.slug)"
            class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10"
          >
            <span v-html="providerIcon(provider.provider)" />
            <span>{{ t('auth.ssoLoginWith', { provider: providerDisplayName(provider.provider) }) }}</span>
            <span v-if="providers.identityProviders.length > 1" class="ml-auto text-xs text-slate-400 dark:text-slate-500">{{ provider.organizationName }}</span>
          </a>
        </div>
      </template>

      <!-- Change email button when SSO providers shown (no password field) -->
      <button
        v-if="step === 'password' && providers.identityProviders.length"
        type="button"
        class="w-full text-center text-sm text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
        @click="resetToEmailStep"
      >
        {{ t('auth.changeEmail') }}
      </button>

      <!-- Submit button: hide when SSO providers exist -->
      <button
        v-if="step !== 'password' || !providers.identityProviders.length"
        type="submit"
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        :disabled="auth.loading.value"
      >
        <span v-if="step === 'email'">{{ t('auth.continue') }}</span>
        <span v-else-if="step === 'mfa'">{{ t('auth.verifyMfa') }}</span>
        <span v-else>{{ t('auth.login') }}</span>
      </button>
    </form>

    <p class="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
      <i18n-t keypath="legal.loginConsent" tag="span">
        <template #terms>
          <NuxtLink to="/terms" class="underline underline-offset-2 transition hover:text-slate-600 dark:hover:text-slate-300">{{ t('legal.termsLink') }}</NuxtLink>
        </template>
        <template #privacy>
          <NuxtLink to="/privacy" class="underline underline-offset-2 transition hover:text-slate-600 dark:hover:text-slate-300">{{ t('legal.privacyLink') }}</NuxtLink>
        </template>
      </i18n-t>
    </p>

  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from '#imports'
import type { FetchError } from 'ofetch'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
  public: true
})

const auth = useAuth()
const route = useRoute()
const step = ref<'email' | 'password' | 'mfa'>('email')
const email = ref('')
const password = ref('')
const mfaCode = ref('')
const showMfaHelp = ref(false)
const errorMessage = ref('')
const turnstileToken = ref('')
const turnstileRef = ref()
const passwordInput = ref<HTMLInputElement | null>(null)
const mfaCodeInput = ref<HTMLInputElement | null>(null)
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

const providerIcons: Record<string, string> = {
  entra: '<svg class="w-5 h-5" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>',
  oidc: '<svg class="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>',
  saml: '<svg class="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>'
}

const providerIcon = (value: string) => providerIcons[value] ?? providerIcons.oidc

const providerDisplayName = (value: string) => {
  if (value === 'entra') return 'Microsoft'
  if (value === 'oidc' || value === 'openid') return 'SSO'
  if (value === 'saml') return 'SAML'
  return value
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
    const response = await ($fetch as any)('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value, turnstileToken: turnstileToken.value }
    })
    // Check if MFA is required
    if (response?.mfaRequired) {
      step.value = 'mfa'
      return
    }
    // Login succeeded — refresh auth state and navigate
    await auth.fetchMe()
    await navigateTo(redirectTarget.value)
  } catch (unknownError) {
    const fetchError = unknownError as FetchError | undefined
    const status =
      fetchError?.statusCode ?? fetchError?.status ?? fetchError?.response?.status ?? null
    turnstileRef.value?.reset()
    if (status === 400 || status === 403) {
      const msg = fetchError?.data?.message || ''
      if (msg.toLowerCase().includes('turnstile')) {
        errorMessage.value = t('auth.errors.turnstileFailed')
        return
      }
      if (status === 403) {
        errorMessage.value = t('auth.errors.ssoRequired')
        return
      }
    }
    if (status === 401) {
      errorMessage.value = t('auth.errors.invalidCredentials')
      password.value = ''
      return
    }
    errorMessage.value = t('auth.errors.loginFailed')
  }
}

const handleMfaSubmit = async () => {
  errorMessage.value = ''
  try {
    await auth.login({ email: email.value, password: password.value, mfaCode: mfaCode.value })
    await navigateTo(redirectTarget.value)
  } catch (unknownError) {
    const fetchError = unknownError as FetchError | undefined
    const status =
      fetchError?.statusCode ?? fetchError?.status ?? fetchError?.response?.status ?? null
    if (status === 401) {
      errorMessage.value = t('auth.errors.invalidMfaCode')
      mfaCode.value = ''
      return
    }
    errorMessage.value = t('auth.errors.loginFailed')
  }
}

const resetToEmailStep = () => {
  step.value = 'email'
  password.value = ''
  mfaCode.value = ''
  turnstileToken.value = ''
  showMfaHelp.value = false
  providers.value.restrictSso = false
  providers.value.identityProviders = []
  errorMessage.value = ''
}

// Auto-focus fields when step changes
watch(step, async (newStep) => {
  if (newStep === 'password') {
    await nextTick()
    passwordInput.value?.focus()
  } else if (newStep === 'mfa') {
    await nextTick()
    mfaCodeInput.value?.focus()
  }
})

</script>
