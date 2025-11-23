<template>
  <section class="space-y-8">
    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Profil</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Hantera ditt konto och lösenord.</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg border border-transparent bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand/90 md:px-4 md:py-2 md:text-sm"
        @click="handleLogout"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span class="whitespace-nowrap">Logga ut</span>
      </button>
    </header>

    <div
      v-if="requiresPasswordReset"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      Du måste uppdatera ditt lösenord innan du fortsätter.
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Konto</h2>
        <dl class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</dt>
            <dd class="font-medium text-slate-900 dark:text-white">{{ user?.email }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</dt>
            <dd>{{ user?.fullName ?? 'Ej angivet' }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</dt>
            <dd class="capitalize">{{ user?.status }}</dd>
          </div>
        </dl>
      </div>

      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Organisationer</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Du är medlem i {{ organizations.length }} organisationer.</p>
        <ul class="space-y-3">
          <li
            v-for="org in organizations"
            :key="org.id"
            class="rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-white/10"
          >
            <p class="font-semibold text-slate-900 dark:text-white">
              {{ org.name }}
              <span class="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {{ org.role }}
              </span>
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</p>
          </li>
        </ul>
      </div>
    </div>

    <form class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]" @submit.prevent="handlePasswordChange">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Byt lösenord</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Välj ett starkt lösenord. Se kraven nedan.
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Nuvarande lösenord</label>
          <input
            v-model="passwordForm.current"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Nytt lösenord</label>
          <input
            v-model="passwordForm.next"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bekräfta nytt lösenord</label>
          <input
            v-model="passwordForm.confirm"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </div>
      </div>

      <ul class="list-disc space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
        <li v-for="rule in passwordRequirements" :key="rule">{{ rule }}</li>
      </ul>

      <p v-if="passwordError" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
        {{ passwordError }}
      </p>
      <p v-if="passwordSuccess" class="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
        {{ passwordSuccess }}
      </p>

      <div class="flex justify-end">
        <button
          type="submit"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          :disabled="passwordSubmitting"
        >
          {{ passwordSubmitting ? 'Sparar...' : 'Uppdatera lösenord' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from '#imports'
import { passwordRequirements } from '~/constants/password'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
})

const auth = useAuth()
const user = computed(() => auth.user.value)
const organizations = computed(() => auth.organizations.value)
const requiresPasswordReset = computed(() => Boolean(user.value?.forcePasswordReset))

const passwordForm = reactive({
  current: '',
  next: '',
  confirm: ''
})
const passwordSubmitting = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

const handlePasswordChange = async () => {
  if (passwordForm.next !== passwordForm.confirm) {
    passwordError.value = 'Lösenorden matchar inte.'
    return
  }
  passwordSubmitting.value = true
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    await $fetch('/api/auth/password/change', {
      method: 'POST',
      body: {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next
      }
    })
    await auth.fetchMe()
    passwordForm.current = ''
    passwordForm.next = ''
    passwordForm.confirm = ''
    passwordSuccess.value = 'Lösenordet uppdaterades.'
  } catch (error) {
    console.error(error)
    passwordError.value = 'Kunde inte uppdatera lösenordet. Kontrollera ditt nuvarande lösenord och försök igen.'
  } finally {
    passwordSubmitting.value = false
  }
}

const handleLogout = async () => {
  await auth.logout()
  await navigateTo('/login')
}
</script>


