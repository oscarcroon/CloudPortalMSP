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
      Tillbaka till inloggning
    </NuxtLink>

    <header class="text-center space-y-2">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Återställ lösenord</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Ange din e-postadress så skickar vi en länk för att välja ett nytt lösenord.
      </p>
    </header>

    <form v-if="!submitted" class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">E-post</label>
        <input
          v-model="email"
          type="email"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400"
          placeholder="you@example.com"
        />
      </div>

      <p v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        :disabled="submitting"
      >
        {{ submitting ? 'Skickar...' : 'Skicka återställningslänk' }}
      </button>
    </form>

    <div v-else class="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
      <p class="font-semibold">Om adressen finns i systemet skickas ett mejl inom några minuter.</p>
      <p>Följ länken i mejlet för att välja ett nytt lösenord.</p>
      <NuxtLink to="/login" class="inline-flex items-center text-brand underline-offset-4 hover:underline">
        Tillbaka till inloggningen
      </NuxtLink>
    </div>

    <p class="text-center text-xs text-slate-400 dark:text-slate-500">
      Behöver du hjälp? Kontakta din administratör eller <NuxtLink to="/support" class="text-brand underline-offset-4 hover:underline">supporten</NuxtLink>.
    </p>
  </section>
</template>

<script setup lang="ts">
import { ref } from '#imports'

definePageMeta({
  layout: 'auth',
  public: true
})

const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const errorMessage = ref('')

const handleSubmit = async () => {
  if (!email.value) return
  submitting.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/password/forgot', {
      method: 'POST',
      body: { email: email.value.trim() }
    })
    submitted.value = true
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Kunde inte skicka mejlet just nu. Försök igen senare.'
  } finally {
    submitting.value = false
  }
}
</script>


