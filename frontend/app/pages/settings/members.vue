<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/settings"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        {{ t('settings.members.backToSettings') }}
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.members.title') }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('settings.members.pageDescription') }}
        </p>
      </div>
    </header>

    <ClientOnly>
      <div v-if="!currentOrgId" class="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-300">
        {{ t('settings.members.noActiveOrg') }}
      </div>
      <div v-else class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.activeOrganization') }}</p>
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
                  <button
                    class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    @click="toggleModuleCollapse(entry.moduleId)"
                  >
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ entry.moduleName }}</p>
                        <span
                          v-if="entry.dirty"
                          class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                        >
                          Osparad
                        </span>
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400">
                        Policy: {{ entry.policyMode }} | Tillåtna: {{ entry.allowedPermissions.length }}
                      </p>
                    </div>
                    <Icon
                      :icon="isModuleCollapsed(entry.moduleId) ? 'mdi:chevron-down' : 'mdi:chevron-up'"
                      class="h-5 w-5 text-slate-500"
                    />
                  </button>
                  <Transition name="fade">
                    <div v-if="!isModuleCollapsed(entry.moduleId)" class="space-y-2 border-t border-slate-200 px-3 py-3 text-sm dark:border-white/10">
                      <div class="flex flex-wrap items-center gap-2">
                        <button
                          class="rounded border border-slate-200 px-3 py-1 text-[11px] text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                          :disabled="entry.loading"
                          @click.stop="loadPermissions(entry.moduleId)"
                        >
                          {{ entry.permissions.length ? 'Uppdatera' : 'Ladda' }}
                        </button>
                        <button
                          class="rounded border border-slate-200 px-3 py-1 text-[11px] text-slate-700 transition hover:bg-white disabled:opacity-40 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                          :disabled="entry.loading || entry.saving || !entry.permissions.length"
                          @click.stop="resetModulePermissions(entry.moduleId)"
                        >
                          Återställ till standard
                        </button>
                        <button
                          class="rounded bg-brand px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
                          :disabled="!entry.dirty || entry.saving"
                          @click.stop="savePermissions(entry.moduleId)"
                        >
                          {{ entry.saving ? 'Sparar…' : 'Spara' }}
                        </button>
                      </div>
                      <p v-if="entry.error" class="text-xs text-red-600 dark:text-red-300">{{ entry.error }}</p>
                      <div v-else-if="entry.loading" class="text-xs text-slate-500 dark:text-slate-400">
                        Laddar rättigheter…
                      </div>
                      <div v-else-if="!entry.permissions.length" class="text-xs text-slate-500 dark:text-slate-400">
                        Inga manifestdeklarerade rättigheter.
                      </div>
                      <div v-else class="space-y-2">
                        <div
                          v-for="perm in entry.permissions"
                          :key="perm.key"
                          class="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] shadow-sm dark:border-white/5 dark:bg-slate-900"
                        >
                          <div class="flex-1">
                            <p class="font-semibold text-slate-800 dark:text-slate-100">{{ perm.key }}</p>
                            <p v-if="perm.description" class="text-[11px] text-slate-500 dark:text-slate-400">
                              {{ perm.description }}
                            </p>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400">
                              Källa: {{ perm.source }} | Tillåten av policy: {{ perm.allowed ? 'Ja' : 'Nej' }}
                            </p>
                          </div>
                          <div class="flex items-center gap-2">
                            <span
                              class="rounded-full px-2 py-1 text-[11px] font-semibold"
                              :class="perm.effective ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'"
                            >
                              {{ perm.effective ? 'Aktiv' : 'Inaktiv' }}
                            </span>
                            <button
                              class="rounded border border-slate-200 px-3 py-1 text-[11px] font-semibold transition hover:bg-white disabled:opacity-40 dark:border-white/10 dark:text-slate-100 dark:hover:bg-white/10"
                              :disabled="!perm.allowed || entry.saving"
                              @click.stop="togglePermission(entry.moduleId, perm.key)"
                            >
                              {{ perm.state === 'inherit' ? 'Ärv' : perm.state === 'grant' ? 'Tillåt' : 'Neka' }}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Transition>
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
const currentOrgId = computed(() => membersApi.currentOrganisationId.value)
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

const cycleState = (state: PermissionState): PermissionState => {
  if (state === 'inherit') return 'grant'
  if (state === 'grant') return 'deny'
  return 'inherit'
}

const markDirty = (moduleId: string) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (entry) entry.dirty = true
}

const togglePermission = (moduleId: string, permKey: string) => {
  const entry = permissionEntries.value.find((m) => m.moduleId === moduleId)
  if (!entry) return
  const perm = entry.permissions.find((p) => p.key === permKey)
  if (!perm || !perm.allowed || entry.saving) return
  perm.state = cycleState(perm.state)
  perm.effective = perm.state === 'grant' ? true : perm.state === 'deny' ? false : perm.effective
  markDirty(moduleId)
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
    entry.allowedPermissions = resp.allowedPermissions ?? entry.allowedPermissions
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
    organisationName.value = response.organisation.name
    organisationRequireSso.value = Boolean(response.organisation.requireSso)
    invitations.value = response.invitations ?? []
    // Hämta vilka användare som har permission-overrides
    const overridesResp = await membersApi.fetchMemberPermissionOverrides()
    hasPermissionOverrides.value = overridesResp?.userIds ?? []
    overridesLoaded.value = true
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


