<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/tenant-admin"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← Tillbaka
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Medlemmar</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          Hantera roller, se väntande inbjudningar och ta bort åtkomst för organisationen.
        </p>
      </div>
    </header>

    <OrganizationTabs :slug="slug" active="members" />

    <ClientOnly>
      <div v-if="!organizationMeta" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
        Laddar organisation...
      </div>
      <div v-else class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Organisation</p>
            <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ organizationMeta.name }}</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ memberSummary }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              :disabled="pending"
              @click="() => refresh()"
            >
              <Icon icon="mdi:refresh" class="h-4 w-4" :class="{ 'animate-spin': pending }" />
              {{ pending ? 'Uppdaterar...' : 'Uppdatera' }}
            </button>
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="pending"
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

          <div v-if="pending" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
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

          <div v-else>
            <div v-if="members.length > 0" class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
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

            <div class="overflow-x-auto">
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
                  <tr v-for="member in visibleMembers" :key="member.membershipId">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-2">
                        <p class="font-semibold text-slate-900 dark:text-white">
                          {{ member.fullName || 'Okänt namn' }}
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
                        :disabled="member.status !== 'active' || roleLoadingId === member.membershipId || statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                        @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value)"
                      >
                        <option v-for="role in roles" :key="role" :value="role">
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
                      {{ formatDate(member.addedAt) }}
                    </td>
                    <td class="px-6 py-4 text-right">
                      <div class="flex flex-wrap justify-end gap-2 text-xs">
                        <button
                          class="rounded border border-purple-200 px-3 py-1 text-purple-700 transition hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 disabled:opacity-40 dark:border-purple-500/30 dark:text-purple-200 dark:hover:bg-purple-900/30 dark:hover:border-purple-500/40"
                          :disabled="member.status !== 'active' || statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                          @click="openModuleRoleDrawer(member)"
                        >
                          Modulroller
                        </button>
                        <button
                          v-if="member.status === 'active'"
                          class="rounded border border-amber-200 px-3 py-1 text-amber-700 transition hover:border-amber-300 hover:text-amber-600 disabled:opacity-40 dark:border-amber-500/30 dark:text-amber-200"
                          :disabled="statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                          @click="disableMember(member)"
                        >
                          {{ statusLoadingId === member.membershipId ? 'Inaktiverar...' : 'Inaktivera' }}
                        </button>
                        <button
                          v-if="member.status === 'suspended'"
                          class="rounded border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 dark:border-emerald-500/30 dark:text-emerald-200"
                          :disabled="statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                          @click="enableMember(member)"
                        >
                          {{ statusLoadingId === member.membershipId ? 'Aktiverar...' : 'Aktivera' }}
                        </button>
                        <button
                          class="rounded border border-red-200 px-3 py-1 font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
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
          </div>
        </div>

        <div class="rounded-2xl border border-dashed border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-white/5">
          <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">Väntande inbjudningar</p>
          </div>
          <div v-if="!invites.length" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
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
                    Inbjuden av
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
                <tr v-for="invite in invites" :key="invite.id">
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
                    {{ invite.invitedBy?.email || invite.invitedBy?.fullName || '—' }}
                  </td>
                  <td class="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                    {{ formatDate(invite.expiresAt) }}
                  </td>
                  <td class="px-6 py-4 text-right">
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
      </div>
      <template #fallback>
        <div class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
          <div class="h-4 w-32 bg-slate-200 dark:bg-slate-700 animate-pulse rounded mb-2"></div>
          <div class="h-4 w-48 bg-slate-200 dark:bg-slate-700 animate-pulse rounded"></div>
        </div>
      </template>
    </ClientOnly>

    <InviteMemberDialog
      :open="showInviteModal"
      :roles="roles"
      :can-direct-add="allowDirectActivation"
      :loading="inviteSubmitting"
      :error="inviteError"
      @close="closeInviteModal"
      @submit="submitInvite"
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
              {{ selectedMemberForRoles?.fullName || selectedMemberForRoles?.email }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ selectedMemberForRoles ? selectedMemberForRoles.role : '' }}
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
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from '#imports'
import { Icon } from '@iconify/vue'
import InviteMemberDialog from '~/components/organization/InviteMemberDialog.vue'
import OrganizationTabs from '~/components/admin/OrganizationTabs.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { rbacRoles } from '~/constants/rbac'
import type { RbacRole } from '~/constants/rbac'
import type { ModuleRoleDefinition, ModuleRoleKey } from '~/constants/modules'
import type {
  AdminInviteMemberPayload,
  AdminOrganizationMembersResponse,
  AdminOrganizationMember,
  OrganizationMemberStatus
} from '~/types/admin'
import type { MemberModuleRoleEntry, ModuleRoleSource } from '~/types/members'

