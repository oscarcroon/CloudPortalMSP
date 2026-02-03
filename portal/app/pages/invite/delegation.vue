<template>
  <section class="space-y-6">
    <header class="text-center space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{{ t('invite.delegation.title') }}</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ t('invite.delegation.heading') }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">{{ t('invite.delegation.subtitle') }}</p>
    </header>

    <div v-if="!token" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
      {{ t('invite.notFound') }}
    </div>

    <div
      v-else
      class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/60"
    >
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="text-center space-y-1">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
            {{ invitation?.organizationName }}
          </h2>
          <p class="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
            {{ t('invite.delegation.accessType') }}
          </p>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ t('invite.sentTo') }} <span class="font-semibold">{{ invitation?.email }}</span>
        </p>
      </div>

      <div v-if="loading" class="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
        {{ t('invite.loading') }}
      </div>

      <div v-else class="space-y-4">
        <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
          {{ successMessage }}
        </div>

        <dl class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.delegation.permissions') }}</dt>
            <dd class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ invitation?.permissionCount ?? 0 }} {{ t('invite.delegation.permissionsUnit') }}
            </dd>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.status') }}</dt>
            <dd class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ statusLabel }}
            </dd>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.expiresAt') }}</dt>
            <dd class="text-sm text-slate-700 dark:text-slate-200">{{ formatDate(invitation?.expiresAt) }}</dd>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.invitedBy') }}</dt>
            <dd class="text-sm text-slate-700 dark:text-slate-200">{{ invitation?.invitedBy || t('invite.system') }}</dd>
          </div>
        </dl>

        <div v-if="invitation?.note" class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
          <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">{{ t('invite.delegation.note') }}</dt>
          <dd class="text-sm text-slate-700 dark:text-slate-200">{{ invitation.note }}</dd>
        </div>

        <div
          v-if="shouldShowLoginPrompt"
          class="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        >
          <p class="mb-3">{{ t('invite.loginPrompt') }}</p>
          <NuxtLink
            :to="loginRedirectUrl"
            class="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
          >
            {{ t('invite.goToLogin') }}
          </NuxtLink>
        </div>

        <form
          v-else-if="requiresAccountCreation"
          class="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left text-sm dark:border-white/10 dark:bg-white/5"
          @submit.prevent="submitRegistration"
        >
          <p class="text-slate-600 dark:text-slate-300">
            {{ t('invite.delegation.createAccountIntro') }}
          </p>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.fullName') }}</label>
            <input
              v-model="registrationForm.fullName"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('invite.fullNamePlaceholder')"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ t('invite.fullNameHelper') }}</p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.password') }}</label>
            <input
              v-model="registrationForm.password"
              type="password"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('invite.confirmPassword') }}</label>
            <input
              v-model="registrationForm.confirmPassword"
              type="password"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>

          <ul class="list-disc space-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300" aria-live="polite">
            <li v-for="rule in passwordRequirements" :key="rule">{{ t(rule) }}</li>
          </ul>

          <div v-if="registrationErrors.length > 0" class="rounded-lg bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3">
            <ul class="list-disc space-y-1 text-sm text-red-700 dark:text-red-200 ml-4">
              <li v-for="(error, index) in registrationErrors" :key="index">
                {{ error }}
              </li>
            </ul>
          </div>
          <button
            class="w-full rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-50"
            :disabled="registrationLoading"
            type="submit"
          >
            {{ registrationLoading ? t('invite.creatingAccount') : t('invite.createAccount') }}
          </button>
        </form>

        <div
          v-else-if="showMismatchNotice"
          class="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          {{ t('invite.mismatchNotice', { email: auth.state.value.data?.user?.email, inviteEmail: invitation?.email }) }}
        </div>

        <div v-else class="flex flex-wrap items-center gap-3">
          <button
            class="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-50"
            :disabled="!canAccept || acceptLoading"
            @click="acceptInvitation"
          >
            {{ acceptLoading ? t('invite.accepting') : t('invite.accept') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch, useI18n } from '#imports'
import { useAuth } from '~/composables/useAuth'
import { passwordRequirements } from '~/constants/password'

definePageMeta({
  layout: 'invite',
  public: true
})

interface DelegationInvitation {
  id: string
  email: string
  organizationId: string
  organizationName: string
  permissionCount: number
  note: string | null
  status: string
  expiresAt: string
  invitedBy: string | null
}

interface DelegationInvitationResponse {
  invitation: DelegationInvitation
  emailExists: boolean
  hasPassword: boolean
}

const route = useRoute()
const auth = useAuth()
const { t } = useI18n()

if (import.meta.client) {
  await auth.bootstrap()
}

const invitation = ref<DelegationInvitation | null>(null)
const loading = ref(false)
const acceptLoading = ref(false)
const registrationLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const registrationErrors = ref<string[]>([])
const inviteMeta = ref<{ emailExists: boolean; hasPassword: boolean } | null>(null)
const registrationForm = reactive({
  fullName: '',
  password: '',
  confirmPassword: ''
})

const token = computed(() => {
  const raw = route.query.token
  return typeof raw === 'string' ? raw : ''
})

const isAuthenticated = computed(() => Boolean(auth.state.value.data))
const currentUserEmail = computed(() => auth.state.value.data?.user?.email?.toLowerCase() ?? null)
const inviteEmail = computed(() => invitation.value?.email?.toLowerCase() ?? null)
const emailMatchesSession = computed(
  () => Boolean(currentUserEmail.value && inviteEmail.value && currentUserEmail.value === inviteEmail.value)
)
const loginRedirectUrl = computed(() => {
  const redirect = encodeURIComponent(route.fullPath)
  return `/login?redirect=${redirect}`
})
const statusLabel = computed(() => {
  const status = invitation.value?.status
  if (status === 'accepted') return t('invite.statusLabels.accepted')
  if (status === 'cancelled') return t('invite.statusLabels.cancelled')
  if (status === 'expired') return t('invite.statusLabels.expired')
  return t('invite.statusLabels.pending')
})
const requiresAccountCreation = computed(
  () => 
    invitation.value?.status === 'pending' &&
    (!inviteMeta.value?.emailExists || (inviteMeta.value?.emailExists && !inviteMeta.value?.hasPassword))
)
const shouldShowLoginPrompt = computed(
  () => 
    inviteMeta.value?.emailExists === true && 
    inviteMeta.value?.hasPassword === true &&
    !isAuthenticated.value && 
    invitation.value?.status === 'pending'
)
const showMismatchNotice = computed(
  () =>
    Boolean(
      inviteMeta.value?.emailExists &&
        isAuthenticated.value &&
        !emailMatchesSession.value &&
        invitation.value?.status === 'pending'
    )
)
const canAccept = computed(
  () =>
    Boolean(
      invitation.value &&
        invitation.value.status === 'pending' &&
        emailMatchesSession.value &&
        !successMessage.value
    )
)

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const applyStatusHints = () => {
  if (!invitation.value) return
  if (invitation.value.status === 'expired') {
    errorMessage.value = t('invite.errors.expired')
  } else if (invitation.value.status === 'cancelled') {
    errorMessage.value = t('invite.errors.cancelled')
  } else if (invitation.value.status === 'accepted') {
    successMessage.value = t('invite.errors.alreadyAccepted')
  }
}

const loadInvitation = async () => {
  if (!token.value) {
    return
  }
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await ($fetch as any)(`/api/invite/delegation/${token.value}`)
    invitation.value = response.invitation
    inviteMeta.value = {
      emailExists: response.emailExists,
      hasPassword: response.hasPassword
    }
    applyStatusHints()
  } catch (error) {
    invitation.value = null
    inviteMeta.value = null
    const status = extractStatus(error)
    if (status === 410) {
      errorMessage.value = t('invite.errors.expired')
    } else if (status === 404) {
      errorMessage.value = t('invite.errors.notFound')
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : t('invite.errors.loadFailed')
    }
  } finally {
    loading.value = false
  }
}

