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

        <!-- Avatar preference -->
        <div v-if="user?.profilePictureUrl" class="space-y-2">
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('profile.avatar.label') }}
          </label>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ t('profile.avatar.description') }}
          </p>
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="flex flex-col items-center gap-1.5 rounded-lg p-2 transition"
              :class="avatarPreference === 'sso' ? 'ring-2 ring-brand' : 'opacity-60 hover:opacity-100'"
              @click="setAvatarPreference('sso')"
            >
              <span
                class="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2"
                :class="avatarPreference === 'sso' ? 'border-brand' : 'border-slate-200 dark:border-white/10'"
              >
                <img
                  :src="user.profilePictureUrl"
                  :alt="user.fullName ?? ''"
                  class="h-full w-full rounded-full object-cover"
                />
              </span>
              <span class="text-[11px] font-medium text-slate-600 dark:text-slate-300">SSO</span>
            </button>
            <button
              type="button"
              class="flex flex-col items-center gap-1.5 rounded-lg p-2 transition"
              :class="avatarPreference === 'initials' ? 'ring-2 ring-brand' : 'opacity-60 hover:opacity-100'"
              @click="setAvatarPreference('initials')"
            >
              <span
                class="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-semibold text-white"
                :class="avatarPreference === 'initials' ? 'border-brand' : 'border-slate-200 dark:border-white/10'"
                :style="{ backgroundColor: accentColor }"
              >
                {{ userInitials }}
              </span>
              <span class="text-[11px] font-medium text-slate-600 dark:text-slate-300">ABC</span>
            </button>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ avatarPreference === 'sso' ? t('profile.avatar.usingSso') : t('profile.avatar.usingInitials') }}
          </p>
          <p v-if="avatarError" class="text-xs text-red-600 dark:text-red-400">
            {{ avatarError }}
          </p>
          <p v-else-if="avatarSuccess" class="text-xs text-emerald-600 dark:text-emerald-300">
            {{ avatarSuccess }}
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

    <!-- MFA Section -->
    <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ t('profile.mfa.title') }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ t('profile.mfa.description') }}
        </p>
      </div>

      <!-- MFA Status -->
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
          :class="user?.isMfaEnabled
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'"
        >
          {{ user?.isMfaEnabled ? t('profile.mfa.enabled') : t('profile.mfa.disabled') }}
        </span>
      </div>

      <!-- MFA Not Enabled: Show setup button -->
      <div v-if="!user?.isMfaEnabled && mfaStep === 'idle'">
        <button
          type="button"
          class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          :disabled="mfaLoading"
          @click="handleMfaSetup"
        >
          {{ t('profile.mfa.enableButton') }}
        </button>
      </div>

      <!-- MFA Setup: QR Code step -->
      <div v-if="mfaStep === 'qr'" class="space-y-4">
        <p class="text-sm text-slate-600 dark:text-slate-300">
          {{ t('profile.mfa.scanQrCode') }}
        </p>
        <div class="flex justify-center">
          <img
            v-if="mfaQrCode"
            :src="mfaQrCode"
            :alt="t('profile.mfa.qrCodeAlt')"
            class="h-48 w-48 rounded-lg border border-slate-200 dark:border-white/10"
          />
        </div>
        <div v-if="mfaSecret" class="rounded-lg bg-slate-50 p-3 text-center dark:bg-white/5">
          <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('profile.mfa.manualEntry') }}</p>
          <code class="mt-1 block text-sm font-mono text-slate-800 dark:text-slate-200 select-all break-all">{{ mfaSecret }}</code>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ t('profile.mfa.verificationCode') }}
          </label>
          <input
            v-model="mfaCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-lg font-mono tracking-widest text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
            :placeholder="t('profile.mfa.codePlaceholder')"
            @keydown.enter.prevent="handleMfaConfirm"
          />
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
            :disabled="mfaLoading || mfaCode.length !== 6"
            @click="handleMfaConfirm"
          >
            {{ mfaLoading ? t('profile.mfa.verifying') : t('profile.mfa.verify') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            @click="resetMfaSetup"
          >
            {{ t('profile.mfa.cancel') }}
          </button>
        </div>
      </div>

      <!-- MFA Setup: Backup codes step -->
      <div v-if="mfaStep === 'backup'" class="space-y-4">
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/5">
          <p class="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {{ t('profile.mfa.backupCodesWarning') }}
          </p>
          <p class="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {{ t('profile.mfa.backupCodesHint') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 dark:bg-white/5 sm:grid-cols-4">
          <code
            v-for="code in mfaBackupCodes"
            :key="code"
            class="rounded bg-white px-2 py-1 text-center text-sm font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200"
          >
            {{ code }}
          </code>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            @click="copyBackupCodes"
          >
            {{ t('profile.mfa.copyBackupCodes') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
            @click="resetMfaSetup"
          >
            {{ t('profile.mfa.done') }}
          </button>
        </div>
      </div>

      <!-- MFA Enabled: Show disable option -->
      <div v-if="user?.isMfaEnabled && mfaStep === 'idle'" class="space-y-3">
        <button
          v-if="!showDisableMfa"
          type="button"
          class="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          @click="showDisableMfa = true"
        >
          {{ t('profile.mfa.disableButton') }}
        </button>
        <div v-if="showDisableMfa" class="space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-300">
            {{ t('profile.mfa.disableConfirmText') }}
          </p>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('profile.mfa.verificationCode') }}
            </label>
            <input
              v-model="mfaCode"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-lg font-mono tracking-widest text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-white/10 dark:text-white"
              :placeholder="t('profile.mfa.codePlaceholder')"
              @keydown.enter.prevent="handleMfaDisable"
            />
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              :disabled="mfaLoading || mfaCode.length !== 6"
              @click="handleMfaDisable"
            >
              {{ mfaLoading ? t('profile.mfa.disabling') : t('profile.mfa.confirmDisable') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
              @click="showDisableMfa = false; mfaCode = ''"
            >
              {{ t('profile.mfa.cancel') }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="mfaError" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
        {{ mfaError }}
      </p>
      <p v-if="mfaSuccess" class="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
        {{ mfaSuccess }}
      </p>
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

// MFA state
const mfaStep = ref<'idle' | 'qr' | 'backup'>('idle')
const mfaLoading = ref(false)
const mfaQrCode = ref('')
const mfaSecret = ref('')
const mfaCode = ref('')
const mfaBackupCodes = ref<string[]>([])
const mfaError = ref('')
const mfaSuccess = ref('')
const showDisableMfa = ref(false)

const handleMfaSetup = async () => {
  mfaLoading.value = true
  mfaError.value = ''
  try {
    const response = await ($fetch as any)('/api/auth/mfa/setup', { method: 'POST' })
    mfaQrCode.value = response.qrCodeDataUrl
    mfaSecret.value = response.secret
    mfaStep.value = 'qr'
  } catch (error: any) {
    mfaError.value = error?.data?.message ?? error?.message ?? t('profile.mfa.setupError')
  } finally {
    mfaLoading.value = false
  }
}

const handleMfaConfirm = async () => {
  if (mfaCode.value.length !== 6) return
  mfaLoading.value = true
  mfaError.value = ''
  try {
    const response = await ($fetch as any)('/api/auth/mfa/confirm', {
      method: 'POST',
      body: { code: mfaCode.value }
    })
    mfaBackupCodes.value = response.backupCodes
    mfaStep.value = 'backup'
    mfaCode.value = ''
    await auth.fetchMe()
  } catch (error: any) {
    mfaError.value = error?.data?.message ?? error?.message ?? t('profile.mfa.invalidCode')
  } finally {
    mfaLoading.value = false
  }
}

const handleMfaDisable = async () => {
  if (mfaCode.value.length !== 6) return
  mfaLoading.value = true
  mfaError.value = ''
  try {
    await ($fetch as any)('/api/auth/mfa/disable', {
      method: 'POST',
      body: { code: mfaCode.value }
    })
    mfaCode.value = ''
    showDisableMfa.value = false
    await auth.fetchMe()
    setEphemeralMessage(mfaSuccess, t('profile.mfa.disabledSuccess'))
  } catch (error: any) {
    mfaError.value = error?.data?.message ?? error?.message ?? t('profile.mfa.invalidCode')
  } finally {
    mfaLoading.value = false
  }
}

const resetMfaSetup = () => {
  mfaStep.value = 'idle'
  mfaQrCode.value = ''
  mfaSecret.value = ''
  mfaCode.value = ''
  mfaBackupCodes.value = []
  mfaError.value = ''
}

const copyBackupCodes = () => {
  const text = mfaBackupCodes.value.join('\n')
  navigator.clipboard.writeText(text)
  setEphemeralMessage(mfaSuccess, t('profile.mfa.backupCodesCopied'))
}

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

// Avatar preference
const avatarPreference = ref<'sso' | 'initials'>(user.value?.avatarPreference ?? 'sso')
const avatarError = ref('')
const avatarSuccess = ref('')

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

const userInitials = computed(() => {
  const name = user.value?.fullName
  if (!name?.trim()) {
    return user.value?.email?.[0]?.toUpperCase() ?? '?'
  }
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
})

const setAvatarPreference = async (preference: 'sso' | 'initials') => {
  if (preference === avatarPreference.value) return
  const previous = avatarPreference.value
  avatarPreference.value = preference
  avatarError.value = ''
  avatarSuccess.value = ''
  try {
    await ($fetch as any)('/api/profile/avatar-preference', {
      method: 'PATCH',
      body: { avatarPreference: preference }
    })
    await auth.fetchMe()
    setEphemeralMessage(avatarSuccess, t('profile.avatar.saved'))
  } catch {
    avatarPreference.value = previous
    avatarError.value = t('profile.avatar.error')
  }
}

watch(
  () => user.value?.avatarPreference,
  (next) => {
    if (next) avatarPreference.value = next
  }
)
</script>


