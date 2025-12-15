<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/admin/organizations"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka till listan
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Delegationer</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Hantera MSP→Org-delegationer utan att lägga till medlemmar i organisationen.
        </p>
      </div>
    </header>

    <OrganizationTabs :slug="slug" active="delegations" />

    <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
      {{ errorMessage }}
    </div>

    <div class="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktiva delegationer</p>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                {{ delegations.length }} st
              </p>
            </div>
            <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input v-model="showRevoked" type="checkbox" class="rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20" />
              Visa återkallade
            </label>
          </div>

          <div v-if="pending" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-300">
            Laddar delegationer...
          </div>
          <div v-else-if="!delegations.length" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-300">
            Inga delegationer hittades.
          </div>
          <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
            <div
              v-for="delegation in visibleDelegations"
              :key="delegation.id"
              class="px-6 py-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-slate-900 dark:text-white">
                      {{ delegation.subjectName || delegation.subjectEmail || delegation.subjectId }}
                    </p>
                    <span
                      v-if="delegation.revokedAt"
                      class="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
                    >
                      Återkallad
                    </span>
                    <span
                      v-else-if="isExpired(delegation)"
                      class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                    >
                      Utgången
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ delegation.subjectEmail || delegation.subjectId }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Gäller till: {{ formatExpires(delegation.expiresAt) }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button
                    class="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                    :disabled="pendingAction === delegation.id || delegation.revokedAt !== null"
                    @click="revokeDelegation(delegation)"
                  >
                    {{ pendingAction === delegation.id ? 'Återkallar...' : 'Återkalla' }}
                  </button>
                  <button
                    class="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                    @click="togglePermissions(delegation.id)"
                  >
                    <span v-if="expanded.has(delegation.id)">Dölj rättigheter</span>
                    <span v-else>Visa rättigheter</span>
                  </button>
                </div>
              </div>
              <div v-if="expanded.has(delegation.id)" class="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-white/5 dark:text-slate-200">
                <p class="mb-2 font-semibold">Permissions</p>
                <ul class="flex flex-wrap gap-2">
                  <li
                    v-for="perm in delegation.permissionKeys"
                    :key="perm"
                    class="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-black/30 dark:text-slate-100"
                  >
                    {{ perm }}
                  </li>
                </ul>
                <p v-if="delegation.note" class="mt-2 text-slate-500 dark:text-slate-300">
                  Kommentar: {{ delegation.note }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#0c1524]">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">Ny delegation</h2>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            Tilldela plugin-rättigheter till MSP-personal utan medlemskap i organisationen.
          </p>

          <div class="mt-4 space-y-4">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Sök användare</label>
              <div class="mt-1 flex gap-2">
                <input
                  v-model="userQuery"
                  type="text"
                  class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  placeholder="E-post eller namn"
                />
                <button
                  type="button"
                  class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  :disabled="searchingUsers"
                  @click="searchUsers"
                >
                  {{ searchingUsers ? 'Söker...' : 'Sök' }}
                </button>
              </div>
              <div v-if="userResults.length" class="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Träffar</p>
                <button
                  v-for="user in userResults"
                  :key="user.id"
                  type="button"
                  class="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:bg-black/20 dark:text-slate-100 dark:hover:bg-black/30"
                  @click="selectUser(user)"
                >
                  <div>
                    <p class="font-semibold">{{ user.fullName || user.email }}</p>
                    <p class="text-xs text-slate-500">{{ user.email }}</p>
                  </div>
                  <Icon v-if="selectedUserId === user.id" icon="mdi:check" class="h-4 w-4 text-brand" />
                </button>
              </div>
              <p v-if="selectedUser" class="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                Vald användare: {{ selectedUser.fullName || selectedUser.email }}
              </p>
            </div>

            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Rättigheter</label>
              <div class="mt-2 space-y-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-white/10 dark:bg-white/5">
                <details v-for="module in moduleList" :key="module.key" open class="rounded-lg bg-white p-3 dark:bg-black/20">
                  <summary class="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100">
                    <span>{{ module.name }}</span>
                    <span class="text-xs text-slate-500">{{ module.permissions.length }} st</span>
                  </summary>
                  <div class="mt-3 space-y-2">
                    <label
                      v-for="perm in module.permissions"
                      :key="perm.key"
                      class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        class="mt-1 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                        :checked="selectedPermissions.has(perm.key)"
                        @change="togglePermission(perm.key, ($event.target as HTMLInputElement).checked)"
                      />
                      <div>
                        <p class="font-semibold">{{ perm.key }}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">{{ perm.label }}</p>
                      </div>
                    </label>
                  </div>
                </details>
              </div>
              <p v-if="!selectedPermissions.size" class="mt-1 text-xs text-amber-600 dark:text-amber-300">
                Välj minst en permission.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Gäller till (valfritt)</label>
                <input
                  v-model="expiresAtInput"
                  type="datetime-local"
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
              <div>
                <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Kommentar (valfritt)</label>
                <input
                  v-model="note"
                  type="text"
                  maxlength="200"
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
              </div>
            </div>

            <div class="flex gap-2">
              <button
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canCreate || creating"
                @click="createDelegation"
              >
                <Icon v-if="creating" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                <span>{{ creating ? 'Skapar...' : 'Skapa delegation' }}</span>
              </button>
              <button
                class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                type="button"
                :disabled="creating"
                @click="resetForm"
              >
                Rensa formulär
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, useRoute } from '#imports'
import { Icon } from '@iconify/vue'
import OrganizationTabs from '~/components/admin/OrganizationTabs.vue'
import type { AdminDelegation, AdminDelegationsResponse, AdminUsersResponse } from '~/types/admin'
import { manifests } from '~~/layers/plugin-manifests'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const errorMessage = ref('')
const pendingAction = ref('')
const expanded = ref<Set<string>>(new Set())
const showRevoked = ref(false)

const { data, pending, refresh, error } = await useFetch<AdminDelegationsResponse>(
  () => `/api/admin/organizations/${slug.value}/delegations`,
  {
    watch: [slug, showRevoked],
    query: computed(() => ({ revoked: showRevoked.value ? 'true' : 'false' }))
  }
)

if (error.value) {
  errorMessage.value = error.value.message || 'Kunde inte hämta delegationer.'
}

const organization = computed(() => data.value?.organization ?? null)
const delegations = computed(() => data.value?.delegations ?? [])

const visibleDelegations = computed(() => {
  if (showRevoked.value) return delegations.value
  return delegations.value.filter((d) => !d.revokedAt)
})

const moduleList = computed(() =>
  manifests.map((manifest) => ({
    key: manifest.module.key,
    name: manifest.module.name ?? manifest.module.key,
    permissions: manifest.permissions ?? []
  }))
)

const userQuery = ref('')
const userResults = ref<AdminUsersResponse['users']>([])
const selectedUser = ref<AdminUsersResponse['users'][number] | null>(null)
const searchingUsers = ref(false)
const selectedUserId = computed(() => selectedUser.value?.id ?? '')

const selectedPermissions = ref<Set<string>>(new Set())
const expiresAtInput = ref('')
const note = ref('')
const creating = ref(false)

const canCreate = computed(() => Boolean(selectedUserId.value) && selectedPermissions.value.size > 0)

const searchUsers = async () => {
  if (!userQuery.value.trim()) {
    userResults.value = []
    return
  }
  searchingUsers.value = true
  errorMessage.value = ''
  try {
    const res = await $fetch<AdminUsersResponse>('/api/admin/users', {
      query: { q: userQuery.value.trim() }
    })
    userResults.value = res.users ?? []
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Kunde inte söka användare.'
  } finally {
    searchingUsers.value = false
  }
}

const selectUser = (user: AdminUsersResponse['users'][number]) => {
  selectedUser.value = user
}

const togglePermission = (key: string, checked: boolean) => {
  const next = new Set(selectedPermissions.value)
  if (checked) {
    next.add(key)
  } else {
    next.delete(key)
  }
  selectedPermissions.value = next
}

const resetForm = () => {
  userQuery.value = ''
  userResults.value = []
  selectedUser.value = null
  selectedPermissions.value = new Set()
  expiresAtInput.value = ''
  note.value = ''
}

const toTimestamp = (value: string): number | null => {
  if (!value) return null
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : null
}

const createDelegation = async () => {
  if (!organization.value || !canCreate.value) return
  creating.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/organizations/${organization.value.id}/delegations`, {
      method: 'POST',
      body: {
        subjectId: selectedUserId.value,
        permissionKeys: Array.from(selectedPermissions.value),
        expiresAt: toTimestamp(expiresAtInput.value),
        note: note.value.trim() || null
      }
    })
    await refresh()
    resetForm()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Kunde inte skapa delegation.'
  } finally {
    creating.value = false
  }
}

const revokeDelegation = async (delegation: AdminDelegation) => {
  if (!organization.value || delegation.revokedAt) return
  if (!confirm('Återkalla denna delegation?')) return
  pendingAction.value = delegation.id
  errorMessage.value = ''
  try {
    await $fetch(
      `/api/admin/organizations/${organization.value.id}/delegations/${delegation.id}/revoke`,
      { method: 'POST' }
    )
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Kunde inte återkalla delegation.'
  } finally {
    pendingAction.value = ''
  }
}

const formatExpires = (value: number | null | undefined) => {
  if (!value) return 'Ingen slutdag'
  const date = new Date(value)
  return date.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const isExpired = (delegation: AdminDelegation) => {
  if (!delegation.expiresAt) return false
  return delegation.expiresAt <= Date.now()
}

const togglePermissions = (id: string) => {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expanded.value = next
}
</script>




