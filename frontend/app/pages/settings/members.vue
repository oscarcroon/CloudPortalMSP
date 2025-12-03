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

    <ClientOnly>
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
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ visibleMembers.length }} st
              <span v-if="searchQuery"> av {{ members.length }}</span>
            </span>
          </div>
        </div>

        <div v-if="!loading && members.length > 0" class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex flex-col gap-4">
            <form class="flex flex-1 flex-col gap-2 sm:flex-row" @submit.prevent>
              <input
                v-model="searchQuery"
                type="text"
                class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-slate-500"
                placeholder="Sök efter namn eller e-post"
              />
              <div class="flex gap-2">
                <button
                  v-if="searchQuery || showOnlyOverrides"
                  type="button"
                  class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                  @click="clearFilters"
                >
                  Rensa
                </button>
              </div>
            </form>
            <div class="flex flex-wrap gap-3">
              <label class="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  class="rounded border-slate-300 text-amber-500 focus:ring-amber-500 dark:border-white/20"
                  v-model="showOnlyOverrides"
                />
                Visa bara medlemmar med manuella modulroller
              </label>
            </div>
          </div>
        </div>

        <div v-if="loading" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Laddar medlemmar...
        </div>

        <div v-else-if="!members.length" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Inga medlemmar hittades. Använd knappen ovan för att bjuda in nya personer.
        </div>

        <div v-else-if="!visibleMembers.length && (searchQuery || showOnlyOverrides)" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Inga medlemmar matchade din sökning.</p>
          <button
            v-if="searchQuery || showOnlyOverrides"
            type="button"
            class="mt-2 text-xs text-brand underline hover:no-underline"
            @click="clearFilters"
          >
            Rensa filter
          </button>
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
              <tr v-for="member in visibleMembers" :key="member.id">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-slate-900 dark:text-white">
                      {{ member.displayName || 'Okänt namn' }}
                    </p>
                    <ClientOnly>
                      <span
                        v-if="memberHasOverrides(member)"
                        class="inline-flex items-center"
                        title="Har manuellt anpassade modulroller"
                      >
                        <Icon
                          icon="mdi:star-circle"
                          class="h-4 w-4 text-amber-500"
                        />
                      </span>
                    </ClientOnly>
                  </div>
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
                      class="rounded border border-purple-200 px-3 py-1 text-purple-700 transition hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 disabled:opacity-40 dark:border-purple-500/30 dark:text-purple-200 dark:hover:bg-purple-900/30 dark:hover:border-purple-500/40"
                      :disabled="!canManageUsers || member.status !== 'active'"
                      @click="openModuleRoleDrawer(member)"
                    >
                      Modulroller
                    </button>
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
                  <div v-if="invite.status === 'pending'" class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50 dark:border-brand/60 dark:text-brand"
                      :disabled="inviteResendLoadingId === invite.id || inviteCancelLoadingId === invite.id"
                      @click="resendPendingInvitation(invite)"
                    >
                      {{ inviteResendLoadingId === invite.id ? 'Skickar...' : 'Skicka igen' }}
                    </button>
                    <button
                      type="button"
                      class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="inviteCancelLoadingId === invite.id || inviteResendLoadingId === invite.id"
                      @click="cancelPendingInvitation(invite)"
                    >
                      {{ inviteCancelLoadingId === invite.id ? 'Avbryter...' : 'Avbryt' }}
                    </button>
                  </div>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>
      <template #fallback>
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
          <div class="h-4 w-32 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mb-2"></div>
          <div class="h-4 w-48 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
        </div>
      </template>
    </ClientOnly>
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

