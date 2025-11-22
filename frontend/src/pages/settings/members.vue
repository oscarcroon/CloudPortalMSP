<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/settings"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka till inställningar
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Medlemmar</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Hantera roller, se väntande inbjudningar och ta bort åtkomst för den aktiva organisationen.
        </p>
      </div>
    </header>

    <div v-if="!currentOrgId" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
      Du behöver välja en aktiv organisation innan du kan hantera medlemmar.
    </div>

    <div v-else class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Aktiv organisation</p>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ organisationName }}</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ memberSummary }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="loading"
            @click="refreshMembers"
          >
            {{ loading ? 'Uppdaterar...' : 'Uppdatera' }}
          </button>
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="!canInviteMembers"
            @click="openInviteModal"
          >
            Bjud in medlem
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
        {{ errorMessage }}
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Medlemmar</p>
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ members.length }} st</span>
          </div>
        </div>

        <div v-if="loading" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Laddar medlemmar...
        </div>

        <div v-else-if="!members.length" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Inga medlemmar hittades. Använd knappen ovan för att bjuda in nya personer.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Roll</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Senast uppdaterad</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">Åtgärder</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="member in members" :key="member.id">
                <td class="px-6 py-4">
                  <p class="font-semibold text-slate-900 dark:text-white">
                    {{ member.displayName || 'Okänt namn' }}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ member.userId ?? 'Ej kopplad' }}
                  </p>
                </td>
                <td class="px-6 py-4 text-slate-700 dark:text-slate-200">
                  {{ member.email }}
                </td>
                <td class="px-6 py-4">
                  <select
                    :value="member.role"
                    class="rounded border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-white/10"
                    :disabled="!canManageUsers || member.status !== 'active' || roleLoadingId === member.id"
                    @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value)"
                  >
                    <option v-for="role in roleOptions" :key="role" :value="role">
                      {{ role }}
                    </option>
                  </select>
                </td>
                <td class="px-6 py-4">
                  <StatusPill :variant="statusVariant(member.status)">
                    {{ statusLabel(member.status) }}
                  </StatusPill>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(member.updatedAt) }}
                </td>
                <td class="px-6 py-4 text-right">
                  <button
                    class="text-xs font-semibold text-red-500 transition hover:text-red-400 disabled:opacity-40"
                    :disabled="!canManageUsers || member.status !== 'active' || removalLoadingId === member.id"
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
    </div>
  </section>

  <InviteMemberDialog
    :open="showInviteModal"
    :roles="inviteRoleOptions"
    :loading="inviteLoading"
    :error="inviteError"
    @close="closeInviteModal"
    @submit="handleInviteSubmit"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from '#imports'
import InviteMemberDialog from '~/components/organization/InviteMemberDialog.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useOrganizationMembers } from '~/composables/useOrganizationMembers'
import { usePermission } from '~/composables/usePermission'
import type {
  InviteMemberPayload,
  OrganizationMember,
  OrganizationMemberRole,
  OrganizationMemberStatus
} from '~/types/members'

const roleOptions: OrganizationMemberRole[] = ['owner', 'admin', 'member']
const inviteRoleOptions: OrganizationMemberRole[] = ['admin', 'member']

const membersApi = useOrganizationMembers()
const permission = usePermission()

const members = ref<OrganizationMember[]>([])
const organisationName = ref('')
const loading = ref(false)
const errorMessage = ref('')
const roleLoadingId = ref('')
const removalLoadingId = ref('')
const showInviteModal = ref(false)
const inviteLoading = ref(false)
const inviteError = ref('')

const currentOrgId = computed(() => membersApi.currentOrganisationId.value)
const canManageUsers = permission.can('users:manage')
const canInviteMembers = permission.can('users:invite')

const memberSummary = computed(() => {
  if (!members.value.length) return 'Inga medlemmar registrerade.'
  const active = members.value.filter((member) => member.status === 'active').length
  const invited = members.value.filter((member) => member.status === 'invited').length
  return `${active} aktiva · ${invited} inbjudna`
})

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const statusLabel = (status: OrganizationMemberStatus) => {
  if (status === 'invited') return 'Inbjuden'
  if (status === 'inactive') return 'Avslutad'
  return 'Aktiv'
}

const statusVariant = (status: OrganizationMemberStatus) => {
  if (status === 'active') return 'success'
  if (status === 'invited') return 'warning'
  return 'info'
}

const loadMembers = async () => {
  if (!currentOrgId.value) {
    members.value = []
    organisationName.value = ''
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await membersApi.fetchMembers()
    members.value = response.members
    organisationName.value = response.organisation.name
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte hämta medlemmar just nu.'
  } finally {
    loading.value = false
  }
}

const refreshMembers = async () => {
  await loadMembers()
}

const handleRoleChange = async (member: OrganizationMember, roleValue: string) => {
  if (roleValue === member.role) return
  const nextRole = roleValue as OrganizationMemberRole
  const previousRole = member.role
  member.role = nextRole
  roleLoadingId.value = member.id
  try {
    await membersApi.updateMemberRole(member.id, nextRole)
  } catch (error) {
    member.role = previousRole
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte uppdatera rollen.'
  } finally {
    roleLoadingId.value = ''
  }
}

const removeMember = async (member: OrganizationMember) => {
  if (!confirm(`Ta bort ${member.email} från organisationen?`)) {
    return
  }
  removalLoadingId.value = member.id
  try {
    await membersApi.removeMember(member.id)
    members.value = members.value.filter((item) => item.id !== member.id)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Kunde inte ta bort medlemmen.'
  } finally {
    removalLoadingId.value = ''
  }
}

const openInviteModal = () => {
  if (!canInviteMembers.value) return
  inviteError.value = ''
  showInviteModal.value = true
}

const closeInviteModal = () => {
  showInviteModal.value = false
}

const handleInviteSubmit = async (payload: InviteMemberPayload) => {
  inviteLoading.value = true
  inviteError.value = ''
  try {
    await membersApi.inviteMember(payload)
    showInviteModal.value = false
    await loadMembers()
  } catch (error) {
    inviteError.value =
      error instanceof Error ? error.message : 'Kunde inte skicka inbjudan.'
  } finally {
    inviteLoading.value = false
  }
}

watch(
  () => currentOrgId.value,
  () => {
    void loadMembers()
  },
  { immediate: true }
)
</script>


