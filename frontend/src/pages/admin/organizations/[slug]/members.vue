<template>
  <section class="space-y-8">
    <header class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
      <div>
        <NuxtLink to="/admin/organizations" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
          ← Tillbaka till listan
        </NuxtLink>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Medlemmar</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">Hantera roller, bjud in nya användare och se väntande inbjudningar.</p>
      </div>
      <div class="flex gap-2">
        <button
          class="rounded border border-slate-300 px-3 py-1 text-xs uppercase tracking-wide text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
          @click="refresh"
        >
          Uppdatera
        </button>
        <button
          class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
          @click="openInviteModal"
        >
          Bjud in medlem
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="pending" class="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      Laddar medlemmar...
    </div>

    <template v-else>
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Aktiva medlemmar</p>
        </div>
        <div v-if="!members.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          Inga medlemmar hittades.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tillagd</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Åtgärder</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="member in members" :key="member.membershipId">
                <td class="px-6 py-3 text-slate-900 dark:text-white">
                  <div class="font-medium">{{ member.fullName ?? '—' }}</div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ member.userId }}</p>
                </td>
                <td class="px-6 py-3 text-slate-700 dark:text-slate-200">{{ member.email }}</td>
                <td class="px-6 py-3">
                  <select
                    :disabled="member.status !== 'active' || roleLoadingId === member.membershipId"
                    class="rounded border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-white/10"
                    :value="member.role"
                    @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
                  </select>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="member.status === 'active' ? 'success' : 'warning'">
                    {{ member.status }}
                  </StatusPill>
                </td>
                <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(member.addedAt) }}
                </td>
                <td class="px-6 py-3">
                  <button
                    class="text-xs text-red-500 transition hover:text-red-400 disabled:opacity-40"
                    :disabled="member.status !== 'active' || removalLoadingId === member.membershipId"
                    @click="removeMember(member)"
                  >
                    Ta bort
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-dashed border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Väntande inbjudningar</p>
        </div>
        <div v-if="!invites.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          Inga aktiva inbjudningar.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Bjuden av</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Gäller till</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="invite in invites" :key="invite.id">
                <td class="px-6 py-3 text-slate-700 dark:text-slate-200">{{ invite.email }}</td>
                <td class="px-6 py-3">{{ invite.role }}</td>
                <td class="px-6 py-3">
                  <StatusPill :variant="invite.status === 'pending' ? 'warning' : 'info'">
                    {{ invite.status }}
                  </StatusPill>
                </td>
                <td class="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ invite.invitedBy?.email ?? '–' }}
                </td>
                <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(invite.expiresAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div
      v-if="showInvite"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      @click.self="closeInviteModal"
    >
      <form
        class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]"
        @submit.prevent="submitInvite"
      >
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Bjud in medlem</h3>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</label>
          <input
            v-model="inviteForm.email"
            type="email"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</label>
          <select
            v-model="inviteForm.role"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option v-for="role in roles" :key="role" :value="role">{{ role }}</option>
          </select>
        </div>
        <div v-if="inviteError" class="rounded bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
          {{ inviteError }}
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200" @click="closeInviteModal">
            Avbryt
          </button>
          <button
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="inviteSubmitting"
          >
            {{ inviteSubmitting ? 'Skickar...' : 'Skicka inbjudan' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useAsyncData, useRoute } from '#imports'
import StatusPill from '~/components/shared/StatusPill.vue'
import { defaultRole, rbacRoles } from '~/constants/rbac'
import type {
  AdminInviteMemberPayload,
  AdminOrganizationMembersResponse,
  AdminOrganizationMember
} from '~/types/admin'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const roles = rbacRoles
const slug = computed(() => route.params.slug as string)

const showInvite = ref(false)
const inviteSubmitting = ref(false)
const inviteError = ref('')
const errorMessage = ref('')
const roleLoadingId = ref('')
const removalLoadingId = ref('')

const inviteForm = reactive({
  email: '',
  role: defaultRole
})

const { data, pending, refresh, error } = await useAsyncData(
  () => $fetch<AdminOrganizationMembersResponse>(`/api/admin/organizations/${slug.value}/members`),
  {
    watch: [slug]
  }
)

if (error.value) {
  errorMessage.value = error.value.message
}

const members = computed(() => data.value?.members ?? [])
const invites = computed(() => data.value?.invites ?? [])

const formatDate = (value: number) =>
  new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })

const openInviteModal = () => {
  inviteForm.email = ''
  inviteForm.role = defaultRole
  inviteError.value = ''
  showInvite.value = true
}

const closeInviteModal = () => {
  showInvite.value = false
}

const submitInvite = async () => {
  inviteError.value = ''
  inviteSubmitting.value = true
  const payload: AdminInviteMemberPayload = {
    email: inviteForm.email.trim(),
    role: inviteForm.role
  }
  try {
    await $fetch(`/api/admin/organizations/${slug.value}/members/invite`, {
      method: 'POST',
      body: payload
    })
    closeInviteModal()
    await refresh()
  } catch (err) {
    inviteError.value = err instanceof Error ? err.message : 'Kunde inte skicka inbjudan.'
  } finally {
    inviteSubmitting.value = false
  }
}

const handleRoleChange = async (member: AdminOrganizationMember, roleValue: string) => {
  if (roleValue === member.role) return
  const previousRole = member.role
  roleLoadingId.value = member.membershipId
  member.role = roleValue as typeof member.role
  try {
    await $fetch(`/api/admin/organizations/${slug.value}/members/${member.membershipId}/update-role`, {
      method: 'POST',
      body: { role: roleValue }
    })
    await refresh()
  } catch (err) {
    member.role = previousRole
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte uppdatera rollen.'
  } finally {
    roleLoadingId.value = ''
  }
}

const removeMember = async (member: AdminOrganizationMember) => {
  if (!confirm(`Ta bort ${member.email} från organisationen?`)) {
    return
  }
  removalLoadingId.value = member.membershipId
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/organizations/${slug.value}/members/${member.membershipId}/remove`, {
      method: 'POST'
    })
    await refresh()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte ta bort medlemmen.'
  } finally {
    removalLoadingId.value = ''
  }
}
</script>