<Teleport to="body">
  <Transition name="fade">
    <div v-if="moduleRoleDrawerOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-slate-900/60" @click="closeModuleRoleDrawer" />
      <div class="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl dark:bg-[#0c1524]">
        <div class="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              Modulroller
            </p>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
              {{ selectedMemberForRoles?.displayName || selectedMemberForRoles?.email }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ selectedMemberForRoles ? getRoleName(selectedMemberForRoles.role) : '' }}
            </p>
          </div>
          <button
            class="rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
            @click="closeModuleRoleDrawer"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="moduleRoleDrawerLoading" class="rounded-lg border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Laddar modulroller...
          </div>
          <div v-else-if="moduleRoleDrawerError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
            {{ moduleRoleDrawerError }}
          </div>
          <div v-else-if="!moduleRoleEntries.length" class="rounded-lg border border-slate-200 bg-white/70 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            Inga moduler med modulspecifika roller hittades.
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="entry in moduleRoleEntries"
              :key="entry.moduleId"
              class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0f1a2c]"
            >
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ entry.name }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">{{ entry.description }}</p>
                </div>
                <span class="text-xs text-slate-500 dark:text-slate-400">
                  Policy: {{ moduleRolePolicySource(entry.allowedRolesSource) }}
                </span>
              </div>
              <p
                v-if="entry.allowedRoles && entry.allowedRoles.length > 0"
                class="mt-2 text-xs text-slate-500 dark:text-slate-400"
              >
                Tillåtna roller: {{ formatAllowedRoleLabels(entry).join(', ') }}
              </p>
              <p
                v-if="!entry.editable"
                class="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200"
              >
                Modulroller blockeras av {{ moduleRolePolicySource(entry.allowedRolesSource) }}.
              </p>
              <div class="mt-4 space-y-2">
                <div class="flex flex-wrap gap-2">
                  <label
                    v-for="role in entry.roleDefinitions"
                    :key="role.key"
                    class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition dark:border-white/10"
                    :class="roleClass(entry, role.key)"
                  >
                    <input
                      type="checkbox"
                      class="peer sr-only"
                      :checked="entry.pendingRoles.includes(role.key)"
                      :disabled="!isRoleSelectableForEntry(entry, role.key) || moduleRoleDrawerSaving"
                      @change="toggleModuleRoleForEntry(entry, role.key, ($event.target as HTMLInputElement).checked)"
                    />
                    <span>{{ role.label }}</span>
                    <span
                      v-if="roleBadge(entry, role.key)"
                      class="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      :class="badgeClass(entry, role.key)"
                    >
                      {{ roleBadge(entry, role.key) }}
                    </span>
                  </label>
                </div>
                <div class="text-xs text-slate-500 dark:text-slate-400">
                  Källa: {{ memberModuleRoleSourceLabel(entry) }}
                </div>
                <button
                  v-if="canResetEntry(entry)"
                  class="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  :disabled="moduleRoleDrawerSaving || !entry.editable"
                  @click="resetModuleRolesForEntry(entry)"
                >
                  Återställ till standard
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm dark:border-white/5 dark:bg-white/5">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ moduleRoleDrawerDirty ? 'Det finns osparade ändringar.' : 'Inga ändringar att spara.' }}
          </p>
          <div class="flex gap-2">
            <button
              class="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-white disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              :disabled="moduleRoleDrawerSaving"
              @click="closeModuleRoleDrawer"
            >
              Stäng
            </button>
            <button
              class="rounded bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
              :disabled="!moduleRoleDrawerDirty || moduleRoleDrawerSaving"
              @click="saveModuleRoleDrawer"
            >
              {{ moduleRoleDrawerSaving ? 'Sparar...' : 'Spara ändringar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</Teleport>
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
  InvitationStatus,
  MemberModuleRoleEntry,
  ModuleRoleSource
} from '~/types/members'
import { rbacRoles } from '~/constants/rbac'
import type { RbacRole } from '~/constants/rbac'
import type { ModuleRoleDefinition, ModuleRoleKey } from '~/constants/modules'

const roleOptions: RbacRole[] = rbacRoles
const inviteRoleOptions: RbacRole[] = rbacRoles

const roleNames: Record<RbacRole, string> = {
  owner: 'Ägare',
  admin: 'Administratör',
  operator: 'Operatör',
  member: 'Medlem',
  viewer: 'Visare',
  support: 'Support'
}

const getRoleName = (role: RbacRole | string): string => roleNames[role as RbacRole] ?? role

const membersApi = useOrganizationMembers()
const permission = usePermission()

interface ModuleRoleEntryUI extends MemberModuleRoleEntry {
  pendingRoles: ModuleRoleKey[]
}

// Use array instead of Set for better Vue reactivity
const hasModuleRoleOverrides = ref<string[]>([])
const overridesLoaded = ref(false)

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
const inviteResendLoadingId = ref('')
const showInviteModal = ref(false)
const inviteLoading = ref(false)
const inviteError = ref('')
const moduleRoleDrawerOpen = ref(false)
const moduleRoleDrawerLoading = ref(false)
const moduleRoleDrawerSaving = ref(false)
const moduleRoleDrawerError = ref('')
const selectedMemberForRoles = ref<OrganizationMember | null>(null)
const moduleRoleEntries = ref<ModuleRoleEntryUI[]>([])
const searchQuery = ref('')
const showOnlyOverrides = ref(false)

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

const visibleMembers = computed(() => {
  let filtered = members.value

  // Filter by override status
  if (showOnlyOverrides.value) {
    filtered = filtered.filter((member) => memberHasOverrides(member))
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    filtered = filtered.filter((member) => {
      const displayName = (member.displayName || '').toLowerCase()
      const email = (member.email || '').toLowerCase()
      return displayName.includes(query) || email.includes(query)
    })
  }

  return filtered
})

const moduleRoleDrawerDirty = computed(() =>
  moduleRoleEntries.value.some((entry) => isEntryDirty(entry))
)

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
    hasModuleRoleOverrides.value = []
    overridesLoaded.value = false
    return
  }
  loading.value = true
  errorMessage.value = ''
  overridesLoaded.value = false // Reset flag before loading
  try {
    const response = await membersApi.fetchMembers()
    members.value = response.members
    organisationName.value = response.organisation.name
    organisationRequireSso.value = Boolean(response.organisation.requireSso)
    invitations.value = response.invitations ?? []
    await loadMemberModuleRoleOverrides()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || 'Kunde inte hämta medlemmar just nu.'
    // Don't set overridesLoaded to true on error - keep it false
  } finally {
    loading.value = false
  }
}

