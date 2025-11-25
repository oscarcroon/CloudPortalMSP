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
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="loading"
            @click="refreshMembers"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            {{ loading ? 'Uppdaterar...' : 'Uppdatera' }}
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canInviteMembers"
            @click="openInviteModal"
          >
            <Icon icon="mdi:account-plus-outline" class="h-4 w-4" />
            Bjud in medlem
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200">
        {{ successMessage }}
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
                  <div class="flex flex-wrap justify-end gap-2 text-xs">
                    <button
                      v-if="member.status === 'active'"
                      class="rounded border border-amber-200 px-3 py-1 text-amber-700 transition hover:border-amber-300 hover:text-amber-600 disabled:opacity-40 dark:border-amber-500/30 dark:text-amber-200"
                      :disabled="!canManageUsers || statusLoadingId === member.id"
                      @click="disableMember(member)"
                    >
                      {{ statusLoadingId === member.id ? 'Inaktiverar...' : 'Inaktivera' }}
                    </button>
                    <button
                      v-if="member.status === 'inactive'"
                      class="rounded border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 dark:border-emerald-500/30 dark:text-emerald-200"
                      :disabled="!canManageUsers || statusLoadingId === member.id"
                      @click="enableMember(member)"
                    >
                      {{ statusLoadingId === member.id ? 'Aktiverar...' : 'Aktivera' }}
                    </button>
                    <button
                      class="rounded border border-red-200 px-3 py-1 font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="!canManageUsers || removalLoadingId === member.id || statusLoadingId === member.id"
                      @click="removeMember(member)"
                    >
                      {{ removalLoadingId === member.id ? 'Tar bort...' : 'Ta bort permanent' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border border-dashed border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-white/5">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Väntande inbjudningar</p>
        </div>
        <div v-if="!invitations.length" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
          Inga aktiva inbjudningar just nu.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  E-post
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Roll
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Bjuden av
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Gäller till
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">
                  Åtgärder
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="invite in invitations" :key="invite.id">
                <td class="px-6 py-4 text-slate-700 dark:text-slate-200">
                  {{ invite.email }}
                </td>
                <td class="px-6 py-4">
                  {{ invite.role }}
                </td>
                <td class="px-6 py-4">
                  <StatusPill :variant="invitationStatusVariant(invite.status)">
                    {{ invitationStatusLabel(invite.status) }}
                  </StatusPill>
                </td>
                <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {{ invite.invitedBy || '—' }}
                </td>
                <td class="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(invite.expiresAt) }}
                </td>
                <td class="px-6 py-4 text-right">
                  <button
                    v-if="invite.status === 'pending'"
                    class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                    :disabled="inviteCancelLoadingId === invite.id"
                    @click="cancelPendingInvitation(invite)"
                  >
                    {{ inviteCancelLoadingId === invite.id ? 'Avbryter...' : 'Avbryt' }}
                  </button>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
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
    :can-direct-add="organisationRequireSso"
    :loading="inviteLoading"
    :error="inviteError"
    @close="closeInviteModal"
    @submit="handleInviteSubmit"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from '#imports'
import { Icon } from '@iconify/vue'
import InviteMemberDialog from '~/components/organization/InviteMemberDialog.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useOrganizationMembers } from '~/composables/useOrganizationMembers'
import { usePermission } from '~/composables/usePermission'
import type {
  InviteMemberPayload,
  OrganizationInvitationSummary,
  OrganizationMember,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  InvitationStatus
} from '~/types/members'
import { rbacRoles } from '~/constants/rbac'
import type { RbacRole } from '~/constants/rbac'

const roleOptions: RbacRole[] = rbacRoles
const inviteRoleOptions: RbacRole[] = rbacRoles

const membersApi = useOrganizationMembers()
const permission = usePermission()

const members = ref<OrganizationMember[]>([])
const invitations = ref<OrganizationInvitationSummary[]>([])
const organisationName = ref('')
const organisationRequireSso = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const roleLoadingId = ref('')
const statusLoadingId = ref('')
const removalLoadingId = ref('')
const inviteCancelLoadingId = ref('')
const showInviteModal = ref(false)
const inviteLoading = ref(false)
const inviteError = ref('')

const currentOrgId = computed(() => membersApi.currentOrganisationId.value)
const canManageUsers = permission.can('users:manage')
const canInviteMembers = permission.can('users:invite')

const memberSummary = computed(() => {
  if (!members.value.length && !invitations.value.length) {
    return 'Inga medlemmar eller väntande inbjudningar registrerade.'
  }
  const active = members.value.filter((member) => member.status === 'active').length
  const invitedMembers = members.value.filter((member) => member.status === 'invited').length
  const pendingInvites = invitations.value.filter((invite) => invite.status === 'pending').length
  return `${active} aktiva · ${invitedMembers} inbjudna · ${pendingInvites} väntande inbjudningar`
})

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const invitationStatusLabel = (status: InvitationStatus) => {
  if (status === 'pending') return 'Avvaktar'
  if (status === 'accepted') return 'Accepterad'
  if (status === 'cancelled') return 'Avbruten'
  return 'Utgången'
}

const invitationStatusVariant = (status: InvitationStatus) => {
  if (status === 'pending') return 'warning'
  if (status === 'accepted') return 'success'
  if (status === 'cancelled') return 'info'
  return 'danger'
}

const statusLabel = (status: OrganizationMemberStatus) => {
  if (status === 'invited') return 'Inbjuden'
  if (status === 'inactive') return 'Avslutad'
  return 'Aktiv'
}

const statusVariant = (status: OrganizationMemberStatus) => {
  if (status === 'active') return 'success'
  if (status === 'invited') return 'warning'
  if (status === 'inactive') return 'danger'
  return 'info'
}

const loadMembers = async () => {
  if (!currentOrgId.value) {
    members.value = []
    invitations.value = []
    organisationName.value = ''
    organisationRequireSso.value = false
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await membersApi.fetchMembers()
    members.value = response.members
    organisationName.value = response.organisation.name
    organisationRequireSso.value = Boolean(response.organisation.requireSso)
    invitations.value = response.invitations ?? []
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || 'Kunde inte hämta medlemmar just nu.'
  } finally {
    loading.value = false
  }
}

const refreshMembers = async () => {
  await loadMembers()
}

const extractErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    // $fetch/FetchError har data.message
    const fetchError = error as { data?: { message?: string }; message?: string }
    if (fetchError.data?.message) {
      return fetchError.data.message
    }
    if (fetchError.message) {
      return fetchError.message
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ett oväntat fel uppstod.'
}

const handleRoleChange = async (member: OrganizationMember, roleValue: string) => {
  if (roleValue === member.role) return
  const nextRole = roleValue as OrganizationMemberRole
  const previousRole = member.role
  member.role = nextRole
  roleLoadingId.value = member.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await membersApi.updateMemberRole(member.id, nextRole)
    successMessage.value = `Rollen för ${member.email} uppdaterades till ${nextRole}.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error) {
    member.role = previousRole
    errorMessage.value = extractErrorMessage(error)
  } finally {
    roleLoadingId.value = ''
  }
}

const removeMember = async (member: OrganizationMember) => {
  if (!confirm(`Ta bort ${member.email} permanent? Personen måste bjudas in igen för att återfå åtkomst.`)) {
    return
  }
  removalLoadingId.value = member.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await membersApi.removeMember(member.id)
    members.value = members.value.filter((item) => item.id !== member.id)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    removalLoadingId.value = ''
  }
}

const setMemberStatus = async (
  member: OrganizationMember,
  nextStatus: OrganizationMemberStatus,
  confirmMessage?: string
) => {
  if (member.status === nextStatus) return
  if (confirmMessage && !confirm(confirmMessage)) {
    return
  }
  statusLoadingId.value = member.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await membersApi.updateMemberStatus(member.id, nextStatus)
    member.status = nextStatus
    successMessage.value =
      nextStatus === 'active'
        ? `${member.email} aktiverades.`
        : `${member.email} inaktiverades.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (error) {
    errorMessage.value = extractErrorMessage(error)
  } finally {
    statusLoadingId.value = ''
  }
}

const disableMember = (member: OrganizationMember) =>
  setMemberStatus(
    member,
    'inactive',
    `Inaktivera ${member.email}? Personen kan inte logga in förrän kontot aktiveras igen.`
  )

const enableMember = (member: OrganizationMember) => setMemberStatus(member, 'active')

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
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const result = await membersApi.inviteMember(payload)
    showInviteModal.value = false
    const delivery = (result as { emailDelivery?: { delivered: boolean; storedAt?: string | null } })
      ?.emailDelivery
    if (delivery && !delivery.delivered) {
      errorMessage.value =
        'Inbjudan skapades men mejlet kunde inte skickas. Kontrollera e-postinställningarna eller använd förhandsvisningen i uploads/outbox.'
    } else {
      successMessage.value = `Inbjudan skickades till ${payload.email}.`
    }
    setTimeout(() => {
      successMessage.value = ''
      errorMessage.value = ''
    }, 4000)
    await loadMembers()
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error && (error as any).statusCode === 409) {
      // Use the error message from backend, which can be either:
      // - "User is already a member of this organisation."
      // - "Det finns redan en väntande inbjudan för denna e-postadress."
      const backendMessage = extractErrorMessage(error)
      inviteError.value = backendMessage || 'Personen är redan medlem i organisationen eller har en väntande inbjudan.'
    } else {
      inviteError.value = extractErrorMessage(error) || 'Kunde inte skicka inbjudan.'
    }
  } finally {
    inviteLoading.value = false
  }
}

const cancelPendingInvitation = async (invite: OrganizationInvitationSummary) => {
  if (invite.status !== 'pending') return
  if (
    !confirm(
      `Avbryt inbjudan till ${invite.email}? Personen behöver en ny inbjudan för att kunna gå med.`
    )
  ) {
    return
  }
  inviteCancelLoadingId.value = invite.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await membersApi.cancelInvitation(invite.id)
    successMessage.value = `Inbjudan till ${invite.email} avbröts.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await loadMembers()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || 'Kunde inte avbryta inbjudan.'
  } finally {
    inviteCancelLoadingId.value = ''
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


