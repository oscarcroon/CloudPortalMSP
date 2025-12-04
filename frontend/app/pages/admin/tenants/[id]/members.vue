<template>
  <section class="space-y-8">
    <header class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div class="space-y-2">
        <NuxtLink
          :to="`/admin/tenants/${tenantId}`"
          class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
        >
          {{ t('adminTenants.members.backToTenant') }}
        </NuxtLink>
        <div>
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('adminTenants.members.title') }}</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400">{{ t('adminTenants.members.description') }}</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          :disabled="pending"
          @click="refresh"
        >
          <Icon icon="mdi:refresh" class="h-4 w-4" :class="{ 'animate-spin': pending }" />
          {{ pending ? t('adminTenants.members.refreshing') : t('adminTenants.members.refresh') }}
        </button>
        <button
          v-if="canInvite"
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          @click="openInviteModal"
        >
          <Icon icon="mdi:account-plus-outline" class="h-4 w-4" />
          {{ t('adminTenants.members.inviteMember') }}
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
      {{ t('adminTenants.members.loading') }}
    </div>

    <template v-else>
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('adminTenants.members.title') }}</p>
            <div class="relative w-full md:w-64">
              <Icon icon="mdi:magnify" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="t('adminTenants.members.searchPlaceholder')"
                class="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder-slate-500"
              />
            </div>
          </div>
        </div>
        <div v-if="!filteredMembers.length && searchQuery" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.members.noSearchResults', { query: searchQuery }) }}
        </div>
        <div v-else-if="!filteredMembers.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.members.noMembers') }}
        </div>
        <div v-else class="overflow-x-auto overflow-y-visible">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5" style="overflow: visible;">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.name') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.email') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.role') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.mspRoles') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.allOrgs') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.status') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.added') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5" style="position: relative;">
              <tr v-for="member in filteredMembers" :key="member.membershipId">
                <td class="px-6 py-3 text-slate-900 dark:text-white" style="position: relative; overflow: visible;">
                  <div class="flex items-center gap-2">
                    <div>
                      <div class="font-medium">{{ member.fullName ?? '—' }}</div>
                      <p class="text-xs text-slate-500 dark:text-slate-400">{{ member.userId }}</p>
                    </div>
                    <div
                      v-if="member.includeChildren"
                      :ref="(el) => setTooltipRef(member.membershipId, el)"
                      class="group relative inline-flex items-center"
                      @mouseenter="showTooltip(member.membershipId, $event)"
                      @mouseleave="hideTooltip(member.membershipId)"
                    >
                      <Icon
                        icon="mdi:account-hard-hat"
                        class="h-5 w-5 text-brand transition-colors dark:text-brand-light"
                      />
                      <Teleport to="body">
                        <div
                          v-if="visibleTooltips[member.membershipId]"
                          class="pointer-events-none fixed z-[10000] whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-xl dark:bg-slate-700"
                          :style="tooltipStyles[member.membershipId]"
                        >
                          {{ t('adminTenants.members.tooltip.hasAccess') }}
                        </div>
                      </Teleport>
                    </div>
                  </div>
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
                      v-for="role in standardRoleOptions"
                      :key="role"
                      :value="role"
                      :disabled="
                        member.role === 'admin' &&
                        role !== 'admin' &&
                        member.userId === auth.user.value?.id
                      "
                    >
                      {{ tenantRoleLabel(role) }}
                    </option>
                    <option
                      v-if="member.role && !isStandardRole(member.role)"
                      :key="`legacy-role-${member.role}`"
                      :value="member.role"
                      disabled
                    >
                      {{ tenantRoleLabel(member.role) }}
                    </option>
                  </select>
                </td>
                <td class="px-6 py-3">
                  <CheckboxDropdown
                    v-if="mspRoleOptions.length && showMspRoleOptions"
                    :options="mspRoleDropdownOptions"
                    :model-value="memberMspRoles[member.membershipId] || []"
                    :disabled="
                      member.status !== 'active' ||
                      mspRolesLoadingId === member.membershipId ||
                      statusLoadingId === member.membershipId ||
                      deleteLoadingId === member.membershipId
                    "
                    @save="(value) => handleMspRolesChange(member, value)"
                  />
                  <p v-else-if="!showMspRoleOptions" class="text-xs text-slate-400 dark:text-slate-500">
                    —
                  </p>
                  <p v-else class="text-xs text-slate-400 dark:text-slate-500">
                    {{ t('adminTenants.members.mspRoles.none') }}
                  </p>
                </td>
                <td class="px-6 py-3">
                  <div v-if="canEditIncludeChildren(member)" class="inline-flex flex-col gap-1 text-slate-600 dark:text-slate-300">
                    <div class="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                        :checked="member.includeChildren"
                        :disabled="
                          includeChildrenLoadingId === member.membershipId ||
                          !memberHasMspRole(member)
                        "
                        :title="
                          !memberHasMspRole(member)
                            ? t('adminTenants.members.tooltip.addMspRole')
                            : undefined
                        "
                        @change="toggleMemberIncludeChildren(member, ($event.target as HTMLInputElement).checked)"
                      />
                    <span class="text-xs text-slate-500 dark:text-slate-400">
                      {{
                        includeChildrenLoadingId === member.membershipId
                          ? t('adminTenants.members.includeChildren.updating')
                          : member.includeChildren
                            ? t('adminTenants.members.includeChildren.enabled')
                            : t('adminTenants.members.includeChildren.notEnabled')
                        }}
                    </span>
                    </div>
                  </div>
                  <span
                    v-else
                    class="text-xs"
                    :class="member.includeChildren ? 'text-brand font-semibold' : 'text-slate-400 dark:text-slate-500'"
                  >
                    {{ member.includeChildren ? t('adminTenants.members.includeChildren.enabled') : '—' }}
                  </span>
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
                      {{ statusLoadingId === member.membershipId ? t('adminTenants.members.actions.disabling') : t('adminTenants.members.actions.disable') }}
                    </button>
                    <button
                      v-if="member.status === 'suspended'"
                      class="rounded border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 dark:border-emerald-500/30 dark:text-emerald-200"
                      :disabled="statusLoadingId === member.membershipId || deleteLoadingId === member.membershipId"
                      @click="enableMember(member)"
                    >
                      {{ statusLoadingId === member.membershipId ? t('adminTenants.members.actions.enabling') : t('adminTenants.members.actions.enable') }}
                    </button>
                    <button
                      class="rounded border border-red-200 px-3 py-1 text-red-600 transition hover:border-red-300 hover:text-red-500 dark:border-red-500/30 dark:text-red-200"
                      :disabled="deleteLoadingId === member.membershipId || statusLoadingId === member.membershipId"
                      @click="deleteMember(member)"
                    >
                      {{ deleteLoadingId === member.membershipId ? t('adminTenants.members.actions.removing') : t('adminTenants.members.actions.remove') }}
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
          <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('adminTenants.members.invitations.title') }}</p>
        </div>
        <div v-if="!invites.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.members.invitations.none') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.email') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.role') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.table.status') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.invitations.invitedBy') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.invitations.expiresAt') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.invitations.organization') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">{{ t('adminTenants.members.table.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="invite in invites" :key="invite.id">
                <td class="px-6 py-3 text-slate-700 dark:text-slate-200">{{ invite.email }}</td>
                <td class="px-6 py-3">{{ tenantRoleLabel(invite.role) }}</td>
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
                    {{ t('adminTenants.members.invitations.willCreate', { name: invite.organizationName }) }}
                  </span>
                  <span v-else class="text-slate-400 dark:text-slate-500">—</span>
                </td>
                <td class="px-6 py-3 text-right">
                  <div v-if="invite.status === 'pending'" class="flex justify-end gap-2">
                  <button
                      type="button"
                      class="rounded border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-40 dark:border-brand/60 dark:text-brand"
                      :disabled="inviteResendLoadingId === invite.id || inviteCancelLoadingId === invite.id"
                      @click="resendInvite(invite)"
                    >
                      {{ inviteResendLoadingId === invite.id ? t('adminTenants.members.invitations.resending') : t('adminTenants.members.invitations.resend') }}
                    </button>
                    <button
                      type="button"
                    class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="inviteCancelLoadingId === invite.id || inviteResendLoadingId === invite.id"
                    @click="cancelInvite(invite.id)"
                  >
                    {{ inviteCancelLoadingId === invite.id ? t('adminTenants.members.invitations.cancelling') : t('adminTenants.members.invitations.cancel') }}
                  </button>
                  </div>
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
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('adminTenants.members.inviteModal.title') }}</h3>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.inviteModal.email') }}</label>
          <input
            v-model="inviteForm.email"
            type="email"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            @blur="checkUserExists"
          />
          <p v-if="checkingUser" class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.inviteModal.checking') }}</p>
        </div>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.members.inviteModal.role') }}</label>
          <select
            v-model="inviteForm.role"
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
          >
            <option v-for="role in standardRoleOptions" :key="role" :value="role">
              {{ tenantRoleLabel(role) }}
            </option>
          </select>
        </div>
        <div
          v-if="canAssignIncludeChildren"
          class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
        >
          <label class="flex items-start gap-3">
            <input
              v-model="inviteForm.includeChildren"
              type="checkbox"
              class="mt-1 rounded border-slate-300 dark:border-white/20"
            />
            <span>
              {{ t('adminTenants.members.inviteModal.includeChildren.label') }}
              <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.members.inviteModal.includeChildren.description', { tenantName: tenant?.name ?? '' }) }}
              </span>
            </span>
          </label>
          <p class="mt-2 text-xs text-amber-600 dark:text-amber-300">
            {{ t('adminTenants.members.inviteModal.includeChildren.warning') }}
          </p>
        </div>
        <div
          v-if="inviteError"
          class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:text-red-200"
        >
          <Icon icon="mdi:alert-circle-outline" class="mt-0.5 h-5 w-5" />
          <div>
            <p class="font-semibold">{{ t('adminTenants.members.inviteModal.error') }}</p>
            <p class="text-sm">{{ inviteError }}</p>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200" @click="closeInviteModal">
            {{ t('adminTenants.members.inviteModal.cancel') }}
          </button>
          <button
            type="submit"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="inviteSubmitting"
          >
            {{ inviteSubmitting ? t('adminTenants.members.inviteModal.sending') : t('adminTenants.members.inviteModal.send') }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useFetch, useRoute, watch, nextTick } from '#imports'
import { Teleport } from 'vue'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import CheckboxDropdown from '~/components/shared/CheckboxDropdown.vue'
import { standardTenantRoles } from '~/constants/rbac'
import type {
  AdminTenantMembersResponse,
  AdminTenantMember,
  AdminTenantInvite,
  TenantRole
} from '~/types/admin'
import { useAuth } from '~/composables/useAuth'
import { getTenantRoleLabel, MSP_TENANT_ROLES } from '~/utils/tenantRoles'
import { useI18n } from '#imports'

const { t } = useI18n()

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const auth = useAuth()
const standardRoleOptions = [...standardTenantRoles]
const mspRoleOptions = [...MSP_TENANT_ROLES]
const showMspRoleOptions = computed(() => {
  if (!tenant.value) return false
  if (tenant.value.type === 'provider') return true
  if (tenant.value.type === 'distributor') {
    return auth.isSuperAdmin.value
  }
  return false
})
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
const inviteResendLoadingId = ref('')
const includeChildrenLoadingId = ref('')
const mspRolesLoadingId = ref('')

const userExists = ref(false)
const checkingUser = ref(false)
const searchQuery = ref('')

// Tooltip state
const visibleTooltips = reactive<Record<string, boolean>>({})
const tooltipStyles = reactive<Record<string, Record<string, string>>>({})
const tooltipRefs = reactive<Record<string, HTMLElement | null>>({})

const setTooltipRef = (memberId: string, el: any) => {
  if (el) {
    tooltipRefs[memberId] = el as HTMLElement
  }
}

const showTooltip = (memberId: string, event: MouseEvent) => {
  const iconElement = tooltipRefs[memberId]
  if (!iconElement) return
  
  const rect = iconElement.getBoundingClientRect()
  visibleTooltips[memberId] = true
  
  nextTick(() => {
    tooltipStyles[memberId] = {
      top: `${rect.top - 8}px`,
      left: `${rect.right + window.scrollX - 8}px`,
      transform: 'translateY(-100%)',
      position: 'fixed'
    }
  })
}

const hideTooltip = (memberId: string) => {
  visibleTooltips[memberId] = false
  delete tooltipStyles[memberId]
}

const inviteForm = reactive({
  email: '',
  role: 'viewer' as TenantRole,
  includeChildren: false
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
const members = computed<AdminTenantMember[]>(() => data.value?.members ?? [])
const memberMspRoles = reactive<Record<string, TenantRole[]>>({})

const filteredMembers = computed(() => {
  if (!searchQuery.value.trim()) {
    return members.value
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return members.value.filter((member) => {
    const email = member.email?.toLowerCase() ?? ''
    const fullName = member.fullName?.toLowerCase() ?? ''
    const userId = member.userId?.toLowerCase() ?? ''
    
    return email.includes(query) || fullName.includes(query) || userId.includes(query)
  })
})
const invites = computed(() => {
  const result = data.value?.invites ?? []
  if (import.meta.dev) {
    console.log('[tenant-members-ui] Invites:', result)
    console.log('[tenant-members-ui] Data:', data.value)
  }
  return result
})

const syncMemberRoleState = (list: AdminTenantMember[]) => {
  const seen = new Set<string>()
  for (const member of list) {
    seen.add(member.membershipId)
    memberMspRoles[member.membershipId] = [...(member.mspRoles ?? [])]
  }
  for (const key of Object.keys(memberMspRoles)) {
    if (!seen.has(key)) {
      delete memberMspRoles[key]
    }
  }
}

watch(
  () => members.value,
  (list) => {
    if (Array.isArray(list)) {
      syncMemberRoleState(list)
    }
  },
  { immediate: true }
)

const currentTenantRole = computed(() => {
  if (!tenant.value) return null
  return auth.state.value.data?.tenantRoles?.[tenant.value.id] ?? null
})

const isMspRole = (role: string | TenantRole) => role.startsWith('msp-')
const isStandardRole = (role: string | TenantRole) =>
  standardRoleOptions.includes(role as TenantRole)

const tenantRoleLabel = (role: string | TenantRole) => getTenantRoleLabel(role)

const mspRoleDropdownOptions = computed(() =>
  mspRoleOptions.map((role) => ({
    value: role,
    label: getTenantRoleLabel(role),
    description: undefined
  }))
)

const inviteAllowsIncludeChildren = computed(() => {
  const tenantInfo = tenant.value
  if (!tenantInfo) return false
  const selectedRole = inviteForm.role
  const roleAllowsIncludeChildren = isStandardRole(selectedRole) || isMspRole(selectedRole)

  if (!roleAllowsIncludeChildren) {
    return false
  }

  if (tenantInfo.type === 'provider') {
    if (auth.isSuperAdmin.value) return true
    return currentTenantRole.value === 'admin'
  }

  if (tenantInfo.type === 'distributor') {
    return auth.isSuperAdmin.value
  }

  return false
})

const canAssignIncludeChildren = computed(() => inviteAllowsIncludeChildren.value)

watch(
  () => inviteAllowsIncludeChildren.value,
  (allowed) => {
    if (!allowed && inviteForm.includeChildren) {
      inviteForm.includeChildren = false
    }
  }
)

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
  return t(`settings.members.invitationStatus.${status}`)
}

const statusLabel = (status: string) => {
  return t(`settings.members.status.${status}`)
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
  
  inviteSubmitting.value = true
  try {
    const payload: any = {
      email: inviteForm.email.trim(),
      role: inviteForm.role,
      includeChildren: inviteForm.includeChildren
    }
    
    await $fetch(`/api/admin/tenants/${tenantId.value}/members/invite`, {
      method: 'POST',
      body: payload
    })
    closeInviteModal()
    await refresh()
    successMessage.value = t('adminTenants.members.messages.inviteSent')
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    inviteError.value = err instanceof Error ? err.message : t('adminTenants.members.messages.inviteError')
  } finally {
    inviteSubmitting.value = false
  }
}

const cancelInvite = async (inviteId: string) => {
  if (!confirm(t('adminTenants.members.invitations.cancelConfirm'))) {
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
    successMessage.value = t('adminTenants.members.invitations.cancelled')
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.members.invitations.cancelError')
  } finally {
    inviteCancelLoadingId.value = ''
  }
}

const resendInvite = async (invite: AdminTenantInvite) => {
  inviteResendLoadingId.value = invite.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId.value}/invitations/${invite.id}/resend`, {
      method: 'POST'
    })
    await refresh()
    successMessage.value = t('adminTenants.members.invitations.resent', { email: invite.email })
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.members.invitations.resendError')
  } finally {
    inviteResendLoadingId.value = ''
  }
}

const handleRoleChange = async (member: AdminTenantMember, roleValue: string) => {
  if (roleValue === member.role) return
  
  // Prevent self-demotion from admin to any other role
  if (member.role === 'admin' && roleValue !== 'admin' && member.userId === auth.user.value?.id) {
    errorMessage.value = t('adminTenants.members.messages.roleUpdateError')
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
    successMessage.value = t('adminTenants.members.messages.roleUpdated', { email: member.email, role: roleValue })
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await refresh()
  } catch (err) {
    member.role = previousRole
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.members.messages.roleUpdateFailed')
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
      err instanceof Error ? err.message : t('adminTenants.members.messages.statusUpdateFailed')
  } finally {
    statusLoadingId.value = ''
  }
}

const memberHasMspRole = (member: AdminTenantMember) => {
  const assignedRoles = memberMspRoles[member.membershipId] ?? member.mspRoles ?? []
  return (
    member.role.startsWith('msp-') ||
    assignedRoles.some((role) => role.startsWith('msp-'))
  )
}

const canEditIncludeChildren = (member: AdminTenantMember) => {
  const tenantInfo = tenant.value
  if (!tenantInfo) return false
  const roleAllowsIncludeChildren = isStandardRole(member.role) || isMspRole(member.role)

  if (!roleAllowsIncludeChildren) {
    return false
  }

  if (tenantInfo.type === 'provider') {
    if (auth.isSuperAdmin.value) return true
    return currentTenantRole.value === 'admin'
  }

  if (tenantInfo.type === 'distributor') {
    return auth.isSuperAdmin.value
  }

  return false
}

const toggleMemberIncludeChildren = async (member: AdminTenantMember, nextValue: boolean) => {
  if (member.includeChildren === nextValue) return
  includeChildrenLoadingId.value = member.membershipId
  const previousValue = member.includeChildren
  member.includeChildren = nextValue
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(
      `/api/admin/tenants/${tenantId.value}/members/${member.membershipId}/include-children`,
      {
        method: 'PATCH',
        body: { includeChildren: nextValue }
      }
    )
    await refresh()
    successMessage.value = nextValue
      ? t('adminTenants.members.messages.includeChildrenEnabled')
      : t('adminTenants.members.messages.includeChildrenDisabled')
    setTimeout(() => (successMessage.value = ''), 3000)
  } catch (err) {
    member.includeChildren = previousValue
    errorMessage.value =
      err instanceof Error
        ? err.message
        : t('adminTenants.members.messages.includeChildrenUpdateFailed')
  } finally {
    includeChildrenLoadingId.value = ''
  }
}

const handleMspRolesChange = async (member: AdminTenantMember, selectedRoles: string[]) => {
  // Update local state immediately for better UX
  memberMspRoles[member.membershipId] = selectedRoles as TenantRole[]
  
  mspRolesLoadingId.value = member.membershipId
  errorMessage.value = ''
  successMessage.value = ''
  
  const previousRoles = [...(member.mspRoles ?? [])]
  
  try {
    await $fetch(
      `/api/admin/tenants/${tenantId.value}/members/${member.membershipId}/roles`,
      {
        method: 'PATCH',
        body: { mspRoles: selectedRoles }
      }
    )
    await refresh()
    successMessage.value = t('adminTenants.members.messages.mspRolesUpdated')
    setTimeout(() => (successMessage.value = ''), 3000)
  } catch (err) {
    // Revert on error
    memberMspRoles[member.membershipId] = previousRoles
    errorMessage.value =
      err instanceof Error ? err.message : t('adminTenants.members.messages.mspRolesUpdateFailed')
    await refresh()
  } finally {
    mspRolesLoadingId.value = ''
  }
}

const disableMember = (member: AdminTenantMember) =>
  setMemberStatus(member, 'suspended', {
    confirm: t('adminTenants.members.messages.disableConfirm', { email: member.email })
  })

const enableMember = (member: AdminTenantMember) => setMemberStatus(member, 'active')

const deleteMember = async (member: AdminTenantMember) => {
  if (
    !confirm(
      t('adminTenants.members.messages.removeConfirm', { email: member.email })
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
    errorMessage.value = err instanceof Error ? err.message : t('adminTenants.members.messages.removeFailed')
  } finally {
    deleteLoadingId.value = ''
  }
}
</script>

