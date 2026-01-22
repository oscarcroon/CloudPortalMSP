<template>
  <MemberAccessLayout>
    <ClientOnly>
      <div v-if="!currentOrgId" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
        {{ t('settings.members.noActiveOrg') }}
      </div>
      <div v-else class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ memberSummary }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="loading"
            @click="refreshMembers"
          >
            <Icon icon="mdi:refresh" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
            {{ loading ? t('settings.members.refreshing') : t('settings.members.refresh') }}
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!canInviteMembers"
            @click="openInviteModal"
          >
            <Icon icon="mdi:account-plus-outline" class="h-4 w-4" />
            {{ t('settings.members.inviteMember') }}
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
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.members.title') }}</p>
            <span class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('settings.members.table.count', { count: visibleMembers.length }) }}
              <span v-if="searchQuery"> {{ t('settings.members.table.of', { total: members.length }) }}</span>
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
                :placeholder="t('settings.members.searchPlaceholder')"
              />
              <div class="flex gap-2">
                <button
                  v-if="searchQuery || showOnlyOverrides"
                  type="button"
                  class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200"
                  @click="clearFilters"
                >
                  {{ t('settings.members.clear') }}
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
                {{ t('settings.members.showOnlyOverrides') }}
              </label>
            </div>
          </div>
        </div>

        <div v-if="loading" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.members.loading') }}
        </div>

        <div v-else-if="!members.length" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.members.noMembers') }}
        </div>

        <div v-else-if="!visibleMembers.length && (searchQuery || showOnlyOverrides)" class="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>{{ t('settings.members.noSearchResults') }}</p>
          <button
            v-if="searchQuery || showOnlyOverrides"
            type="button"
            class="mt-2 text-xs text-brand underline hover:no-underline"
            @click="clearFilters"
          >
            {{ t('settings.members.clearFilters') }}
          </button>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.table.name') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.table.email') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.table.role') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.table.status') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.table.lastUpdated') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">{{ t('settings.members.table.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="member in visibleMembers" :key="member.id">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-slate-900 dark:text-white">
                      {{ member.displayName || t('settings.members.table.unknownName') }}
                    </p>
                    <ClientOnly>
                      <span
                        v-if="memberHasOverrides(member)"
                        class="inline-flex items-center"
                        :title="t('settings.members.table.hasOverrides')"
                      >
                        <Icon
                          icon="mdi:star-circle"
                          class="h-4 w-4 text-amber-500"
                        />
                      </span>
                    </ClientOnly>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ member.userId ?? t('settings.members.status.notLinked') }}
                  </p>
                </td>
                <td class="px-6 py-4 text-slate-700 dark:text-slate-200">
                  {{ member.email }}
                </td>
                <td class="px-6 py-4">
                  <select
                    :value="member.role"
                    class="role-select rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
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
                      {{ t('settings.members.moduleRoles.button') }}
                    </button>
                    <button
                      v-if="member.status === 'active'"
                      class="rounded border border-amber-200 px-3 py-1 text-amber-700 transition hover:border-amber-300 hover:text-amber-600 disabled:opacity-40 dark:border-amber-500/30 dark:text-amber-200"
                      :disabled="!canManageUsers || statusLoadingId === member.id"
                      @click="disableMember(member)"
                    >
                      {{ statusLoadingId === member.id ? t('settings.members.actions.disabling') : t('settings.members.actions.disable') }}
                    </button>
                    <button
                      v-if="member.status === 'inactive'"
                      class="rounded border border-emerald-200 px-3 py-1 text-emerald-700 transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 dark:border-emerald-500/30 dark:text-emerald-200"
                      :disabled="!canManageUsers || statusLoadingId === member.id"
                      @click="enableMember(member)"
                    >
                      {{ statusLoadingId === member.id ? t('settings.members.actions.enabling') : t('settings.members.actions.enable') }}
                    </button>
                    <button
                      class="rounded border border-red-200 px-3 py-1 font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="!canManageUsers || removalLoadingId === member.id || statusLoadingId === member.id"
                      @click="removeMember(member)"
                    >
                      {{ removalLoadingId === member.id ? t('settings.members.actions.removing') : t('settings.members.actions.remove') }}
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
          <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.members.invitations.title') }}</p>
        </div>
        <div v-if="!invitations.length" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.members.invitations.none') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('settings.members.invitations.email') }}
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('settings.members.invitations.role') }}
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('settings.members.invitations.status') }}
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('settings.members.invitations.invitedBy') }}
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {{ t('settings.members.invitations.expiresAt') }}
                </th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">
                  {{ t('settings.members.invitations.actions') }}
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
                  {{ invite.invitedBy?.fullName || invite.invitedBy?.email || '—' }}
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
                      {{ inviteResendLoadingId === invite.id ? t('settings.members.invitations.resending') : t('settings.members.invitations.resend') }}
                    </button>
                    <button
                      type="button"
                    class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="inviteCancelLoadingId === invite.id || inviteResendLoadingId === invite.id"
                    @click="cancelPendingInvitation(invite)"
                  >
                    {{ inviteCancelLoadingId === invite.id ? t('settings.members.invitations.cancelling') : t('settings.members.invitations.cancel') }}
                  </button>
                  </div>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pending Delegation Invitations Section -->
      <div v-if="delegationInvitations.length > 0" class="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-card dark:border-amber-500/20 dark:bg-amber-900/10">
        <div class="border-b border-amber-200 px-6 py-4 dark:border-amber-500/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="mdi:email-clock-outline" class="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.members.delegationInvitations.title') }}</p>
            </div>
            <NuxtLink 
              to="/settings/delegations" 
              class="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline dark:text-amber-400 dark:hover:text-amber-300"
            >
              {{ t('settings.members.delegationInvitations.manage') }}
            </NuxtLink>
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ t('settings.members.delegationInvitations.description') }}
          </p>
        </div>
        <div class="divide-y divide-amber-100 dark:divide-amber-500/10">
          <div 
            v-for="invite in delegationInvitations" 
            :key="invite.id"
            class="flex items-center justify-between px-6 py-3"
          >
            <div>
              <p class="font-medium text-slate-900 dark:text-white">{{ invite.email }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ t('settings.members.delegationInvitations.sentBy') }} {{ invite.invitedBy?.fullName || invite.invitedBy?.email || '–' }}
              </p>
              <p v-if="invite.note" class="text-xs text-slate-600 dark:text-slate-300">{{ invite.note }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                {{ invite.permissionKeys.length }} {{ t('settings.members.delegationInvitations.permissions') }}
              </span>
              <button
                class="rounded border border-brand/40 px-2 py-1 text-xs text-brand transition hover:bg-brand/10 disabled:opacity-50 dark:border-brand/60 dark:text-brand"
                :disabled="delegationInviteCancelLoadingId === invite.id || delegationInviteResendLoadingId === invite.id"
                @click="resendDelegationInvitation(invite)"
              >
                {{ delegationInviteResendLoadingId === invite.id ? t('settings.members.delegationInvitations.resending') : t('settings.members.delegationInvitations.resend') }}
              </button>
              <button
                class="rounded border border-red-200 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-900/30"
                :disabled="delegationInviteCancelLoadingId === invite.id || delegationInviteResendLoadingId === invite.id"
                @click="cancelDelegationInvitation(invite)"
              >
                {{ delegationInviteCancelLoadingId === invite.id ? t('settings.members.delegationInvitations.cancelling') : t('settings.members.delegationInvitations.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delegated Access Section -->
      <div v-if="delegatedUsers.length > 0" class="rounded-2xl border border-purple-200 bg-purple-50/50 shadow-card dark:border-purple-500/20 dark:bg-purple-900/10">
        <div class="border-b border-purple-200 px-6 py-4 dark:border-purple-500/20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Icon icon="mdi:account-key" class="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.members.delegations.title') }}</p>
            </div>
            <NuxtLink 
              to="/settings/delegations" 
              class="text-xs font-medium text-purple-600 hover:text-purple-700 hover:underline dark:text-purple-400 dark:hover:text-purple-300"
            >
              {{ t('settings.members.delegations.manage') }}
            </NuxtLink>
          </div>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {{ t('settings.members.delegations.description') }}
          </p>
        </div>
        <div class="divide-y divide-purple-100 dark:divide-purple-500/10">
          <div 
            v-for="delegation in delegatedUsers" 
            :key="delegation.subjectId"
            class="flex items-center justify-between px-6 py-3"
          >
            <div>
              <p class="font-medium text-slate-900 dark:text-white">
                {{ delegation.subjectName || delegation.subjectEmail }}
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ delegation.subjectEmail }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">
                {{ delegation.activeCount }} {{ delegation.activeCount === 1 ? t('settings.members.delegations.activeSingular') : t('settings.members.delegations.activePlural') }}
              </span>
              <NuxtLink 
                to="/settings/delegations" 
                class="rounded border border-purple-200 px-2 py-1 text-xs text-purple-600 transition hover:bg-purple-100 dark:border-purple-500/30 dark:text-purple-300 dark:hover:bg-purple-900/30"
              >
                {{ t('settings.members.delegations.view') }}
              </NuxtLink>
            </div>
          </div>
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
  </MemberAccessLayout>

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
              Modulrättigheter (manifest)
            </p>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">
              {{ selectedMemberForRoles?.displayName || selectedMemberForRoles?.email }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Roller (RBAC): {{ selectedMemberForRoles ? getRoleName(selectedMemberForRoles.role) : '' }}
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
            Laddar modulrättigheter...
          </div>
          <div v-else-if="moduleRoleDrawerError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
            {{ moduleRoleDrawerError }}
          </div>
          <div v-else class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0f1a2c]">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-slate-900 dark:text-white">Moduler</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">Manifest-rättigheter + overrides</p>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    v-model="moduleSearch"
                    type="text"
                    class="w-52 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                    placeholder="Sök modul..."
                  />
                  <span>Visar {{ filteredPermissionEntries.length }} av {{ permissionEntries.length }}</span>
              </div>
              </div>

              <div class="mt-3 space-y-3">
                <div
                  v-for="entry in filteredPermissionEntries"
                  :key="entry.moduleId"
                  class="rounded-xl border border-slate-200 bg-slate-50/60 text-sm dark:border-white/10 dark:bg-white/5"
                >
                  <!-- Module header with quick actions -->
                  <div class="flex items-center justify-between px-3 py-2">
                    <div
                      class="flex flex-1 cursor-pointer items-center gap-2"
                      @click="toggleModuleCollapse(entry.moduleId)"
                    >
                      <Icon
                        :icon="isModuleCollapsed(entry.moduleId) ? 'mdi:chevron-right' : 'mdi:chevron-down'"
                        class="h-4 w-4 text-slate-400"
                      />
                      <div class="flex flex-col gap-0.5">
                        <div class="flex items-center gap-2">
                          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ entry.moduleName }}</p>
                          <span
                            v-if="entry.dirty"
                            class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                          >
                            Osparad
                          </span>
                        </div>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400">
                          {{ getModulePermissionSummary(entry) }}
                        </p>
                      </div>
                    </div>
                    <!-- Quick action buttons - always visible -->
                    <div class="flex gap-1">
                      <button
                        class="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                        title="Tillåt alla"
                        :disabled="entry.saving || !entry.permissions.length"
                        @click.stop="setAllModulePermissions(entry.moduleId, 'grant')"
                      >
                        <Icon icon="mdi:check-all" class="h-4 w-4" />
                      </button>
                      <button
                        class="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
                        title="Neka alla"
                        :disabled="entry.saving || !entry.permissions.length"
                        @click.stop="setAllModulePermissions(entry.moduleId, 'deny')"
                      >
                        <Icon icon="mdi:close-circle-outline" class="h-4 w-4" />
                      </button>
                      <button
                        class="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
                        title="Återställ (ärv)"
                        :disabled="entry.saving || !entry.permissions.length"
                        @click.stop="setAllModulePermissions(entry.moduleId, 'inherit')"
                      >
                        <Icon icon="mdi:eraser" class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <!-- Permissions list - expandable -->
                  <div v-if="!isModuleCollapsed(entry.moduleId)" class="border-t border-slate-200 px-3 py-3 dark:border-white/10">
                    <!-- Action buttons row -->
                    <div class="mb-3 flex flex-wrap items-center gap-2">
                      <button
                        class="rounded border border-slate-200 px-3 py-1 text-[11px] text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                        :disabled="entry.loading"
                        @click.stop="loadPermissions(entry.moduleId)"
                      >
                        {{ entry.permissions.length ? 'Uppdatera' : 'Ladda' }}
                      </button>
                      <button
                        class="rounded bg-brand px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
                        :disabled="!entry.dirty || entry.saving"
                        @click.stop="savePermissions(entry.moduleId)"
                      >
                        {{ entry.saving ? 'Sparar…' : 'Spara' }}
                      </button>
                    </div>

                    <p v-if="entry.error" class="mb-2 text-xs text-red-600 dark:text-red-300">{{ entry.error }}</p>
                    <div v-else-if="entry.loading" class="text-xs text-slate-500 dark:text-slate-400">
                      Laddar rättigheter…
                    </div>
                    <div v-else-if="!entry.permissions.length" class="text-xs text-slate-500 dark:text-slate-400">
                      Inga manifestdeklarerade rättigheter. Klicka "Ladda" för att hämta.
                    </div>

                    <!-- Permissions list - single column for sidebar -->
                    <div v-else class="space-y-2">
                      <div
                        v-for="perm in entry.permissions"
                        :key="perm.key"
                        class="rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-black/20"
                      >
                        <!-- Permission name and description -->
                        <div class="mb-2">
                          <p 
                            class="text-sm font-medium text-slate-800 dark:text-slate-100"
                            :title="perm.key"
                          >
                            {{ formatPermissionKey(perm.key) }}
                          </p>
                          <p 
                            v-if="perm.description" 
                            class="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
                            :title="perm.description"
                          >
                            {{ perm.description }}
                          </p>
                        </div>
                        <!-- Action buttons row -->
                        <div class="flex items-center justify-between">
                          <span 
                            class="text-[10px] text-slate-400 dark:text-slate-500"
                            :class="{ 'text-amber-600 dark:text-amber-400': !perm.allowed }"
                          >
                            {{ perm.allowed ? '' : 'Blockerad av policy' }}
                          </span>
                          <div class="flex gap-1">
                            <button
                              :class="[
                                'rounded px-3 py-1.5 text-xs font-medium transition',
                                perm.state === 'grant'
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400'
                              ]"
                              :disabled="!perm.allowed || entry.saving"
                              :title="'Tillåt denna behörighet'"
                              @click="setPermissionState(entry.moduleId, perm.key, 'grant')"
                            >
                              Tillåt
                            </button>
                            <button
                              :class="[
                                'rounded px-3 py-1.5 text-xs font-medium transition',
                                perm.state === 'deny'
                                  ? 'bg-red-500 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                              ]"
                              :disabled="!perm.allowed || entry.saving"
                              :title="'Neka denna behörighet'"
                              @click="setPermissionState(entry.moduleId, perm.key, 'deny')"
                            >
                              Neka
                            </button>
                            <button
                              :class="[
                                'rounded px-3 py-1.5 text-xs font-medium transition',
                                perm.state === 'inherit'
                                  ? 'bg-slate-400 text-white shadow-sm dark:bg-slate-500'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20'
                              ]"
                              :disabled="!perm.allowed || entry.saving"
                              :title="'Ärv från standard (ingen explicit inställning)'"
                              @click="setPermissionState(entry.moduleId, perm.key, 'inherit')"
                            >
                              Ärv
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm dark:border-white/5 dark:bg-white/5">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ anyPermissionsDirty ? 'Osparade ändringar finns' : 'Inga ändringar' }}
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
              :disabled="moduleRoleDrawerSaving || !anyPermissionsDirty"
              @click="saveAllPermissions"
            >
              {{ moduleRoleDrawerSaving ? 'Sparar…' : 'Spara alla' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import InviteMemberDialog from '~/components/organization/InviteMemberDialog.vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useOrganizationMembers } from '~/composables/useOrganizationMembers'
import { usePermission } from '~/composables/usePermission'

const { t } = useI18n()
import type {
  InviteMemberPayload,
  OrganizationInvitationSummary,
  OrganizationMember,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  InvitationStatus,
  MemberModulePermissionsResponse
} from '~/types/members'
import { rbacRoles } from '~/constants/rbac'
import type { RbacRole } from '~/constants/rbac'

const roleOptions: RbacRole[] = [...rbacRoles]
const inviteRoleOptions: RbacRole[] = [...rbacRoles]

const roleNames: Record<RbacRole, string> = {
  owner: t('rbac.roles.owner'),
  admin: t('rbac.roles.admin'),
  operator: t('rbac.roles.operator'),
  member: t('rbac.roles.member'),
  viewer: t('rbac.roles.viewer'),
  support: t('rbac.roles.support')
}

const getRoleName = (role: RbacRole | string): string => roleNames[role as RbacRole] ?? role

const policyModeNames: Record<string, string> = {
  'inherit': 'Ärver',
  'blocked': 'Blockerad',
  'allowlist': 'Tillåtna',
  'default-closed': 'Standard (stängd)'
}
const formatPolicyMode = (mode: string): string => policyModeNames[mode] ?? mode

const membersApi = useOrganizationMembers()
const permission = usePermission()

const members = ref<OrganizationMember[]>([])
const invitations = ref<OrganizationInvitationSummary[]>([])
const organisationName = ref('')
const organisationRequireSso = ref(false)
const loading = ref(false)

// Delegated users (non-members with active delegations)
interface DelegatedUser {
  subjectId: string
  subjectName: string | null
  subjectEmail: string | null
  activeCount: number
}
const delegatedUsers = ref<DelegatedUser[]>([])
interface DelegationInvite {
  id: string
  email: string
  permissionKeys: string[]
  note?: string | null
  expiresAt: number | Date | null
  invitedBy?: { id: string; email: string; fullName?: string | null } | null
}
const delegationInvitations = ref<DelegationInvite[]>([])
const delegationInviteCancelLoadingId = ref('')
const delegationInviteResendLoadingId = ref('')
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

type PermissionState = 'inherit' | 'grant' | 'deny'
interface PermissionEntry {
  key: string
  description?: string | null
  allowed: boolean
  effective: boolean
  source: string
  state: PermissionState
}
interface ModulePermissionEntry {
  moduleId: string
  moduleName: string
  policyMode: string
  allowedPermissions: string[]
  permissions: PermissionEntry[]
  loading: boolean
  saving: boolean
  error: string
  dirty: boolean
}

const permissionEntries = ref<ModulePermissionEntry[]>([])
const searchQuery = ref('')
const showOnlyOverrides = ref(false)
const hasPermissionOverrides = ref<string[]>([])
const overridesLoaded = ref(true)
const moduleSearch = ref('')
const collapsedModules = ref<Record<string, boolean>>({})
const currentOrgId = computed(() => membersApi.currentOrganizationId.value)
const canManageUsers = permission.can('users:manage')
const canInviteMembers = permission.can('users:invite')

const memberSummary = computed(() => {
  if (!members.value.length && !invitations.value.length) {
    return t('settings.members.summary.none')
  }
  const active = members.value.filter((member) => member.status === 'active').length
  const invitedMembers = members.value.filter((member) => member.status === 'invited').length
  const pendingInvites = invitations.value.filter((invite) => invite.status === 'pending').length
  return t('settings.members.summary.format', { active, invited: invitedMembers, pending: pendingInvites })
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

const anyPermissionsDirty = computed(() => permissionEntries.value.some((m) => m.dirty))
const filteredPermissionEntries = computed(() => {
  const q = moduleSearch.value.trim().toLowerCase()
  if (!q) return permissionEntries.value
  return permissionEntries.value.filter((m) => m.moduleName.toLowerCase().includes(q) || m.moduleId.toLowerCase().includes(q))
})

const isModuleCollapsed = (moduleId: string) => collapsedModules.value[moduleId] ?? true
const toggleModuleCollapse = (moduleId: string) => {
  collapsedModules.value[moduleId] = !isModuleCollapsed(moduleId)
}

const updateOverrideFlagForMember = (userId: string, entries: ModulePermissionEntry[]) => {
  if (!userId) return
  const hasCustom = entries.some((entry) => entry.permissions.some((p) => p.state !== 'inherit'))
  const current = hasPermissionOverrides.value
  if (hasCustom) {
    if (!current.includes(userId)) {
      hasPermissionOverrides.value = [...current, userId]
    }
  } else {
    hasPermissionOverrides.value = current.filter((id) => id !== userId)
  }
  overridesLoaded.value = true
}

const loadAllModulePermissions = async (member: OrganizationMember) => {
  permissionEntries.value = []
  moduleRoleDrawerError.value = ''

  try {
    const orgId = currentOrgId.value ?? member.organizationId
    if (!orgId) {
      throw new Error('Ingen aktiv organisation vald.')
    }
    if (!member.userId) {
      throw new Error('Användaren saknar userId och kan inte uppdateras.')
    }

    // Hämta modulstatus (policy) för org
    const modulesStatus = await $fetch<{ modules: any[] }>(`/api/organizations/${orgId}/modules`)

    // Hämta permissions per modul för användaren (separata anrop)
    const entries: ModulePermissionEntry[] = []
    for (const mod of modulesStatus.modules ?? []) {
      const moduleId = mod.key
      entries.push({
        moduleId,
        moduleName: mod.name,
        policyMode: mod.effectivePolicy?.mode ?? 'inherit',
        allowedPermissions: mod.effectivePolicy?.allowedPermissions ?? [],
        permissions: [],
        loading: true,
        saving: false,
        error: '',
        dirty: false
      })
    }
    permissionEntries.value = entries
    // collapse all by default for compact view
    const nextCollapsed: Record<string, boolean> = {}
    for (const entry of entries) {
      nextCollapsed[entry.moduleId] = true
    }
    collapsedModules.value = nextCollapsed

    const userId = member.userId
    await Promise.all(
      permissionEntries.value.map(async (entry) => {
        try {
          const resp = await membersApi.fetchMemberModulePermissions(userId, entry.moduleId)
          entry.allowedPermissions = resp.allowedPermissions ?? []
          entry.policyMode = resp.policyMode ?? entry.policyMode
          entry.permissions =
            resp.permissions?.map((p) => ({
              key: p.key,
              description: p.description ?? null,
              allowed: p.allowed ?? entry.allowedPermissions.includes(p.key),
              effective: !!p.effective,
              source: p.state === 'grant' ? 'user' : p.state === 'deny' ? 'user' : 'inherit',
              state: (p.state as PermissionState) ?? 'inherit'
            })) ?? []
          updateOverrideFlagForMember(userId, permissionEntries.value)
        } catch (err) {
          entry.error = extractErrorMessage(err)
        } finally {
          entry.loading = false
        }
      })
    )
  } catch (error) {
    moduleRoleDrawerError.value = extractErrorMessage(error)
  }
}

const markDirty = (moduleId: string) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (entry) entry.dirty = true
}

// Set a specific permission to a specific state (grant, deny, inherit)
const setPermissionState = (moduleId: string, permKey: string, state: PermissionState) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (!entry) return
  const perm = entry.permissions.find((p) => p.key === permKey)
  if (!perm || !perm.allowed || entry.saving) return
  if (perm.state === state) return // No change
  perm.state = state
  perm.effective = state === 'grant' ? true : state === 'deny' ? false : perm.effective
  markDirty(moduleId)
}

// Set all permissions in a module to the same state
const setAllModulePermissions = (moduleId: string, state: PermissionState) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (!entry || !entry.permissions.length || entry.saving) return
  let changed = false
  for (const perm of entry.permissions) {
    if (perm.allowed && perm.state !== state) {
      perm.state = state
      perm.effective = state === 'grant' ? true : state === 'deny' ? false : perm.effective
      changed = true
    }
  }
  if (changed) markDirty(moduleId)
}

// Get summary text for module header (e.g., "3 tillåtna, 1 nekad")
const getModulePermissionSummary = (entry: ModulePermissionEntry): string => {
  if (!entry.permissions.length) {
    return 'Klicka för att ladda rättigheter'
  }
  const granted = entry.permissions.filter(p => p.state === 'grant').length
  const denied = entry.permissions.filter(p => p.state === 'deny').length
  const inherited = entry.permissions.filter(p => p.state === 'inherit').length
  
  const parts: string[] = []
  if (granted > 0) parts.push(`${granted} tillåtna`)
  if (denied > 0) parts.push(`${denied} nekade`)
  if (inherited > 0 && parts.length === 0) parts.push(`${inherited} ärver`)
  
  return parts.length > 0 ? parts.join(', ') : 'inga explicita inställningar'
}

// Format permission key to readable text
const formatPermissionKey = (key: string): string => {
  // Convert snake_case or kebab-case to title case
  return key
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const savePermissions = async (moduleId: string) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (!entry || !entry.dirty) return
  entry.saving = true
  entry.error = ''
  try {
    const userId = selectedMemberForRoles.value?.userId ?? selectedMemberForRoles.value?.id
    if (!userId) throw new Error('User saknas')
    const grants = entry.permissions.filter((p) => p.state === 'grant').map((p) => p.key)
    const denies = entry.permissions.filter((p) => p.state === 'deny').map((p) => p.key)
    const resp = await membersApi.updateMemberModulePermissions(userId, moduleId, {
      permissionOverrides: { grants, denies }
    })
    
    // Update local permission states from the response (if available) or keep current states
    if (resp.permissions && Array.isArray(resp.permissions)) {
      entry.allowedPermissions = resp.allowedPermissions ?? entry.allowedPermissions
      entry.permissions = resp.permissions.map((p) => ({
        key: p.key,
        description: p.description ?? null,
        allowed: p.allowed ?? entry.allowedPermissions.includes(p.key),
        effective: !!p.effective,
        source: p.state === 'grant' ? 'user' : p.state === 'deny' ? 'user' : 'inherit',
        state: (p.state as PermissionState) ?? 'inherit'
      }))
    } else {
      // API doesn't return full permissions, update local state based on response
      const respOverrides = resp.permissionOverrides as { grants?: string[], denies?: string[] } | undefined
      const savedGrants = new Set(respOverrides?.grants ?? grants)
      const savedDenies = new Set(respOverrides?.denies ?? denies)
      entry.permissions = entry.permissions.map((p) => ({
        ...p,
        state: savedGrants.has(p.key) ? 'grant' as PermissionState : savedDenies.has(p.key) ? 'deny' as PermissionState : 'inherit' as PermissionState,
        source: savedGrants.has(p.key) ? 'user' : savedDenies.has(p.key) ? 'user' : 'inherit',
        effective: savedGrants.has(p.key) ? true : savedDenies.has(p.key) ? false : p.effective
      }))
    }
    
    // Update override flag for the member based on ALL modules
    updateOverrideFlagForMember(userId, permissionEntries.value)
    entry.dirty = false
    successMessage.value = 'Modulrättigheter uppdaterades.'
    setTimeout(() => {
      successMessage.value = ''
    }, 2000)
  } catch (err) {
    entry.error = extractErrorMessage(err)
  } finally {
    entry.saving = false
  }
}

const loadPermissions = (moduleId: string) => loadAllModulePermissions(selectedMemberForRoles.value!)

const resetModulePermissions = (moduleId: string) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (!entry || entry.loading) return
  entry.permissions = entry.permissions.map((p) => ({
    ...p,
    state: 'inherit',
    effective: p.allowed ? p.effective : false
  }))
  entry.dirty = true
  const userId = selectedMemberForRoles.value?.userId
  if (userId) {
    updateOverrideFlagForMember(userId, permissionEntries.value)
  }
}

