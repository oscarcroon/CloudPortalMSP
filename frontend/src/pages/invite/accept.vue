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

    <div v-else-if="!isAuthenticated" class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-card dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
      <p>Logga in för att acceptera inbjudan.</p>
      <NuxtLink
        :to="loginRedirectUrl"
        class="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
      >
        Gå till inloggningen
      </NuxtLink>
    </div>

    <div
      v-else
      class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-slate-900/60"
    >
      <div class="flex flex-col gap-2 text-center">
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

        <div class="flex flex-wrap items-center gap-3">
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
import { computed, ref, watch } from '#imports'
import { useApiClient } from '~/composables/useApiClient'
import { useAuth } from '~/composables/useAuth'
import type {
  InvitationLookupResponse,
  InvitationDetails
} from '~/types/members'

definePageMeta({
  layout: 'auth',
  public: true
})

const route = useRoute()
const auth = useAuth()
const api = useApiClient()

if (import.meta.client) {
  await auth.bootstrap()
}

const invitation = ref<InvitationDetails | null>(null)
const organisationName = ref('')
const loading = ref(false)
const acceptLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const token = computed(() => {
  const raw = route.query.token
  return typeof raw === 'string' ? raw : ''
})

const isAuthenticated = computed(() => Boolean(auth.state.value.data))
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
const canAccept = computed(
  () => Boolean(invitation.value && invitation.value.status === 'pending' && !successMessage.value)
)

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const loadInvitation = async () => {
  if (!token.value || !isAuthenticated.value) {
    return
  }
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await api<InvitationLookupResponse>(`/invitations/${token.value}`)
    invitation.value = response.invitation
    organisationName.value = response.organisation?.name ?? ''
  } catch (error) {
    invitation.value = null
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte hämta inbjudan just nu.'
  } finally {
    loading.value = false
  }
}

const acceptInvitation = async () => {
  if (!canAccept.value) return
  acceptLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await api('/invitations/accept', {
      method: 'POST',
      body: { token: token.value }
    })
    successMessage.value = 'Du är nu medlem i organisationen.'
    await auth.fetchMe()
    await loadInvitation()
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte acceptera inbjudan.'
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
</script>