const submitRegistration = async () => {
  if (!token.value || !requiresAccountCreation.value) return
  if (registrationForm.password !== registrationForm.confirmPassword) {
    registrationErrors.value = [t('invite.errors.passwordMismatch')]
    return
  }
  registrationLoading.value = true
  registrationErrors.value = []
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await ($fetch as any)(`/api/invite/delegation/${token.value}/register`, {
      method: 'POST',
      body: {
        password: registrationForm.password,
        fullName: registrationForm.fullName
      }
    })
    registrationForm.password = ''
    registrationForm.confirmPassword = ''
    successMessage.value = t('invite.delegation.accountCreated')
    await auth.fetchMe()
    await navigateTo('/')
  } catch (error) {
    if (error && typeof error === 'object' && 'data' in error && error.data) {
      const data = error.data as { message?: string; errors?: string[] }
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        registrationErrors.value = data.errors
      } else if (data.message) {
        registrationErrors.value = [data.message]
      } else {
        registrationErrors.value = [t('invite.errors.createFailed')]
      }
    } else if (error && typeof error === 'object' && 'message' in error) {
      const message = (error.message as string) || t('invite.errors.createFailed')
      registrationErrors.value = [message]
    } else {
      registrationErrors.value = [t('invite.errors.createFailed')]
    }
  } finally {
    registrationLoading.value = false
  }
}

const acceptInvitation = async () => {
  if (!token.value || !canAccept.value) return
  acceptLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await ($fetch as any)(`/api/invite/delegation/${token.value}/accept`, {
      method: 'POST'
    })
    successMessage.value = t('invite.delegation.accessGranted')
    await auth.fetchMe()
    await navigateTo('/')
  } catch (error) {
    const status = extractStatus(error)
    if (status === 410) {
      errorMessage.value = t('invite.errors.acceptExpired')
    } else if (status === 409) {
      errorMessage.value = t('invite.errors.acceptInvalid')
    } else if (status === 403) {
      errorMessage.value = t('invite.errors.acceptMismatch')
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : t('invite.errors.acceptFailed')
    }
    await loadInvitation()
  } finally {
    acceptLoading.value = false
  }
}

watch(
  () => [token.value, isAuthenticated.value],
  () => {
    if (token.value) {
      void loadInvitation()
    }
  },
  { immediate: true }
)

const extractStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    const maybeStatus = (error as { status?: number }).status ?? (error as { statusCode?: number }).statusCode
    if (typeof maybeStatus === 'number') {
      return maybeStatus
    }
  }
  return undefined
}

onMounted(() => {
  if (token.value) {
    void loadInvitation()
  }
})

watch(
  () => token.value,
  () => {
    if (token.value) {
      void loadInvitation()
    }
  }
)

watch(
  () => auth.state.value.data,
  () => {
    if (token.value) {
      void loadInvitation()
    }
  }
)
</script>
