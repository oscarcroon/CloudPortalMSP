<template>
  <section class="space-y-6">
    <NuxtLink
      to="/login"
      class="inline-flex items-center gap-2 text-sm text-slate-500 underline-offset-4 transition hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-white"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="h-4 w-4"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
      </svg>
      {{ t('forgotPassword.backToLogin') }}
    </NuxtLink>

    <header class="text-center space-y-2">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ t('forgotPassword.title') }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ t('forgotPassword.subtitle') }}
      </p>
    </header>

    <form v-if="!submitted" class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">{{ t('forgotPassword.email') }}</label>
        <input
          v-model="email"
          type="email"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400"
          :placeholder="t('auth.emailPlaceholder')"
        />
      </div>

      <NuxtTurnstile ref="turnstileRef" v-model="turnstileToken" />

      <p v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        :disabled="submitting"
      >
        {{ submitting ? t('forgotPassword.sending') : t('forgotPassword.sendLink') }}
      </button>
    </form>

    <div v-else class="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
      <p class="font-semibold">{{ t('forgotPassword.successTitle') }}</p>
      <p>{{ t('forgotPassword.successMessage') }}</p>
      <NuxtLink to="/login" class="inline-flex items-center text-brand underline-offset-4 hover:underline">
        {{ t('forgotPassword.backToLoginLink') }}
      </NuxtLink>
    </div>

    <p class="text-center text-xs text-slate-400 dark:text-slate-500">
      {{ t('forgotPassword.helpText') }} <NuxtLink to="/support" class="text-brand underline-offset-4 hover:underline">{{ t('forgotPassword.support') }}</NuxtLink>.
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref, useI18n } from '#imports'

definePageMeta({
  layout: 'auth',
  public: true
})

const { t } = useI18n()

const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')
const turnstileToken = ref('')
const turnstileRef = ref()

const handleSubmit = async () => {
  if (!email.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await ($fetch as any)('/api/auth/password/forgot', {
      method: 'POST',
      body: { email: email.value.trim(), turnstileToken: turnstileToken.value }
    })
    submitted.value = true
  } catch (error) {
    console.error(error)
    turnstileRef.value?.reset()
    errorMessage.value = t('forgotPassword.error')
  } finally {
    submitting.value = false
  }
}
</script>