definePageMeta({
  layout: 'default'
  // API endpoint validates tenant permissions
})

const route = useRoute()
const roles = [...rbacRoles]
const slug = computed(() => route.params.slug as string)

const showInviteModal = ref(false)
const inviteSubmitting = ref(false)
const inviteError = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const roleLoadingId = ref('')
const statusLoadingId = ref('')
const deleteLoadingId = ref('')
const inviteCancelLoadingId = ref('')
const searchQuery = ref('')
const showOnlyOverrides = ref(false)

const hasModuleRoleOverrides = ref<string[]>([])
const overridesLoaded = ref(false)
const moduleRoleDrawerOpen = ref(false)
const moduleRoleDrawerLoading = ref(false)
const moduleRoleDrawerSaving = ref(false)
const moduleRoleDrawerError = ref('')
const selectedMemberForRoles = ref<AdminOrganizationMember | null>(null)

interface ModuleRoleEntryUI extends MemberModuleRoleEntry {
  pendingRoles: ModuleRoleKey[]
}

const moduleRoleEntries = ref<ModuleRoleEntryUI[]>([])

const { data, pending, refresh, error } = await (useFetch as any)(
  `/api/admin/organizations/${slug.value}/members`,
  {
    watch: [slug]
  }
)

if (error.value) {
  errorMessage.value = error.value.message || 'Kunde inte hämta medlemmar.'
}

const organizationMeta = computed(() => data.value?.organization)
const members = computed(() => data.value?.members ?? [])
const invites = computed(() => data.value?.invites ?? [])
const allowDirectActivation = computed(() => Boolean(organizationMeta.value?.requireSso))

const memberSummary = computed(() => {
  if (!members.value.length && !invites.value.length) {
    return 'Inga medlemmar eller väntande inbjudningar registrerade.'
  }
  const active = members.value.filter((member: any) => member.status === 'active').length
  const invitedMembers = members.value.filter((member: any) => member.status === 'invited').length
  const pendingInvites = invites.value.filter((invite: any) => invite.status === 'pending').length
  return `${active} aktiva · ${invitedMembers} inbjudna · ${pendingInvites} väntande inbjudningar`
})

const visibleMembers = computed(() => {
  let filtered = members.value

  // Filter by override status
  if (showOnlyOverrides.value) {
    filtered = filtered.filter((member: any) => memberHasOverrides(member))
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.trim().toLowerCase()
    filtered = filtered.filter((member: any) => {
      const displayName = (member.fullName || '').toLowerCase()
      const email = (member.email || '').toLowerCase()
      return displayName.includes(query) || email.includes(query)
    })
  }

  return filtered
})

const moduleRoleDrawerDirty = computed(() =>
  moduleRoleEntries.value.some((entry) => isEntryDirty(entry))
)