const saveAllPermissions = async () => {
  moduleRoleDrawerSaving.value = true
  for (const entry of permissionEntries.value) {
    if (entry.dirty) {
      await savePermissions(entry.moduleId)
    }
  }
  moduleRoleDrawerSaving.value = false
}

watch(
  moduleRoleDrawerOpen,
  (open) => {
    if (process.client) {
      if (open) {
        document.body.classList.add('overflow-hidden')
        document.documentElement.classList.add('overflow-hidden')
        document.body.style.overflow = 'hidden'
        document.documentElement.style.overflow = 'hidden'
      } else {
        document.body.classList.remove('overflow-hidden')
        document.documentElement.classList.remove('overflow-hidden')
        document.body.style.overflow = ''
        document.documentElement.style.overflow = ''
      }
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (process.client) {
    document.body.classList.remove('overflow-hidden')
    document.documentElement.classList.remove('overflow-hidden')
    document.body.style.overflow = ''
    document.documentElement.style.overflow = ''
  }
})

const formatDate = (value?: string) => {
  if (!value) return '—'
  return new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

const invitationStatusLabel = (status: InvitationStatus) => {
  if (status === 'pending') return t('settings.members.invitationStatus.pending')
  if (status === 'accepted') return t('settings.members.invitationStatus.accepted')
  if (status === 'cancelled') return t('settings.members.invitationStatus.cancelled')
  return t('settings.members.invitationStatus.expired')
}

const invitationStatusVariant = (status: InvitationStatus) => {
  if (status === 'pending') return 'warning'
  if (status === 'accepted') return 'success'
  if (status === 'cancelled') return 'info'
  return 'danger'
}

const statusLabel = (status: OrganizationMemberStatus) => {
  if (status === 'invited') return t('settings.members.status.invited')
  if (status === 'inactive') return t('settings.members.status.inactive')
  return t('settings.members.status.active')
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
    delegatedUsers.value = []
    organisationName.value = ''
    organisationRequireSso.value = false
    hasPermissionOverrides.value = []
    overridesLoaded.value = true
    return
  }
  loading.value = true
  errorMessage.value = ''
  overridesLoaded.value = false
  try {
    const response = await membersApi.fetchMembers()
    members.value = response.members
    organisationName.value = response.organization.name
    organisationRequireSso.value = Boolean(response.organization.requireSso)
    invitations.value = response.invitations ?? []
    // Hämta vilka användare som har permission-overrides
    const overridesResp = await membersApi.fetchMemberPermissionOverrides()
    hasPermissionOverrides.value = overridesResp?.userIds ?? []
    overridesLoaded.value = true
    
    // Fetch delegations to show non-member delegated users and pending invitations
    try {
      const delegationsResp = await $fetch<{ 
        delegations: Array<{ subjectId: string; subjectName: string | null; subjectEmail: string | null; revokedAt: number | null; expiresAt: number | null }>
        invitations?: DelegationInvite[]
      }>(
        `/api/organizations/${currentOrgId.value}/delegations`
      )
      const memberUserIds = new Set(response.members.map(m => m.userId).filter(Boolean))
      const now = Date.now()
      
      // Group by subjectId and count active delegations
      const groupedBySubject = new Map<string, { subjectName: string | null; subjectEmail: string | null; activeCount: number }>()
      for (const d of delegationsResp.delegations ?? []) {
        // Skip if user is already a member
        if (memberUserIds.has(d.subjectId)) continue
        // Skip revoked or expired
        if (d.revokedAt) continue
        if (d.expiresAt && d.expiresAt <= now) continue
        
        const existing = groupedBySubject.get(d.subjectId)
        if (existing) {
          existing.activeCount++
        } else {
          groupedBySubject.set(d.subjectId, {
            subjectName: d.subjectName,
            subjectEmail: d.subjectEmail,
            activeCount: 1
          })
        }
      }
      
      delegatedUsers.value = Array.from(groupedBySubject.entries()).map(([subjectId, data]) => ({
        subjectId,
        ...data
      }))
      
      // Store pending delegation invitations
      delegationInvitations.value = delegationsResp.invitations ?? []
    } catch {
      // Don't fail the whole load if delegations fail
      delegatedUsers.value = []
      delegationInvitations.value = []
    }
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || 'Kunde inte hämta medlemmar just nu.'
    // Don't set overridesLoaded to true on error - keep it false
  } finally {
    loading.value = false
  }
}

const memberHasOverrides = (member: OrganizationMember): boolean => {
  if (!overridesLoaded.value) return false
  if (!member.userId) return false
  return hasPermissionOverrides.value.includes(member.userId)
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

const openModuleRoleDrawer = async (member: OrganizationMember) => {
  if (!canManageUsers || member.status !== 'active') {
    return
  }
  selectedMemberForRoles.value = member
  permissionEntries.value = []
  moduleRoleDrawerOpen.value = true
  moduleRoleDrawerLoading.value = true
  moduleRoleDrawerSaving.value = false
  moduleRoleDrawerError.value = ''
  try {
    await loadAllModulePermissions(member)
  } catch (error) {
    moduleRoleDrawerError.value = extractErrorMessage(error)
    permissionEntries.value = []
  } finally {
    moduleRoleDrawerLoading.value = false
  }
}

const closeModuleRoleDrawer = () => {
  if (moduleRoleDrawerSaving.value) {
    return
  }
  moduleRoleDrawerOpen.value = false
  permissionEntries.value = []
  moduleRoleDrawerError.value = ''
  selectedMemberForRoles.value = null
}

// Modulroller borttagna; inga roll-hjälpare behövs

// Modulroller borttagna i nya permissionsflödet

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

const cancelDelegationInvitation = async (invite: DelegationInvite) => {
  if (!currentOrgId.value) return
  if (!confirm(t('settings.members.delegationInvitations.cancelConfirm', { email: invite.email }))) {
    return
  }
  delegationInviteCancelLoadingId.value = invite.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(
      `/api/organizations/${currentOrgId.value}/delegations/invitations/${invite.id}`,
      { method: 'DELETE' }
    )
    successMessage.value = t('settings.members.delegationInvitations.cancelSuccess', { email: invite.email })
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await loadMembers()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || t('settings.members.delegationInvitations.cancelError')
  } finally {
    delegationInviteCancelLoadingId.value = ''
  }
}

const resendDelegationInvitation = async (invite: DelegationInvite) => {
  if (!currentOrgId.value) return
  delegationInviteResendLoadingId.value = invite.id
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await $fetch(
      `/api/organizations/${currentOrgId.value}/delegations/invitations/${invite.id}/resend`,
      { method: 'POST' }
    )
    successMessage.value = t('settings.members.delegationInvitations.resendSuccess', { email: invite.email })
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
    await loadMembers()
  } catch (error) {
    errorMessage.value = extractErrorMessage(error) || t('settings.members.delegationInvitations.resendError')
  } finally {
    delegationInviteResendLoadingId.value = ''
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

<style scoped>
.role-select option {
  background-color: rgb(255 255 255);
  color: rgb(15 23 42);
}
:deep(.dark .role-select option),
:global(.dark) .role-select option {
  background-color: rgb(30 41 59);
  color: rgb(226 232 240);
}
</style>

