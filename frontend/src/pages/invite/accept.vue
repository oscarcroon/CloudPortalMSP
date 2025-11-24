<template>
  <section class="space-y-6">
    <header class="text-center space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Inbjudan</p>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Acceptera organisationsinbjudan</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">Anslut dig till organisationen genom att bekräfta nedan.</p>
    </header>

    <div v-if="!token" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
      Ingen inbjudan hittades. Kontrollera att länken innehåller ett giltigt token.
    </div>

    <div
      v-else
      class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/60"
    >
      <div class="flex flex-col items-center gap-4 text-center">
        <img
          v-if="invitation?.branding?.logoUrl"
          :src="invitation.branding.logoUrl"
          alt="Organisation logo"
          class="h-16 w-auto rounded-xl border border-slate-200/60 bg-white/80 px-4 py-2 shadow-sm dark:border-white/10 dark:bg-slate-800/60"
        />
        <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
          {{ organisationName || 'Organisation' }}
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Inbjudan skickad till <span class="font-semibold">{{ invitation?.email }}</span>
        </p>
      </div>

      <div v-if="loading" class="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
        Laddar inbjudan...
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
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</dt>
            <dd class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ invitation?.role }}
            </dd>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</dt>
            <dd class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ statusLabel }}
            </dd>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Gäller till</dt>
            <dd class="text-sm text-slate-700 dark:text-slate-200">{{ formatDate(invitation?.expiresAt) }}</dd>
          </div>
          <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/5">
            <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bjuden av</dt>
            <dd class="text-sm text-slate-700 dark:text-slate-200">{{ invitation?.invitedBy || 'Okänd' }}</dd>
          </div>
        </dl>
        <div
          v-if="shouldShowLoginPrompt"
          class="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        >
          <p class="mb-3">Logga in för att acceptera inbjudan.</p>
          <NuxtLink
            :to="loginRedirectUrl"
            class="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
          >
            Gå till inloggningen
          </NuxtLink>
        </div>

        <form
          v-else-if="requiresAccountCreation"
          class="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left text-sm dark:border-white/10 dark:bg-white/5"
          @submit.prevent="submitRegistration"
        >
          <p class="text-slate-600 dark:text-slate-300">
            Skapa ett lösenord för <strong>{{ invitation?.email }}</strong> för att gå med i organisationen.
          </p>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fullständigt namn</label>
            <input
              v-model="registrationForm.fullName"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              placeholder="Förnamn Efternamn"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Ange både för- och efternamn.</p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Lösenord</label>
            <input
              v-model="registrationForm.password"
              type="password"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Bekräfta lösenord</label>
            <input
              v-model="registrationForm.confirmPassword"
              type="password"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <p v-if="registrationError" class="text-sm text-red-600 dark:text-red-300">
            {{ registrationError }}
          </p>
          <button
            class="w-full rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-50"
            :disabled="registrationLoading"
            type="submit"
          >
            {{ registrationLoading ? 'Skapar konto...' : 'Skapa konto och gå med' }}
          </button>
        </form>

        <div
          v-else-if="showMismatchNotice"
          class="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          Du är inloggad som {{ auth.state.value.data?.user?.email }} men inbjudan skickades till
          {{ invitation?.email }}. Logga ut och logga in med rätt konto för att fortsätta.
        </div>

        <div v-else class="flex flex-wrap items-center gap-3">
          <button
            class="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-50"
            :disabled="!canAccept || acceptLoading"
            @click="acceptInvitation"
          >
            {{ acceptLoading ? 'Accepterar...' : 'Acceptera inbjudan' }}
          </button>
          <NuxtLink
            to="/settings/members"
            class="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Till inställningar
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from '#imports'
import { useAuth } from '~/composables/useAuth'
import type {
  InvitationLookupResponse,
  InvitationDetails
} from '~/types/members'

definePageMeta({
  layout: 'invite',
  public: true
})

const route = useRoute()
const auth = useAuth()

if (import.meta.client) {
  await auth.bootstrap()
}

const invitation = ref<
  (InvitationDetails & { branding?: { logoUrl?: string | null } }) | null