const formatDate = (value: number | string) => {
  if (!value) return '—'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  return date.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const invitationStatusLabel = (status: string) => {
  if (status === 'pending') return 'Avvaktar'
  if (status === 'accepted') return 'Accepterad'
  if (status === 'cancelled') return 'Avbruten'
  return 'Utgången'
}

const invitationStatusVariant = (status: string) => {
  if (status === 'pending') return 'warning'
  if (status === 'accepted') return 'success'
  if (status === 'cancelled') return 'info'
  return 'danger'
}

const statusLabel = (status: OrganizationMemberStatus) => {
  if (status === 'invited') return 'Inbjuden'
  if (status === 'suspended') return 'Avslutad'
  return 'Aktiv'
}

const statusVariant = (status: OrganizationMemberStatus) => {
  if (status === 'active') return 'success'
  if (status === 'invited') return 'warning'
  if (status === 'suspended') return 'danger'
  return 'info'
}

const loadMemberModuleRoleOverrides = async () => {
  if (!organizationMeta.value?.id) {
    hasModuleRoleOverrides.value = []
    overridesLoaded.value = false
    return
  }
  try {
    const response = await ($fetch as any)(
      `/api/organizations/${organizationMeta.value.id}/members/module-role-overrides`
    )
    const userIds = Array.isArray(response?.userIds) ? response.userIds.filter(Boolean) : []
    hasModuleRoleOverrides.value = userIds
    overridesLoaded.value = true
  } catch (error: any) {
    // If we get 401, it might be a timing issue with session initialization
    // Retry once after a short delay
    if (error?.statusCode === 401 || error?.status === 401) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500))
        const response = await ($fetch as any)(
          `/api/organizations/${organizationMeta.value.id}/members/module-role-overrides`
        )
        const userIds = Array.isArray(response?.userIds) ? response.userIds.filter(Boolean) : []
        hasModuleRoleOverrides.value = userIds
        overridesLoaded.value = true
        return
      } catch (retryError) {
        // Still failed after retry, proceed with graceful degradation
        console.warn('Could not load member module role overrides after retry (will discover on demand):', retryError)
      }
    } else {
      console.warn('Could not load member module role overrides (will discover on demand):', error)
    }
    hasModuleRoleOverrides.value = []
    overridesLoaded.value = true
  }
}

const updateOverrideFlagForMember = (userId: string, modules: MemberModuleRoleEntry[]) => {
  if (!userId) return
  const hasCustom = modules.some((entry) => entry.roleSource === 'custom')
  const current = hasModuleRoleOverrides.value
  if (hasCustom) {
    if (!current.includes(userId)) {
      hasModuleRoleOverrides.value = [...current, userId]
    }
  } else {
    hasModuleRoleOverrides.value = current.filter((id) => id !== userId)
  }
  overridesLoaded.value = true
}

const memberHasOverrides = (member: AdminOrganizationMember): boolean => {
  if (pending.value || !overridesLoaded.value) {
    return false
  }
  if (!member.userId) {
    return false
  }
  return hasModuleRoleOverrides.value.includes(member.userId)
}

const clearFilters = () => {
  searchQuery.value = ''
  showOnlyOverrides.value = false
}

const openInviteModal = () => {
  inviteError.value = ''
  showInviteModal.value = true
}

const closeInviteModal = () => {
  showInviteModal.value = false
}

const submitInvite = async (payload: { email: string; role: RbacRole; directAdd?: boolean }) => {
  inviteSubmitting.value = true
  inviteError.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await ($fetch as any)(`/api/admin/organizations/${slug.value}/members/invite`, {
      method: 'POST',
      body: payload as AdminInviteMemberPayload
    })
    showInviteModal.value = false
    successMessage.value = `Inbjudan skickades till ${payload.email}.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await refresh()
    await loadMemberModuleRoleOverrides()
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
    await ($fetch as any)(`/api/admin/organizations/${slug.value}/invitations/${inviteId}/cancel`, {
      method: 'DELETE'
    })
    successMessage.value = 'Inbjudan avbröts.'
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await refresh()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte avbryta inbjudan.'
  } finally {
    inviteCancelLoadingId.value = ''
  }
}

const handleRoleChange = async (member: AdminOrganizationMember, roleValue: string) => {
  if (roleValue === member.role) return
  const previousRole = member.role
  roleLoadingId.value = member.membershipId
  member.role = roleValue as typeof member.role
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await ($fetch as any)(`/api/admin/organizations/${slug.value}/members/${member.membershipId}/update-role`, {
      method: 'POST',
      body: { role: roleValue }
    })
    successMessage.value = `Rollen för ${member.email} uppdaterades till ${roleValue}.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await refresh()
    await loadMemberModuleRoleOverrides()
  } catch (err) {
    member.role = previousRole
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte uppdatera rollen.'
  } finally {
    roleLoadingId.value = ''
  }
}