const loadMemberModuleRoleOverrides = async () => {
  const orgId = currentOrgId.value
  overridesLoaded.value = false
  if (!orgId) {
    hasModuleRoleOverrides.value = []
    // Don't set overridesLoaded to true here - keep it false if no org
    return
  }
  try {
    const response = await $fetch<{ organizationId: string; userIds: string[] }>(
      `/api/organizations/${orgId}/members/module-role-overrides`
    )
    // API now returns only users who actually have custom overrides (not just rows in table)
    const userIds = Array.isArray(response?.userIds) ? response.userIds.filter(Boolean) : []
    hasModuleRoleOverrides.value = userIds
    overridesLoaded.value = true
  } catch (error) {
    console.error('Failed to load member module role overrides', error)
    hasModuleRoleOverrides.value = []
    // Set to true even on error to prevent infinite loading state
    overridesLoaded.value = true
  }
}

const updateOverrideFlagForMember = (userId: string, modules: MemberModuleRoleEntry[]) => {
  if (!userId) return
  const hasCustom = modules.some((entry) => entry.roleSource === 'custom')
  const current = hasModuleRoleOverrides.value
  if (hasCustom) {
    // Add userId if not already present
    if (!current.includes(userId)) {
      hasModuleRoleOverrides.value = [...current, userId]
    }
  } else {
    // Remove userId if present
    hasModuleRoleOverrides.value = current.filter((id) => id !== userId)
  }
  overridesLoaded.value = true // Ensure flag is set when we have updated data
}

const memberHasOverrides = (member: OrganizationMember): boolean => {
  // Don't show star if we're still loading members or if overrides haven't been loaded yet
  if (loading.value || !overridesLoaded.value) {
    return false
  }
  // Don't show star if member doesn't have a userId
  if (!member.userId) {
    return false
  }
  // Only show star if the userId is explicitly in the array of users with overrides
  // This list is populated when users open the module role drawer, not from API
  return hasModuleRoleOverrides.value.includes(member.userId)
}

