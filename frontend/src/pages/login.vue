<template>
  <section class="space-y-6">
    <header class="text-center">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Cloud Portal</p>
      <h1 class="mt-2 text-2xl font-semibold">Logga in</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Anslut med e-post och lösenord eller lägg till SSO senare per organisation.
      </p>
    </header>

    <form class="space-y-4" @submit.prevent="step === 'email' ? handleEmailSubmit() : handlePasswordSubmit()">
      <div>
        <label for="email" class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >E-post</label
        >
        <input
          id="email"
          v-model="email"
          type="email"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:disabled:bg-slate-900/30 dark:disabled:text-slate-500 dark:disabled:border-white/5"
          placeholder="you@example.com"
          :disabled="step === 'password'"
        />
      </div>

      <div v-if="step === 'password'" class="space-y-3">
        <label for="password" class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >Lösenord</label
        >
        <input
          id="password"
          v-model="password"
          type="password"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400"
          placeholder="••••••••"
        />
        <button
          type="button"
          class="text-sm text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
          @click="resetToEmailStep"
        >
          Byt e-postadress
        </button>
      </div>

      <p v-if="providers.restrictSso" class="rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
        Minst en organisation kräver SSO. Aktivera Cloudflare Access eller välj en annan org.
      </p>

      <p v-if="errorMessage" class="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-900 dark:text-red-200">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        :disabled="auth.loading.value"
      >
        <span v-if="step === 'email'">Fortsätt</span>
        <span v-else>Logga in</span>
      </button>
    </form>

    <p class="text-center text-xs text-slate-400 dark:text-slate-500">
      Skyddat bakom Cloudflare Zero Trust? Lägg till ditt Access-token i headern
      <code class="rounded bg-slate-100 px-1 py-0.5 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
        >CF_Authorization</code
      >
      för sömlös SSO.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from '#imports'
import type { FetchError } from 'ofetch'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
  public: true
})

const auth = useAuth()
const route = useRoute()
const step = ref<'email' | 'password'>('email')
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const providers = ref<{ restrictSso: boolean }>({ restrictSso: false })
const redirectTarget = computed(() => {
  const raw = route.query.redirect
  if (typeof raw === 'string' && raw.startsWith('/')) {
    return raw
  }
  return '/'
})

const handleEmailSubmit = async () => {
  errorMessage.value = ''
  try {
    const response = await $fetch('/api/auth/sso/providers', {
      params: { email: email.value }
    })
    providers.value.restrictSso = Boolean(response.requiresSso)
    step.value = 'password'
  } catch (unknownError) {
    const fetchError = unknownError as FetchError | undefined
    const status =
      fetchError?.statusCode ?? fetchError?.status ?? fetchError?.response?.status ?? null
    
    if (status === 400 || status === 422) {
      errorMessage.value = 'Ogiltig e-postadress. Kontrollera att e-postadressen är korrekt formaterad.'
    } else if (status === 500 || status >= 500) {
      errorMessage.value = 'E-postadressen verkar vara ogiltig eller så kunde servern inte verifiera den. Kontrollera stavningen och försök igen.'
    } else if (status === 404) {
      errorMessage.value = 'E-postadressen kunde inte hittas. Kontrollera att den är korrekt.'
    } else {
      errorMessage.value = 'Kunde inte verifiera e-postadressen. Kontrollera att den är korrekt formaterad och försök igen.'
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
      errorMessage.value = 'Fel e-post eller lösenord. Försök igen.'
      password.value = ''
      return
    }
    if (status === 403) {
      errorMessage.value = 'Organisationen kräver SSO. Använd SSO-inloggning.'
      return
    }
    errorMessage.value = 'Kunde inte logga in just nu.'
  }
}

const resetToEmailStep = () => {
  step.value = 'email'
  password.value = ''
  providers.value.restrictSso = false
  errorMessage.value = ''
}
</script>

