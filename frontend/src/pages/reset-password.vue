<template>
  <section class="space-y-6">
    <header class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Välj nytt lösenord</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Ange ditt nya lösenord. När det är sparat loggas du in automatiskt.
      </p>
    </header>

    <div v-if="!token" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      Länken saknar en giltig token. Kontrollera att du har använt den senaste länken från mejlet.
    </div>

    <form v-else-if="!success" class="space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Nytt lösenord</label>
        <input
          v-model="form.password"
          type="password"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
        />
      </div>
      <div>
        <label class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Bekräfta nytt lösenord</label>
        <input
          v-model="form.confirm"
          type="password"
          required
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
        />
      </div>

      <ul class="list-disc space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300" aria-live="polite">
        <li v-for="rule in passwordRequirements" :key="rule">{{ rule }}</li>
      </ul>

      <p v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        class="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
        :disabled="submitting"
      >
        {{ submitting ? 'Sparar...' : 'Spara nytt lösenord' }}
      </button>
    </form>

    <div v-else class="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
      <p class="font-semibold">Lösenordet uppdaterades.</p>
      <p>Du är nu inloggad och skickas vidare till startsidan.</p>
      <NuxtLink to="/" class="inline-flex items-center text-brand underline-offset-4 hover:underline">
        Fortsätt till dashboard
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref, useRoute, watchEffect, navigateTo } from '#imports'
import { passwordRequirements } from '~/constants/password'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'auth',
  public: true
})

const auth = useAuth()
const route = useRoute()
const token = ref<string>('')
const submitting = ref(false)
const success = ref(false)
const errorMessage = ref('')
const form = reactive({
  password: '',
  confirm: ''
})

watchEffect(() => {
  const raw = route.query.token
  token.value = typeof raw === 'string' ? raw : ''
})

const handleSubmit = async () => {
  if (!token.value) {
    errorMessage.value = 'Token saknas.'
    return
  }
  if (form.password !== form.confirm) {
    errorMessage.value = 'Lösenorden matchar inte.'
    return
  }
  submitting.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/auth/password/reset', {
      method: 'POST',
      body: {
        token: token.value.trim(),
        password: form.password
      }
    })
    await auth.fetchMe()
    success.value = true
    setTimeout(() => {
      navigateTo('/')
    }, 1500)
  } catch (error) {
    console.error(error)
    errorMessage.value = 'Länken är ogiltig eller har gått ut.'
  } finally {
    submitting.value = false
  }
}
</script>