const clearFilters = () => {
  searchQuery.value = ''
  showOnlyOverrides.value = false
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

const moduleRolePolicySource = (source: ModuleRoleSource): string => {
  if (source === 'module-default') return 'modulens standard'
  if (source === 'distributor') return 'distributörsnivå'
  if (source === 'provider') return 'leverantörsnivå'
  if (source === 'organization') return 'organisationen'
  return 'högre nivå'
}

const openModuleRoleDrawer = async (member: OrganizationMember) => {
  if (!canManageUsers || member.status !== 'active') {
    return
  }
  selectedMemberForRoles.value = member
  moduleRoleDrawerOpen.value = true
  moduleRoleDrawerLoading.value = true
  moduleRoleDrawerSaving.value = false
  moduleRoleDrawerError.value = ''
  try {
    const response = await membersApi.fetchMemberModuleRoles(member.id)
    moduleRoleEntries.value = response.modules.map((entry) => ({
      ...entry,
      pendingRoles: [...entry.effectiveRoles]
    }))
    if (response.userId) {
      updateOverrideFlagForMember(response.userId, response.modules)
    }
  } catch (error) {
    moduleRoleDrawerError.value = extractErrorMessage(error)
    moduleRoleEntries.value = []
  } finally {
    moduleRoleDrawerLoading.value = false
  }
}

const closeModuleRoleDrawer = () => {
  if (moduleRoleDrawerSaving.value) {
    return
  }
  moduleRoleDrawerOpen.value = false
  moduleRoleEntries.value = []
  moduleRoleDrawerError.value = ''
  selectedMemberForRoles.value = null
}

const isRoleSelectableForEntry = (entry: ModuleRoleEntryUI, roleKey: ModuleRoleKey): boolean => {
  if (!entry.editable) {
    return false
  }
  if (Array.isArray(entry.allowedRoles) && entry.allowedRoles.length > 0) {
    return entry.allowedRoles.includes(roleKey)
  }
  return true
}

const toggleModuleRoleForEntry = (
  entry: ModuleRoleEntryUI,
  roleKey: ModuleRoleKey,
  selected: boolean
) => {
  if (!isRoleSelectableForEntry(entry, roleKey) || moduleRoleDrawerSaving.value) {
    return
  }
  const next = new Set(entry.pendingRoles)
  if (selected) {
    next.add(roleKey)
  } else {
    next.delete(roleKey)
  }
  entry.pendingRoles = Array.from(next)
}

type RoleVisualState = 'granted' | 'revoked' | 'default' | 'off' | 'disabled'

const resolveRoleState = (entry: ModuleRoleEntryUI, roleKey: ModuleRoleKey): RoleVisualState => {
  if (!isRoleSelectableForEntry(entry, roleKey)) {
    return 'disabled'
  }
  const inPending = entry.pendingRoles.includes(roleKey)
  const inDefault = entry.defaultRoles?.includes(roleKey) ?? false

  if (inPending && inDefault) return 'granted'
  if (!inPending && inDefault) return 'revoked'
  if (!inPending && !inDefault) return 'off'
  if (inPending && !inDefault) return 'granted'
  return 'default'
}

const roleClass = (entry: ModuleRoleEntryUI, roleKey: ModuleRoleKey) => {
  const state = resolveRoleState(entry, roleKey)
  const base = 'border-slate-200 text-slate-600 dark:text-slate-200'

  if (state === 'granted') {
    return `${base} bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-500/40 dark:text-emerald-200`
  }
  if (state === 'revoked') {
    return `${base} bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-900/30 dark:border-rose-500/40 dark:text-rose-200`
  }
  if (state === 'disabled') {
    return `${base} opacity-50 cursor-not-allowed`
  }
  if (state === 'default') {
    return `${base} bg-slate-200/40 border-slate-300 dark:bg-white/5`
  }
  return `${base} bg-white dark:bg-[#101a2a]`
}

const roleBadge = (entry: ModuleRoleEntryUI, roleKey: ModuleRoleKey): string | null => {
  const state = resolveRoleState(entry, roleKey)
  if (state === 'granted') return '+ Tillagd'
  if (state === 'revoked') return '− Borttagen'
  return null
}

const badgeClass = (entry: ModuleRoleEntryUI, roleKey: ModuleRoleKey) => {
  const state = resolveRoleState(entry, roleKey)
  if (state === 'granted') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-100'
  }
  if (state === 'revoked') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-800/60 dark:text-rose-100'
  }
  return ''
}