>(null)
const organisationName = ref('')
const loading = ref(false)
const acceptLoading = ref(false)
const registrationLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const registrationError = ref('')
const inviteMeta = ref<Pick<InvitationLookupResponse, 'emailExists' | 'hasPassword' | 'autoAccept'> | null>(
  null
)
const autoAcceptTriggered = ref(false)
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
  if (status === 'accepted') return 'Redan accepterad'
  if (status === 'cancelled') return 'Avbruten'
  if (status === 'expired') return 'Utgången'
  return 'Väntar på svar'
})
const requiresAccountCreation = computed(
  () => inviteMeta.value?.emailExists === false && invitation.value?.status === 'pending'
)
const shouldShowLoginPrompt = computed(
  () => inviteMeta.value?.emailExists === true && !isAuthenticated.value && invitation.value?.status === 'pending'
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
    errorMessage.value =
      'Den här inbjudan har gått ut. Kontakta din administratör för att få en ny länk.'
  } else if (invitation.value.status === 'cancelled') {
    errorMessage.value = 'Inbjudan har återkallats av en administratör.'
  } else if (invitation.value.status === 'accepted') {
    successMessage.value = 'Inbjudan är redan accepterad.'
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
    const response = await $fetch<InvitationLookupResponse>(`/api/invite/${token.value}`)
    invitation.value = response.invitation
    organisationName.value = response.organisation?.name ?? ''
    inviteMeta.value = {
      emailExists: response.emailExists,
      hasPassword: response.hasPassword,
      autoAccept: response.autoAccept
    }
    applyStatusHints()
    if (response.autoAccept && canAccept.value && !autoAcceptTriggered.value) {
      autoAcceptTriggered.value = true
      await acceptInvitation()
    }
  } catch (error) {
    invitation.value = null
    inviteMeta.value = null
    const status = extractStatus(error)
    if (status === 410) {
      errorMessage.value =
        'Den här inbjudan har gått ut. Kontakta din administratör för att få en ny länk.'
    } else if (status === 404) {
      errorMessage.value = 'Inbjudan hittades inte. Kontrollera att länken är korrekt.'
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : 'Kunde inte hämta inbjudan just nu.'
    }
  } finally {
    loading.value = false
  }
}

const submitRegistration = async () => {
  if (!token.value || !requiresAccountCreation.value) return
  if (registrationForm.password !== registrationForm.confirmPassword) {
    registrationError.value = 'Lösenorden matchar inte.'
    return
  }
  registrationLoading.value = true
  registrationError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/invite/${token.value}/register`, {
      method: 'POST',
      body: {
        password: registrationForm.password,
        fullName: registrationForm.fullName
      }
    })
    registrationForm.password = ''
    registrationForm.confirmPassword = ''
    successMessage.value = 'Kontot skapades och inbjudan accepterades.'
    await auth.fetchMe()
    await navigateTo('/')
  } catch (error) {
    registrationError.value =
      error instanceof Error ? error.message : 'Kunde inte skapa kontot.'
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
    await $fetch(`/api/invite/${token.value}/accept`, {
      method: 'POST'
    })
    successMessage.value = 'Du är nu medlem i organisationen.'
    await auth.fetchMe()
    await navigateTo('/')
  } catch (error) {
    const status = extractStatus(error)
    if (status === 410) {
      errorMessage.value =
        'Inbjudan har gått ut. Be en administratör att skicka en ny inbjudan innan du försöker igen.'
    } else if (status === 409) {
      errorMessage.value = 'Inbjudan är inte längre giltig. Kontakta administratören för en ny länk.'
    } else if (status === 403) {
      errorMessage.value =
        'Inbjudan matchar inte det konto du är inloggad med. Kontrollera att du använder rätt e-postadress.'
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : 'Kunde inte acceptera inbjudan.'
    }
    await loadInvitation()
  } finally {
    acceptLoading.value = false
  }
}

watch(
  () => [token.value, isAuthenticated.value],
  () => {
    if (token.value && isAuthenticated.value) {
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
      autoAcceptTriggered.value = false
      void loadInvitation()
    }
  }
)

watch(
  () => auth.state.value.data,
  () => {
    if (token.value) {
      autoAcceptTriggered.value = false
      void loadInvitation()
    }
  }
)
</script>


