<template>
  <section class="space-y-8">
    <header class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
      <div>
        <NuxtLink to="/admin/tenants" class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500">
          ← Tillbaka till listan
        </NuxtLink>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">Medlemmar</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">Hantera roller, bjud in nya användare och se väntande inbjudningar.</p>
      </div>
      <div class="flex gap-2">
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          :disabled="pending"
          @click="refresh"
        >
          <Icon icon="mdi:refresh" class="h-4 w-4" :class="{ 'animate-spin': pending }" />
          {{ pending ? 'Uppdaterar...' : 'Uppdatera' }}
        </button>
        <button
          v-if="canInvite"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          @click="openInviteModal"
        >
          <Icon icon="mdi:account-plus-outline" class="h-4 w-4" />
          Bjud in medlem
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
      {{ successMessage }}
    </div>

    <div v-if="pending" class="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      Laddar medlemmar...
    </div>

    <template v-else>
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <p class="text-sm font-semibold text-slate-900 dark:text-white">Medlemmar</p>
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
                    :disabled="
                      member.status !== 'active' ||
                      roleLoadingId === member.membershipId ||
                      statusLoadingId === member.membershipId ||
                      deleteLoadingId === member.membershipId
                    "
                    class="rounded border border-slate-200 bg-transparent px-2 py-1 text-sm dark:border-white/10"
                    :value="member.role"
                    @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value)"
                  >
                    <option
                      v-for="role in roles"
                      :key="role"
                      :value="role"
                      :disabled="
                        member.role === 'admin' &&
                        role !== 'admin' &&
                        member.userId === auth.user.value?.id
                      "
                    >
                      {{ role }}
                    </option>
                  </select>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="statusVariant(member.status)">
                    {{ statusLabel(member.status) }}
                  </StatusPill>
                </td>
                <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(member.addedAt) }}
                </td>
                <td class="px-6 py-3">
                  <div class="flex flex-wrap gap-2 text-xs">
                    <button
                      v-if="member.status === 'active'"
                      class="rounded border border-amber-200 px-3 py-1 text-amber-700 transition hover:border-amber-300 hover:text-amber-600 dark:border-amber-500/30 dark:text-amber-200"
                      :disabled="statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                      @click="disableMember(member)"
                    >
                      {{ statusLoadingId === member.membershipId ? 'Inaktiverar...' : 'Inaktivera' }}
                    </button>
                    <button
                      v-if="member.status === 'suspended'"
                      class="rounded border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-200"
                      :disabled="statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                      @click="enableMember(member)"
                    >
                      {{ statusLoadingId === member.membershipId ? 'Aktiverar...' : 'Aktivera' }}
                    </button>
                    <button
                      class="rounded border border-red-200 px-3 py-1 text-red-600 transition hover:border-red-300 hover:text-red-500 dark:border-red-500/30 dark:text-red-200"
                      :disabled="deleteLoadingId === member.membershipId || statusLoadingId === member.membershipId"
                      @click="deleteMember(member)"
                    >
                      {{ deleteLoadingId === member.membershipId ? 'Tar bort...' : 'Ta bort permanent' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="errorMessage" class="border-t border-slate-200 px-6 py-3 dark:border-white/5">
          <div class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {{ errorMessage }}
          </div>
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
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisation</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">Åtgärder</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="invite in invites" :key="invite.id">
                <td class="px-6 py-3 text-slate-700 dark:text-slate-200">{{ invite.email }}</td>
                <td class="px-6 py-3">{{ invite.role }}</td>
                <td class="px-6 py-3">
                  <StatusPill :variant="invite.status === 'pending' ? 'warning' : invite.status === 'accepted' ? 'success' : 'info'">
                    {{ invitationStatusLabel(invite.status) }}
                  </StatusPill>
                </td>
                <td class="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">
                  {{ invite.invitedBy?.email ?? '–' }}
                </td>
                <td class="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(invite.expiresAt) }}
                </td>
                <td class="px-6 py-3 text-xs text-slate-600 dark:text-slate-400">
                  <span v-if="invite.willCreateOrganization && invite.organizationName" class="font-semibold">
                    Kommer skapa: {{ invite.organizationName }}
                  </span>
                  <span v-else class="text-slate-400 dark:text-slate-500">—</span>
                </td>
                <td class="px-6 py-3 text-right">
                  <button
                    v-if="invite.status === 'pending'"
                    class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                    :disabled="inviteCancelLoadingId === invite.id"
                    @click="cancelInvite(invite.id)"
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
            @blur="checkUserExists"
          />
          <p v-if="checkingUser" class="mt-1 text-xs text-slate-500 dark:text-slate-400">Kontrollerar...</p>
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
        <label
          v-if="tenant?.type === 'distributor' && userExists"
          class="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300"
        >
          <input
            v-model="inviteForm.includeChildren"
            type="checkbox"
            class="mt-1 rounded border-slate-300 dark:border-white/20"
          />
          <span>
            Inkludera underordnade
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              Ge åtkomst till alla leverantörer under denna distributör.
            </span>
          </span>
        </label>
        <label
          v-if="!userExists"
          class="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300"
        >
          <input
            v-model="inviteForm.createOrganization"
            type="checkbox"
            class="mt-1 rounded border-slate-300 dark:border-white/20"
          />
          <span>
            Skapa organisation åt användaren
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              Organisationen skapas när inbjudan accepteras.
            </span>
          </span>
        </label>
        <div v-if="!userExists && inviteForm.createOrganization" class="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <h4 class="text-sm font-semibold text-slate-900 dark:text-white">Organisationsdetaljer</h4>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn *</label>
            <input
              v-model="inviteForm.organization.name"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</label>
            <input
              v-model="inviteForm.organization.slug"
              type="text"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lämna tomt för att generera automatiskt från namn
            </p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">COREID *</label>
            <input
              v-model="inviteForm.organization.coreId"
              type="text"
              required
              maxlength="4"
              pattern="[A-Z0-9]{4}"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Exakt 4 tecken, endast bokstäver och siffror</p>
          </div>
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Fakturerings-e-post</label>
            <input
              v-model="inviteForm.organization.billingEmail"
              type="email"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
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
import { computed, reactive, ref, useFetch, useRoute } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { tenantRoles } from '~/constants/rbac'
import type {
  AdminTenantMembersResponse,
  AdminTenantMember,
  TenantRole
} from '~/types/admin'
import { useAuth } from '~/composables/useAuth'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const route = useRoute()
const auth = useAuth()
const roles = tenantRoles
const tenantId = computed(() => route.params.id as string)

const showInvite = ref(false)
const inviteSubmitting = ref(false)
const inviteError = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const roleLoadingId = ref('')
const statusLoadingId = ref('')
const deleteLoadingId = ref('')
const inviteCancelLoadingId = ref('')

const userExists = ref(false)
const checkingUser = ref(false)

const inviteForm = reactive({
  email: '',
  role: 'viewer' as TenantRole,
  includeChildren: false,
  createOrganization: false,
  organization: {
    name: '',
    slug: '',
    billingEmail: '',
    coreId: ''
  }
})

const { data, pending, refresh, error } = await useFetch<AdminTenantMembersResponse>(
  `/api/admin/tenants/${tenantId.value}/members`,
  {
    watch: [tenantId]
  }
)

if (error.value) {
  errorMessage.value = error.value.message
}

const tenant = computed(() => data.value?.tenant)
const members = computed(() => data.value?.members ?? [])
const invites = computed(() => {
  const result = data.value?.invites ?? []
  if (import.meta.dev) {
    console.log('[tenant-members-ui] Invites:', result)
    console.log('[tenant-members-ui] Data:', data.value)
  }
  return result
})

const canInvite = computed(() => {
  if (!tenant.value) return false
  // For distributors, only superadmins can invite members
  if (tenant.value.type === 'distributor') {
    return auth.isSuperAdmin.value
  }
  // For providers, admins can invite members
  if (tenant.value.type === 'provider') {
    if (auth.isSuperAdmin.value) return true
    const role = auth.state.value.data?.tenantRoles[tenant.value.id]
    return role === 'admin'
  }
  return false
})

const formatDate = (value: string | null) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const invitationStatusLabel = (status: string) => {
  if (status === 'pending') return 'Avvaktar'
  if (status === 'accepted') return 'Accepterad'
  if (status === 'cancelled') return 'Avbruten'
  if (status === 'expired') return 'Utgången'
  return status
}

const statusLabel = (status: string) => {
  if (status === 'active') return 'Aktiv'
  if (status === 'suspended') return 'Inaktiverad'
  return status
}

const statusVariant = (status: string) => {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'danger'
  return 'info'
}

const checkUserExists = async () => {
  if (!inviteForm.email.trim()) {
    userExists.value = false
    return
  }
  checkingUser.value = true
  try {
    const response = await $fetch<{ exists: boolean }>(`/api/admin/users/check-email`, {
      method: 'POST',
      body: { email: inviteForm.email.trim() }
    }).catch(() => ({ exists: false }))
    userExists.value = response.exists ?? false
    if (userExists.value) {
      inviteForm.createOrganization = false
    }
  } catch {
    userExists.value = false
  } finally {
    checkingUser.value = false
  }
}

const openInviteModal = () => {
  inviteForm.email = ''
  inviteForm.role = 'viewer'
  inviteForm.includeChildren = false
  inviteForm.createOrganization = false
  inviteForm.organization.name = ''
  inviteForm.organization.slug = ''
  inviteForm.organization.billingEmail = ''
  inviteForm.organization.coreId = ''
  userExists.value = false
  checkingUser.value = false
  inviteError.value = ''
  showInvite.value = true
}

const closeInviteModal = () => {
  showInvite.value = false
}

const submitInvite = async () => {
  inviteError.value = ''
  successMessage.value = ''
  
  // Validate organization data if createOrganization is true
  if (!userExists && inviteForm.createOrganization) {
    if (!inviteForm.organization.name.trim()) {
      inviteError.value = 'Organisationsnamn krävs.'
      return
    }
    if (!inviteForm.organization.coreId || inviteForm.organization.coreId.length !== 4) {
      inviteError.value = 'COREID måste vara exakt 4 tecken.'
      return
    }
  }
  
  inviteSubmitting.value = true
  try {
    const payload: any = {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      includeChildren: inviteForm.includeChildren
    }
    
    if (!userExists && inviteForm.createOrganization) {
      payload.createOrganization = true
      payload.organization = {
        name: inviteForm.organization.name.trim(),
        coreId: inviteForm.organization.coreId.toUpperCase().trim()
      }
      if (inviteForm.organization.slug.trim()) {
        payload.organization.slug = inviteForm.organization.slug.trim()
      }
      if (inviteForm.organization.billingEmail.trim()) {
        payload.organization.billingEmail = inviteForm.organization.billingEmail.trim()
      }
    }
    
    await $fetch(`/api/admin/tenants/${tenantId.value}/members/invite`, {
      method: 'POST',
      body: payload
    })
    closeInviteModal()
    await refresh()
    successMessage.value = 'Inbjudan skickad.'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    inviteError.value = err instanceof Error ? err.message : 'Kunde inte skicka inbjudan.'
  } finally {
    inviteSubmitting.value = false
  }
}

const cancelInvite = async (inviteId: string) => {
  if (!confirm('Avbryt denna inbjudan?')) {
    return
  }
  inviteCancelLoadingId.value = inviteId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/invitations/${inviteId}/cancel`, {
      method: 'DELETE'
    })
    await refresh()
    successMessage.value = 'Inbjudan avbröts.'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte avbryta inbjudan.'
  } finally {
    inviteCancelLoadingId.value = ''
  }
}

const handleRoleChange = async (member: AdminTenantMember, roleValue: string) => {
  if (roleValue === member.role) return
  
  // Prevent self-demotion from admin to any other role
  if (member.role === 'admin' && roleValue !== 'admin' && member.userId === auth.user.value?.id) {
    errorMessage.value = 'Du kan inte nedgradera dina egna admin-rättigheter. Endast andra admins kan göra denna ändring.'
    return
  }
  
  const previousRole = member.role
  roleLoadingId.value = member.membershipId
  member.role = roleValue as TenantRole
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/members/${member.membershipId}/role`, {
      method: 'PATCH',
      body: { role: roleValue }
    })
    successMessage.value = `Rollen för ${member.email} uppdaterades till ${roleValue}.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await refresh()
  } catch (err) {
    member.role = previousRole
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte uppdatera rollen.'
  } finally {
    roleLoadingId.value = ''
  }
}

const setMemberStatus = async (
  member: AdminTenantMember,
  nextStatus: 'active' | 'suspended',
  options: { confirm?: string } = {}
) => {
  if (member.status === nextStatus) return
  if (options.confirm && !confirm(options.confirm)) {
    return
  }
  statusLoadingId.value = member.membershipId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(
      `/api/admin/tenants/${tenantId.value}/members/${member.membershipId}/status`,
      {
        method: 'PATCH',
        body: { status: nextStatus }
      }
    )
    await refresh()
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Kunde inte uppdatera medlemsstatus.'
  } finally {
    statusLoadingId.value = ''
  }
}

const disableMember = (member: AdminTenantMember) =>
  setMemberStatus(member, 'suspended', {
    confirm: `Inaktivera ${member.email}? Personen kan inte logga in förrän kontot aktiveras igen.`
  })

const enableMember = (member: AdminTenantMember) => setMemberStatus(member, 'active')

const deleteMember = async (member: AdminTenantMember) => {
  if (
    !confirm(
      `Ta bort ${member.email} permanent? Personen måste bjudas in på nytt för att få åtkomst.`
    )
  ) {
    return
  }
  deleteLoadingId.value = member.membershipId
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/members/${member.membershipId}`, {
      method: 'DELETE'
    })
    await refresh()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte ta bort medlemmen.'
  } finally {
    deleteLoadingId.value = ''
  }
}
</script>