const resetModuleRolesForEntry = (entry: ModuleRoleEntryUI) => {
  entry.pendingRoles = [...entry.defaultRoles]
}

const formatAllowedRoleLabels = (entry: ModuleRoleEntryUI): string[] => {
  if (!entry.allowedRoles || entry.allowedRoles.length === 0) {
    return entry.roleDefinitions.map((role) => role.label)
  }
  return entry.allowedRoles.map(
    (roleKey) => entry.roleDefinitions.find((role) => role.key === roleKey)?.label ?? roleKey
  )
}

const sortRoles = (roles: ModuleRoleKey[]): ModuleRoleKey[] => [...roles].sort()

const equalRoleSets = (a: ModuleRoleKey[], b: ModuleRoleKey[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  const aSorted = sortRoles(a)
  const bSorted = sortRoles(b)
  return aSorted.every((role, index) => role === bSorted[index])
}

const desiredCustomRoles = (entry: ModuleRoleEntryUI): ModuleRoleKey[] => entry.pendingRoles

const isEntryDirty = (entry: ModuleRoleEntryUI): boolean =>
  !equalRoleSets(entry.pendingRoles, entry.effectiveRoles)

const canResetEntry = (entry: ModuleRoleEntryUI): boolean => {
  if (!entry.editable) {
    return false
  }
  if (entry.roleSource === 'custom') {
    return true
  }
  return !equalRoleSets(entry.pendingRoles, entry.defaultRoles ?? [])
}

const memberModuleRoleSourceLabel = (entry: ModuleRoleEntryUI): string => {
  if (entry.roleSource === 'custom') {
    return 'Manuellt tilldelade roller'
  }
  if (entry.roleSource === 'rbac' && selectedMemberForRoles.value) {
    return `Ärvda från RBAC (${getRoleName(selectedMemberForRoles.value.role)})`
  }
  return 'Inga modulroller tilldelade'
}

const saveModuleRoleDrawer = async () => {
  if (!selectedMemberForRoles.value || moduleRoleDrawerSaving.value) {
    return
  }
  const modulesPayload = moduleRoleEntries.value
    .map((entry) => {
      const desired = desiredCustomRoles(entry)
      const original = entry.effectiveRoles
      return equalRoleSets(desired, original)
        ? null
        : {
            moduleId: entry.moduleId,
            roleKeys: desired
          }
    })
    .filter((payload): payload is { moduleId: string; roleKeys: ModuleRoleKey[] } => Boolean(payload))

  if (modulesPayload.length === 0) {
    closeModuleRoleDrawer()
    return
  }

  moduleRoleDrawerSaving.value = true
  moduleRoleDrawerError.value = ''
  try {
    const response = await membersApi.updateMemberModuleRoles(selectedMemberForRoles.value.id, {
      modules: modulesPayload
    })
    moduleRoleEntries.value = response.modules.map((entry) => ({
      ...entry,
      pendingRoles: [...entry.effectiveRoles]
    }))
    if (response.userId) {
      updateOverrideFlagForMember(response.userId, response.modules)
    }
    successMessage.value = 'Modulroller uppdaterades.'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    closeModuleRoleDrawer()
  } catch (error) {
    moduleRoleDrawerError.value = extractErrorMessage(error)
  } finally {
    moduleRoleDrawerSaving.value = false
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

const resendPendingInvitation = async (invite: OrganizationInvitationSummary) => {
  if (invite.status !== 'pending') return
  inviteResendLoadingId.value = invite.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const response = await membersApi.resendInvitation(invite.id)
    const backendMessage = (response as { message?: string })?.message
    successMessage.value =
      backendMessage || `Inbjudan skickades igen till ${invite.email}.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await loadMembers()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || 'Kunde inte skicka om inbjudan.'
  } finally {
    inviteResendLoadingId.value = ''
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
    if (moduleRoleDrawerOpen.value) {
      closeModuleRoleDrawer()
    }
    void loadMembers()
  },
  { immediate: true }
)
</script>


