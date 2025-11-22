<template>
  <section class="space-y-8">
    <header class="space-y-1">
      <NuxtLink to="/admin/users" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
        ← Tillbaka till användarlistan
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ user?.email ?? 'Användare' }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Hantera konto, status och medlemskap.</p>
    </header>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="pending" class="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      Hämtar användare...
    </div>

    <template v-else-if="user">
      <div class="grid gap-6 md:grid-cols-2">
        <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Konto</h2>
              <p class="text-sm text-slate-500 dark:text-slate-400">Översikt av användaren.</p>
            </div>
            <StatusPill :variant="user.status === 'active' ? 'success' : 'danger'">
              {{ user.status === 'active' ? 'Aktiv' : 'Inaktiverad' }}
            </StatusPill>
          </div>
          <dl class="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</dt>
              <dd class="font-medium text-slate-900 dark:text-white">{{ user.email }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</dt>
              <dd>{{ user.fullName ?? '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</dt>
              <dd>{{ user.isSuperAdmin ? 'Superadmin' : 'Standard' }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Skapad</dt>
              <dd>{{ formatDate(user.createdAt) }}</dd>
            </div>
            <div>
              <dt class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Senast inloggad</dt>
              <dd>{{ formatDate(user.lastLoginAt) }}</dd>
            </div>
          </dl>

          <div v-if="user.forcePasswordReset" class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Kräver lösenordsbyte vid nästa inloggning.
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-if="user.status === 'active'"
              class="rounded border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-300 hover:text-amber-600 disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-200"
              :disabled="actionLoading"
              @click="updateStatus('disabled')"
            >
              {{ actionLoading ? 'Uppdaterar...' : 'Inaktivera konto' }}
            </button>
            <button
              v-else
              class="rounded border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50 dark:border-emerald-500/40 dark:text-emerald-200"
              :disabled="actionLoading"
              @click="updateStatus('active')"
            >
              {{ actionLoading ? 'Uppdaterar...' : 'Aktivera konto' }}
            </button>
            <button
              class="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
              :disabled="resetLoading"
              @click="triggerReset"
            >
              {{ resetLoading ? 'Skickar...' : 'Skicka återställningslänk' }}
            </button>
            <button
              class="rounded border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-50 dark:border-red-500/30 dark:text-red-200"
              :disabled="deleteLoading"
              @click="deleteUser"
            >
              {{ deleteLoading ? 'Tar bort...' : 'Ta bort konto' }}
            </button>
          </div>

          <p v-if="actionMessage" class="text-sm text-emerald-600 dark:text-emerald-300">
            {{ actionMessage }}
          </p>
        </div>

        <div class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0f172a]">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Organisationer</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">Medlemskap för denna användare.</p>
          <ul v-if="organizations.length" class="space-y-3">
            <li
              v-for="org in organizations"
              :key="org.id"
              class="rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-white/10"
            >
              <div class="flex items-center justify-between">
                <div>
                  <p class="font-semibold text-slate-900 dark:text-white">{{ org.name }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ org.role }}</p>
                </div>
                <StatusPill :variant="org.membershipStatus === 'active' ? 'success' : 'warning'">
                  {{ org.membershipStatus }}
                </StatusPill>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-600 dark:text-slate-400">Inga organisationer kopplade.</p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRoute, useRouter } from '#imports'
import StatusPill from '~/components/shared/StatusPill.vue'
import type { AdminUserDetail, AdminUpdateUserStatusPayload } from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const router = useRouter()
const userId = computed(() => route.params.id as string)
const actionLoading = ref(false)
const resetLoading = ref(false)
const deleteLoading = ref(false)
const actionMessage = ref('')
const errorMessage = ref('')

const { data, pending, refresh, error } = await useFetch<AdminUserDetail>(
  () => `/api/admin/users/${userId.value}`,
  {
    watch: [userId]
  }
)

if (error.value) {
  errorMessage.value = error.value.message
}

const user = computed(() => data.value?.user ?? null)
const organizations = computed(() => data.value?.organizations ?? [])

const updateStatus = async (status: AdminUpdateUserStatusPayload['status']) => {
  if (!user.value) return
  actionLoading.value = true
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/users/${user.value.id}/status`, {
      method: 'PATCH',
      body: { status }
    })
    await refresh()
    actionMessage.value = status === 'active' ? 'Kontot aktiverades.' : 'Kontot inaktiverades.'
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kunde inte uppdatera status.'
    errorMessage.value = message
  } finally {
    actionLoading.value = false
  }
}

const triggerReset = async () => {
  if (!user.value) return
  resetLoading.value = true
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/users/${user.value.id}/password-reset`, {
      method: 'POST'
    })
    actionMessage.value = 'Återställningslänk skickades.'
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Kunde inte skicka återställningslänken.'
  } finally {
    resetLoading.value = false
  }
}

const deleteUser = async () => {
  if (!user.value) return
  if (
    !confirm(
      `Ta bort ${user.value.email}? Detta tar bort alla medlemskap och kräver att personen bjuds in igen.`
    )
  ) {
    return
  }
  deleteLoading.value = true
  errorMessage.value = ''
  actionMessage.value = ''
  try {
    await $fetch(`/api/admin/users/${user.value.id}/delete`, {
      method: 'DELETE'
    })
    router.push('/admin/users')
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte ta bort kontot.'
  } finally {
    deleteLoading.value = false
  }
}

const formatDate = (value?: number | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}
</script>


