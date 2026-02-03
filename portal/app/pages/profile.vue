<template>
  <section class="space-y-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6 sm:justify-start">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          {{ t('profile.title') }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ t('profile.subtitle') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
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
          <span class="whitespace-nowrap">{{ t('auth.logout') }}</span>
        </button>
      </div>
    </header>

    <div
      v-if="requiresPasswordReset"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {{ t('profile.forcePasswordReset') }}
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ t('profile.sections.account') }}
        </h2>
        <dl class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('profile.fields.email') }}
            </dt>
            <dd class="font-medium text-slate-900 dark:text-white">{{ user?.email }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('profile.fields.name') }}
            </dt>
            <dd>{{ user?.fullName ?? t('profile.notProvided') }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('profile.fields.status') }}
            </dt>
            <dd class="capitalize">{{ user?.status }}</dd>
          </div>
        </dl>

        <div class="space-y-2">
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('profile.language.label') }}
          </label>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('profile.language.description') }}
          </p>
          <select
            v-model="selectedLocale"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
            :disabled="localeSubmitting"
            @change="onLocaleChange"
          >
            <option v-for="localeOption in supportedLocales" :key="localeOption.code" :value="localeOption.code">
              {{ localeOption.name }}
            </option>
          </select>
          <p v-if="localeError" class="text-xs text-red-600 dark:text-red-400">
            {{ localeError }}
          </p>
          <p v-else-if="localeSuccess" class="text-xs text-emerald-600 dark:text-emerald-300">
            {{ localeSuccess }}
          </p>
        </div>

        <form class="mt-4 space-y-3" @submit.prevent="handleNameSave">
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('profile.form.nameLabel') }}
            </label>
            <input
              v-model="nameForm.fullName"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
              :placeholder="t('profile.form.namePlaceholder')"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ t('profile.form.nameHelper') }}
            </p>
          </div>

          <p v-if="nameError" class="rounded bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {{ nameError }}
          </p>
          <p v-if="nameSuccess" class="rounded bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
            {{ nameSuccess }}
          </p>

          <div class="flex justify-end">
            <button
              type="submit"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              :disabled="nameSubmitting || !nameChanged"
            >
              {{ nameSubmitting ? t('profile.actions.savingName') : t('profile.actions.saveName') }}
            </button>
          </div>
        </form>
      </div>

      <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ t('profile.sections.organizations') }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ t('profile.organizations.count', { count: organizations.length }) }}
        </p>
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
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ t('profile.sections.password') }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ t('profile.password.helper') }}
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="md:col-span-2">
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('profile.form.currentPassword') }}
          </label>
          <input
            v-model="passwordForm.current"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('profile.form.newPassword') }}
          </label>
          <input
            v-model="passwordForm.next"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('profile.form.confirmPassword') }}
          </label>
          <input
            v-model="passwordForm.confirm"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
          />
        </div>
      </div>

      <ul class="list-disc space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
        <li v-for="rule in passwordRequirementKeys" :key="rule">{{ t(rule) }}</li>
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
          {{ passwordSubmitting ? t('profile.actions.savingPassword') : t('profile.actions.updatePassword') }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, useI18n } from '#imports'
import { passwordRequirements } from '~/constants/password'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocaleCode } from '~/constants/i18n'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default'
})

const { t, setLocale } = useI18n()
const auth = useAuth()
const supportedLocales = SUPPORTED_LOCALES
const passwordRequirementKeys = passwordRequirements

const user = computed(() => auth.user.value)
const organizations = computed(() => auth.organizations.value)
const requiresPasswordReset = computed(() => Boolean(user.value?.forcePasswordReset))

const nameForm = reactive({
  fullName: ''
})
const nameSubmitting = ref(false)
const nameError = ref('')
const nameSuccess = ref('')

const selectedLocale = ref<SupportedLocaleCode>(user.value?.locale ?? DEFAULT_LOCALE)
const localeSubmitting = ref(false)
const localeSuccess = ref('')
const localeError = ref('')

const passwordForm = reactive({
  current: '',
  next: '',
  confirm: ''
})
const passwordSubmitting = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

const setEphemeralMessage = (target: { value: string }, message: string, timeout = 3000) => {
  target.value = message
  setTimeout(() => {
    target.value = ''
  }, timeout)
}

watch(
  () => user.value?.fullName,
  (fullName) => {
    nameForm.fullName = fullName ?? ''
  },
  { immediate: true }
)

watch(
  () => user.value?.locale,
  (nextLocale) => {
    if (!nextLocale) {
      selectedLocale.value = DEFAULT_LOCALE
      return
    }
    selectedLocale.value = nextLocale as SupportedLocaleCode
  },
  { immediate: true }
)

const nameChanged = computed(() => nameForm.fullName.trim() !== (user.value?.fullName ?? '').trim())

const handleNameSave = async () => {
  if (!nameChanged.value) return
  nameSubmitting.value = true
  nameError.value = ''
  nameSuccess.value = ''
  try {
    await ($fetch as any)('/api/profile/name', {
      method: 'PATCH',
      body: {
        fullName: nameForm.fullName
      }
    })
    await auth.fetchMe()
    setEphemeralMessage(nameSuccess, t('profile.messages.nameSaved'))
  } catch (error) {
    nameError.value = error instanceof Error ? error.message : t('profile.messages.nameError')
  } finally {
    nameSubmitting.value = false
  }
}

const onLocaleChange = async () => {
  if (localeSubmitting.value) {
    return
  }
  const currentLocale = (user.value?.locale ?? DEFAULT_LOCALE) as SupportedLocaleCode
  const nextLocale = selectedLocale.value
  if (nextLocale === currentLocale) {
    return
  }

  localeSubmitting.value = true
  localeError.value = ''
  localeSuccess.value = ''

  if (user.value) {
    user.value.locale = nextLocale
  }
  await setLocale(nextLocale)

  try {
    await ($fetch as any)('/api/profile/locale', {
      method: 'PATCH',
      body: { locale: nextLocale }
    })
    setEphemeralMessage(localeSuccess, t('profile.messages.languageSaved'))
  } catch (error) {
    selectedLocale.value = currentLocale
    await setLocale(currentLocale)
    if (user.value) {
      user.value.locale = currentLocale
    }
    localeError.value =
      error instanceof Error ? error.message : t('profile.messages.languageError')
  } finally {
    localeSubmitting.value = false
  }
}

const handlePasswordChange = async () => {
  if (passwordForm.next !== passwordForm.confirm) {
    passwordError.value = t('profile.messages.passwordMismatch')
    return
  }
  passwordSubmitting.value = true
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    await ($fetch as any)('/api/auth/password/change', {
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
    setEphemeralMessage(passwordSuccess, t('profile.messages.passwordSaved'))
  } catch (error) {
    console.error(error)
    passwordError.value =
      error instanceof Error ? error.message : t('profile.messages.passwordError')
  } finally {
    passwordSubmitting.value = false
  }
}

const handleLogout = async () => {
  await auth.logout()
  await navigateTo('/login')
}
</script>