const setMemberStatus = async (
  member: AdminOrganizationMember,
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
    await ($fetch as any)(
      `/api/admin/organizations/${slug.value}/members/${member.membershipId}/status`,
      {
        method: 'PATCH',
        body: { status: nextStatus }
      }
    )
    member.status = nextStatus as OrganizationMemberStatus
    successMessage.value =
      nextStatus === 'active'
        ? `${member.email} aktiverades.`
        : `${member.email} inaktiverades.`
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await refresh()
    await loadMemberModuleRoleOverrides()
  } catch (err) {
    errorMessage.value =
      err instanceof Error ? err.message : 'Kunde inte uppdatera medlemsstatus.'
  } finally {
    statusLoadingId.value = ''
  }
}

const disableMember = (member: AdminOrganizationMember) =>
  setMemberStatus(member, 'suspended', {
    confirm: `Inaktivera ${member.email}? Personen kan inte logga in förrän kontot aktiveras igen.`
  })

const enableMember = (member: AdminOrganizationMember) => setMemberStatus(member, 'active')

const deleteMember = async (member: AdminOrganizationMember) => {
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
    await ($fetch as any)(`/api/admin/organizations/${slug.value}/members/${member.membershipId}/remove`, {
      method: 'DELETE'
    })
    await refresh()
    await loadMemberModuleRoleOverrides()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Kunde inte ta bort medlemmen.'
  } finally {
    deleteLoadingId.value = ''
  }
}

const moduleRolePolicySource = (source: ModuleRoleSource | null): string => {
  if (source === 'module-default') return 'modulens standard'
  if (source === 'distributor') return 'distributörsnivå'
  if (source === 'provider') return 'leverantörsnivå'
  if (source === 'organization') return 'organisationen'
  return 'högre nivå'
}

const openModuleRoleDrawer = async (member: AdminOrganizationMember) => {
  if (member.status !== 'active') {
    return
  }
  selectedMemberForRoles.value = member
  moduleRoleDrawerOpen.value = true
  moduleRoleDrawerLoading.value = true
  moduleRoleDrawerSaving.value = false
  moduleRoleDrawerError.value = ''
  try {
    if (!organizationMeta.value?.id || !member.userId) {
      throw new Error('Saknar organisation eller användar-ID')
    }
    const response = await ($fetch as any)(`/api/organizations/${organizationMeta.value.id}/members/${member.membershipId}/module-roles`)
    moduleRoleEntries.value = response.modules.map((entry: any) => ({
      ...entry,
      pendingRoles: [...entry.effectiveRoles]
    }))
    if (response.userId) {
      updateOverrideFlagForMember(response.userId, response.modules)
    }
  } catch (error) {
    moduleRoleDrawerError.value =
      error instanceof Error ? error.message : 'Kunde inte ladda modulroller.'
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
  entry.pendingRoles = [...(entry.defaultRoles || [])]
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
    return `Ärvda från RBAC (${selectedMemberForRoles.value.role})`
  }
  return 'Inga modulroller tilldelade'
}

const saveModuleRoleDrawer = async () => {
  if (!selectedMemberForRoles.value || moduleRoleDrawerSaving.value || !organizationMeta.value?.id) {
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
    const response = await ($fetch as any)(
      `/api/organizations/${organizationMeta.value.id}/members/${selectedMemberForRoles.value.membershipId}/module-roles`,
      {
        method: 'PUT',
        body: {
          modules: modulesPayload
        }
      }
    )
    moduleRoleEntries.value = response.modules.map((entry: any) => ({
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
    await refresh()
    await loadMemberModuleRoleOverrides()
  } catch (error) {
    moduleRoleDrawerError.value =
      error instanceof Error ? error.message : 'Kunde inte spara modulroller.'
  } finally {
    moduleRoleDrawerSaving.value = false
  }
}

watch(
  () => data.value,
  () => {
    if (data.value?.organization?.id) {
      void loadMemberModuleRoleOverrides()
    }
  },
  { immediate: true }
)
</script>

