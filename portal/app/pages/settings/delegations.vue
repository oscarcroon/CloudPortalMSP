<template>
  <MemberAccessLayout>
    <div class="space-y-8">
      <div v-if="errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/5 dark:text-red-200">
        {{ errorMessage }}
      </div>

      <!-- Info callout explaining delegations -->
      <div class="rounded-2xl border border-brand/20 bg-brand/5 p-5 dark:border-brand/30 dark:bg-brand/10">
        <div class="flex items-start gap-4">
          <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/20">
            <Icon icon="mdi:account-key-outline" class="h-5 w-5" />
          </div>
          <div class="flex-1 space-y-2">
            <h3 class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.delegations.info.title') }}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-300">
              {{ t('settings.delegations.info.description') }}
            </p>
            <ul class="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <li class="flex items-start gap-2">
                <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span>{{ t('settings.delegations.info.useCase1') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span>{{ t('settings.delegations.info.useCase2') }}</span>
              </li>
              <li class="flex items-start gap-2">
                <Icon icon="mdi:check-circle" class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <span>{{ t('settings.delegations.info.useCase3') }}</span>
              </li>
            </ul>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:information-outline" class="mr-1 inline h-3.5 w-3.5" />
              {{ t('settings.delegations.info.note') }}
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
          <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/5">
            <div class="flex items-center gap-3">
              <div>
                <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.delegations.list.title') }}</p>
                <p class="text-sm text-slate-600 dark:text-slate-300">
                  {{ visibleDelegations.filter(d => !d.revokedAt && !isExpired(d)).length }} st
                  <span v-if="groupedDelegations.length > 0" class="text-xs text-slate-500">
                    ({{ groupedDelegations.length }} {{ t('settings.delegations.list.users') }})
                  </span>
                </p>
              </div>
            </div>
            <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input v-model="showRevoked" type="checkbox" class="rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20" />
              {{ t('settings.delegations.list.showRevoked') }}
            </label>
          </div>

          <div v-if="pending" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-300">
            {{ t('settings.delegations.list.loading') }}
          </div>
          <div v-else-if="!delegations.length" class="px-6 py-8 text-sm text-slate-500 dark:text-slate-300">
            {{ t('settings.delegations.list.empty') }}
          </div>
          <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
            <details
              v-for="group in groupedDelegations"
              :key="group.subjectId"
              class="group"
            >
              <summary class="cursor-pointer px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors list-none">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <Icon icon="mdi:chevron-down" class="chevron-icon h-5 w-5 text-slate-400 transition-transform duration-200 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold text-slate-900 dark:text-white truncate">
                        {{ group.subjectName || group.subjectEmail || group.subjectId }}
                      </p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {{ group.subjectEmail || group.subjectId }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <span
                      v-if="group.activeCount > 0"
                      class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                    >
                      {{ group.activeCount }} {{ group.activeCount !== 1 ? t('settings.delegations.list.activePlural') : t('settings.delegations.list.active') }}
                    </span>
                    <span
                      v-if="group.expiredCount > 0"
                      class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                    >
                      {{ group.expiredCount }} {{ group.expiredCount !== 1 ? t('settings.delegations.list.expiredPlural') : t('settings.delegations.list.expired') }}
                    </span>
                    <span
                      v-if="group.revokedCount > 0"
                      class="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
                    >
                      {{ group.revokedCount }} {{ group.revokedCount !== 1 ? t('settings.delegations.list.revokedPlural') : t('settings.delegations.list.revoked') }}
                    </span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      ({{ group.delegations.length }} {{ t('settings.delegations.list.total') }})
                    </span>
                  </div>
                </div>
              </summary>
              <div class="divide-y divide-slate-100 dark:divide-white/5 border-t border-slate-200 dark:border-white/5">
                <div
                  v-for="delegation in group.delegations"
                  :key="delegation.id"
                  class="px-6 py-4 bg-slate-50/50 dark:bg-white/2"
                >
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <span
                          v-if="delegation.revokedAt"
                          class="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
                        >
                          {{ t('settings.delegations.list.revoked') }}
                        </span>
                        <span
                          v-else-if="isExpired(delegation)"
                          class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                        >
                          {{ t('settings.delegations.list.expired') }}
                        </span>
                        <span
                          v-else
                          class="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
                        >
                          {{ t('settings.delegations.list.active') }}
                        </span>
                      </div>
                      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {{ t('settings.delegations.list.validUntil') }} {{ formatExpires(delegation.expiresAt) }}
                      </p>
                      <p v-if="delegation.note" class="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {{ delegation.note }}
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <button
                        class="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                        :disabled="pendingAction === delegation.id || delegation.revokedAt !== null"
                        @click.stop="revokeDelegation(delegation)"
                      >
                        {{ pendingAction === delegation.id ? t('settings.delegations.list.revoking') : t('settings.delegations.list.revoke') }}
                      </button>
                      <button
                        class="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                        @click.stop="togglePermissions(delegation.id)"
                      >
                        <span v-if="expanded.has(delegation.id)">{{ t('settings.delegations.list.hidePermissions') }}</span>
                        <span v-else>{{ t('settings.delegations.list.showPermissions') }}</span>
                      </button>
                    </div>
                  </div>
                  <div v-if="expanded.has(delegation.id)" class="mt-3 rounded-lg bg-white p-3 text-xs text-slate-700 dark:bg-black/20 dark:text-slate-200">
                    <p class="mb-2 font-semibold">{{ t('settings.delegations.list.permissions') }}</p>
                    <ul class="flex flex-wrap gap-2">
                      <li
                        v-for="perm in delegation.permissionKeys"
                        :key="perm"
                        class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:bg-black/30 dark:text-slate-100"
                      >
                        {{ perm }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <!-- Pending invitations section -->
          <div v-if="invitations.length > 0" class="border-t border-slate-200 dark:border-white/5">
            <div class="flex items-center justify-between px-6 py-3 bg-amber-50/50 dark:bg-amber-900/10">
              <div class="flex items-center gap-2">
                <Icon icon="mdi:email-clock-outline" class="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p class="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  {{ t('settings.delegations.invitations.title') }}
                </p>
              </div>
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
                {{ invitations.length }}
              </span>
            </div>
            <div class="divide-y divide-slate-100 dark:divide-white/5">
              <div
                v-for="invite in invitations"
                :key="invite.id"
                class="flex items-center justify-between px-6 py-4"
              >
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white truncate">{{ invite.email }}</p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ t('settings.delegations.invitations.sentBy') }} {{ invite.invitedBy?.fullName || invite.invitedBy?.email || '–' }}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ t('settings.delegations.invitations.expires') }} {{ formatExpires(invite.expiresAt) }}
                  </p>
                  <p v-if="invite.note" class="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {{ invite.note }}
                  </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
                    {{ invite.permissionKeys.length }} {{ t('settings.delegations.invitations.permissions') }}
                  </span>
                  <button
                    class="rounded border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50 dark:border-brand/60 dark:text-brand"
                    :disabled="pendingAction === invite.id"
                    @click="resendInvitation(invite)"
                  >
                    {{ pendingAction === `resend-${invite.id}` ? t('settings.delegations.invitations.resending') : t('settings.delegations.invitations.resend') }}
                  </button>
                  <button
                    class="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                    :disabled="pendingAction === invite.id"
                    @click="cancelInvitation(invite)"
                  >
                    {{ pendingAction === invite.id ? t('settings.delegations.invitations.cancelling') : t('settings.delegations.invitations.cancel') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-white/10 dark:bg-[#0c1524]">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('settings.delegations.form.title') }}</h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ t('settings.delegations.form.description') }}
            </p>

            <div class="mt-4 space-y-4">
              <!-- Tab switcher: Invite external / Existing user -->
              <div class="flex rounded-lg border border-slate-200 p-1 dark:border-white/10">
                <button
                  type="button"
                  :class="[
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition',
                    recipientMode === 'invite'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  ]"
                  @click="recipientMode = 'invite'"
                >
                  <Icon icon="mdi:email-plus-outline" class="mr-1.5 inline h-4 w-4" />
                  {{ t('settings.delegations.form.tabInvite') }}
                </button>
                <button
                  type="button"
                  :class="[
                    'flex-1 rounded-md px-3 py-2 text-sm font-medium transition',
                    recipientMode === 'existing'
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                  ]"
                  @click="recipientMode = 'existing'"
                >
                  <Icon icon="mdi:account-search" class="mr-1.5 inline h-4 w-4" />
                  {{ t('settings.delegations.form.tabExisting') }}
                </button>
              </div>

              <!-- Existing user search (among organization members) -->
              <div v-if="recipientMode === 'existing'">
                <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.searchUser') }}</label>
                <div class="mt-1">
                  <input
                    v-model="userQuery"
                    type="text"
                    class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                    :placeholder="t('settings.delegations.form.searchPlaceholder')"
                  />
                </div>
                <div v-if="loadingMembers" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  <div class="flex items-center gap-2">
                    <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
                    <span>{{ t('settings.delegations.form.searching') }}</span>
                  </div>
                </div>
                <div v-else-if="userResults.length" class="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-white/10 dark:bg-white/5">
                  <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.results') }} ({{ userResults.length }})</p>
                  <button
                    v-for="member in userResults"
                    :key="member.userId"
                    type="button"
                    class="flex w-full items-center justify-between rounded-lg bg-white px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:bg-black/20 dark:text-slate-100 dark:hover:bg-black/30"
                    @click="selectUser(member)"
                  >
                    <div>
                      <p class="font-semibold">{{ member.fullName || member.email }}</p>
                      <p class="text-xs text-slate-500">{{ member.email }}</p>
                    </div>
                    <Icon v-if="selectedUserId === member.userId" icon="mdi:check" class="h-4 w-4 text-brand" />
                  </button>
                </div>
                <p v-if="selectedUser" class="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                  {{ t('settings.delegations.form.selectedUser') }} {{ selectedUser.fullName || selectedUser.email }}
                </p>
                <div
                  v-if="selectedUser && hasActiveDelegation"
                  class="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                >
                  <div class="flex items-start gap-2">
                    <Icon icon="mdi:alert" class="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p class="font-semibold">
                        {{ t('settings.delegations.form.existingDelegationWarning', { count: activeDelegationCount }, activeDelegationCount) }}
                      </p>
                      <p class="mt-1 text-amber-700 dark:text-amber-300">
                        {{ t('settings.delegations.form.existingDelegationNote') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Invite external user -->
              <div v-else>
                <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.inviteEmail') }}</label>
                <input
                  v-model="inviteEmail"
                  type="email"
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  :placeholder="t('settings.delegations.form.inviteEmailPlaceholder')"
                />
              </div>

              <!-- STEP 1: Choose modules -->
              <div class="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/5">
                <div class="flex items-center gap-3 mb-3">
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">1</span>
                  <h3 class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('settings.delegations.form.chooseModules') }}</h3>
                  <div class="ml-auto flex gap-2">
                    <button
                      type="button"
                      class="text-xs text-brand hover:underline"
                      @click="selectAllModules"
                    >
                      {{ t('settings.delegations.form.selectAll') }}
                    </button>
                    <span class="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      class="text-xs text-brand hover:underline"
                      @click="deselectAllModules"
                    >
                      {{ t('settings.delegations.form.deselectAll') }}
                    </button>
                  </div>
                </div>
                <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.modulesDescription') }}</p>
                
                <div class="space-y-2 max-h-48 overflow-y-auto">
                  <div v-if="!moduleList || moduleList.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                    {{ t('settings.delegations.form.noModules') }}
                  </div>
                  <label
                    v-for="module in moduleList"
                    :key="module.key"
                    class="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3 transition hover:bg-slate-100 dark:bg-black/20 dark:hover:bg-black/30"
                  >
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                      :checked="selectedModules.has(module.key)"
                      @change="toggleModule(module.key, ($event.target as HTMLInputElement).checked)"
                    />
                    <Icon v-if="module.icon" :icon="module.icon" class="h-5 w-5 text-brand" />
                    <div class="flex-1">
                      <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">{{ module.name }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ t('settings.delegations.form.permissionsCount', { count: (module.permissions || []).length }, (module.permissions || []).length) }}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- STEP 2: Fine-tune permissions (only visible when modules selected) -->
              <div 
                :class="[
                  'rounded-xl border p-4 transition-all duration-200',
                  selectedModules.size > 0 
                    ? 'border-slate-200 bg-slate-50/50 dark:border-white/10 dark:bg-white/5' 
                    : 'border-dashed border-slate-300 bg-slate-100/50 dark:border-white/10 dark:bg-white/2'
                ]"
              >
                <div class="flex items-center gap-3 mb-3">
                  <span 
                    :class="[
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      selectedModules.size > 0 
                        ? 'bg-brand text-white' 
                        : 'bg-slate-300 text-slate-500 dark:bg-slate-600 dark:text-slate-400'
                    ]"
                  >2</span>
                  <h3 
                    :class="[
                      'text-sm font-semibold',
                      selectedModules.size > 0 
                        ? 'text-slate-900 dark:text-white' 
                        : 'text-slate-400 dark:text-slate-500'
                    ]"
                  >{{ t('settings.delegations.form.finetunePermissions') }}</h3>
                  <span 
                    v-if="selectedModules.size > 0 && hasCustomPermissionSelection" 
                    class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
                  >
                    {{ t('settings.delegations.form.customized') }}
                  </span>
                </div>

                <!-- Placeholder when no modules selected -->
                <div v-if="selectedModules.size === 0" class="py-6 text-center">
                  <Icon icon="mdi:tune-vertical" class="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p class="text-sm text-slate-400 dark:text-slate-500">{{ t('settings.delegations.form.selectModulesFirst') }}</p>
                </div>

                <!-- Permission fine-tuning when modules are selected -->
                <template v-else>
                  <p class="mb-3 text-xs text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.finetuneDescription') }}</p>
                  
                  <div class="mb-3">
                    <input
                      v-model="moduleSearchQuery"
                      type="text"
                      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                      :placeholder="t('settings.delegations.form.searchModules')"
                    />
                  </div>
                  
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    <details
                      v-for="module in selectedModulesWithPermissions"
                      :key="module.key"
                      :open="moduleSearchQuery.trim() !== ''"
                      class="group rounded-lg bg-white dark:bg-black/20"
                    >
                      <summary class="flex cursor-pointer items-center justify-between gap-2 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                          <Icon icon="mdi:chevron-down" class="chevron-icon h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0" />
                          <Icon v-if="module.icon" :icon="module.icon" class="h-4 w-4 text-brand flex-shrink-0" />
                          <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ module.name }}</span>
                        </div>
                        <span 
                          :class="[
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0',
                            getModuleSelectedCount(module.key) === (module.permissions || []).length
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                          ]"
                        >
                          {{ getModuleSelectedCount(module.key) === (module.permissions || []).length 
                              ? t('settings.delegations.form.allPermissionsSelected')
                              : t('settings.delegations.form.somePermissionsSelected', { selected: getModuleSelectedCount(module.key), total: (module.permissions || []).length })
                          }}
                        </span>
                      </summary>
                      <div class="px-3 pb-3 space-y-1.5">
                        <label
                          v-for="perm in (module.permissions || [])"
                          :key="perm.key"
                          class="flex cursor-pointer items-start gap-2 rounded p-1.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            class="mt-0.5 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                            :checked="selectedPermissions.has(perm.key)"
                            @change="togglePermission(perm.key, ($event.target as HTMLInputElement).checked)"
                          />
                          <div class="flex-1 min-w-0">
                            <p class="font-medium truncate">{{ perm.key }}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ perm.label }}</p>
                          </div>
                        </label>
                      </div>
                    </details>
                  </div>

                  <!-- Summary -->
                  <p v-if="selectedModules.size > 0" class="mt-3 text-xs text-emerald-600 dark:text-emerald-300">
                    {{ t('settings.delegations.form.modulesSelected', { modules: selectedModules.size, permissions: totalSelectedPermissions }, selectedModules.size) }}
                  </p>
                </template>
              </div>

              <p v-if="selectedModules.size > 0 && !selectedPermissions.size" class="text-xs text-amber-600 dark:text-amber-300">
                {{ t('settings.delegations.form.selectPermission') }}
              </p>

              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.expiresAt') }}</label>
                  <input
                    v-model="expiresAtInput"
                    type="datetime-local"
                    class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  />
                </div>
                <div>
                  <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.delegations.form.note') }}</label>
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
                  v-if="recipientMode === 'existing'"
                  class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canCreate || creating"
                  @click="createDelegation"
                >
                  <Icon v-if="creating" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                  <span>{{ creating ? t('settings.delegations.form.creating') : t('settings.delegations.form.create') }}</span>
                </button>
                <button
                  v-else
                  class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!canInvite || inviting"
                  @click="inviteAndCreateDelegation"
                >
                  <Icon v-if="inviting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                  <span>{{ inviting ? t('settings.delegations.form.inviting') : t('settings.delegations.form.invite') }}</span>
                </button>
                <button
                  class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                  type="button"
                  :disabled="creating || inviting"
                  @click="resetForm"
                >
                  {{ t('settings.delegations.form.reset') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </MemberAccessLayout>
</template>

<script setup lang="ts">
import { computed, ref, useFetch, watch, useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { useOrganizationMembers } from '~/composables/useOrganizationMembers'
import type { AdminDelegation, AdminDelegationsResponse, DelegationInvitation } from '~/types/admin'
import type { OrganizationMember } from '~/types/members'
import { manifests } from '~~/layers/plugin-manifests'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()
const currentOrgId = computed(() => auth.currentOrg.value?.id)

const errorMessage = ref('')
const pendingAction = ref('')
const expanded = ref<Set<string>>(new Set())
const showRevoked = ref(false)

const { data, pending, refresh, error } = await useFetch<AdminDelegationsResponse>(
  () => currentOrgId.value ? `/api/organizations/${currentOrgId.value}/delegations` : null,
  {
    watch: [currentOrgId, showRevoked],
    query: computed(() => ({ revoked: showRevoked.value ? 'true' : 'false' }))
  }
)

if (error.value) {
  errorMessage.value = error.value.message || 'Kunde inte hämta delegationer.'
}

const organization = computed(() => data.value?.organization ?? null)
const delegations = computed(() => data.value?.delegations ?? [])
const invitations = computed(() => data.value?.invitations ?? [])

const visibleDelegations = computed(() => {
  if (showRevoked.value) return delegations.value
  return delegations.value.filter((d) => !d.revokedAt)
})

// Group delegations by user
const groupedDelegations = computed(() => {
  const groups = new Map<string, typeof delegations.value>()
  for (const delegation of visibleDelegations.value) {
    const key = delegation.subjectId
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(delegation)
  }
  return Array.from(groups.entries()).map(([subjectId, delegs]) => ({
    subjectId,
    subjectName: delegs[0].subjectName,
    subjectEmail: delegs[0].subjectEmail,
    delegations: delegs,
    activeCount: delegs.filter((d) => !d.revokedAt && !isExpired(d)).length,
    revokedCount: delegs.filter((d) => d.revokedAt).length,
    expiredCount: delegs.filter((d) => !d.revokedAt && isExpired(d)).length
  }))
})

const moduleList = computed(() =>
  manifests.map((manifest) => ({
    key: manifest.module.key,
    name: manifest.module.name ?? manifest.module.key,
    icon: manifest.module.icon ?? null,
    permissions: Array.isArray(manifest.permissions) ? manifest.permissions : []
  }))
)

// Filter modules based on search query
const filteredModuleList = computed(() => {
  if (!moduleList.value || !Array.isArray(moduleList.value)) {
    return []
  }
  
  if (!moduleSearchQuery.value.trim()) {
    return moduleList.value
  }
  
  const query = moduleSearchQuery.value.trim().toLowerCase()
  
  return moduleList.value
    .map((module) => {
      if (!module || !module.name || !module.key) {
        return null
      }
      
      // Check if module name matches
      const nameMatches = module.name.toLowerCase().includes(query) || module.key.toLowerCase().includes(query)
      
      // Filter permissions that match
      const modulePermissions = Array.isArray(module.permissions) ? module.permissions : []
      const matchingPermissions = modulePermissions.filter((perm) => {
        if (!perm || !perm.key) return false
        const keyMatches = perm.key.toLowerCase().includes(query)
        const labelMatches = perm.label?.toLowerCase().includes(query) ?? false
        return keyMatches || labelMatches
      })
      
      // Include module if name matches OR if it has matching permissions
      if (nameMatches) {
        return { ...module, permissions: modulePermissions }
      } else if (matchingPermissions.length > 0) {
        return { ...module, permissions: matchingPermissions }
      }
      
      return null
    })
    .filter((module): module is NonNullable<typeof module> => module !== null)
})

// Computed: only selected modules with their permissions (for step 2)
const selectedModulesWithPermissions = computed(() => {
  if (!moduleList.value) return []
  
  let modules = moduleList.value.filter(m => selectedModules.value.has(m.key))
  
  // Apply search filter if there's a query
  if (moduleSearchQuery.value.trim()) {
    const query = moduleSearchQuery.value.trim().toLowerCase()
    modules = modules.filter(module => {
      const nameMatches = module.name.toLowerCase().includes(query) || module.key.toLowerCase().includes(query)
      const permMatches = (module.permissions || []).some(p => 
        p.key.toLowerCase().includes(query) || (p.label?.toLowerCase().includes(query) ?? false)
      )
      return nameMatches || permMatches
    })
  }
  
  return modules
})

// Recipient mode
const recipientMode = ref<'existing' | 'invite'>('invite')

// Organization members for search
const { fetchMembers } = useOrganizationMembers()
const organizationMembers = ref<OrganizationMember[]>([])
const loadingMembers = ref(false)

// Load organization members on mount
const loadOrganizationMembers = async () => {
  if (!currentOrgId.value) return
  loadingMembers.value = true
  try {
    const res = await fetchMembers()
    organizationMembers.value = res.members ?? []
  } catch (err) {
    console.error('Failed to load members:', err)
  } finally {
    loadingMembers.value = false
  }
}

// Load members only after delegations have loaded successfully (ensures auth is ready)
watch([currentOrgId, pending], ([orgId, isPending]) => {
  if (orgId && !isPending && !error.value) {
    loadOrganizationMembers()
  }
}, { immediate: true })

// Existing user search (filters organization members)
const userQuery = ref('')
const searchingUsers = ref(false)
const selectedUser = ref<OrganizationMember | null>(null)
const selectedUserId = computed(() => selectedUser.value?.userId ?? '')

// Filter members based on search query
const userResults = computed(() => {
  if (!userQuery.value.trim()) return []
  const query = userQuery.value.trim().toLowerCase()
  return organizationMembers.value.filter(member => {
    const nameMatch = member.fullName?.toLowerCase().includes(query) ?? false
    const emailMatch = member.email?.toLowerCase().includes(query) ?? false
    return nameMatch || emailMatch
  }).slice(0, 10) // Limit to 10 results
})

// Invite external user
const inviteEmail = ref('')
const inviting = ref(false)

// Module-first selection
const selectedModules = ref<Set<string>>(new Set())
const moduleSearchQuery = ref('')

const selectedPermissions = ref<Set<string>>(new Set())
const expiresAtInput = ref('')
const note = ref('')
const creating = ref(false)

// Computed: total selected permissions count
const totalSelectedPermissions = computed(() => selectedPermissions.value.size)

// Computed: check if user has customized permissions beyond module selection
const hasCustomPermissionSelection = computed(() => {
  // Get all permissions that would be selected by the selected modules
  const modulePermKeys = new Set<string>()
  for (const module of moduleList.value) {
    if (selectedModules.value.has(module.key)) {
      for (const perm of module.permissions || []) {
        modulePermKeys.add(perm.key)
      }
    }
  }
  // Check if selectedPermissions differs from modulePermKeys
  if (selectedPermissions.value.size !== modulePermKeys.size) return true
  for (const key of selectedPermissions.value) {
    if (!modulePermKeys.has(key)) return true
  }
  return false
})

const canCreate = computed(() => Boolean(selectedUserId.value) && selectedPermissions.value.size > 0)
const canInvite = computed(() => {
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.value.trim())
  return emailValid && selectedPermissions.value.size > 0
})

// Check if selected user already has an active delegation
const hasActiveDelegation = computed(() => {
  if (!selectedUserId.value) return false
  return visibleDelegations.value.some(
    (d) => d.subjectId === selectedUserId.value && !d.revokedAt && !isExpired(d)
  )
})

// Count active delegations for selected user
const activeDelegationCount = computed(() => {
  if (!selectedUserId.value) return 0
  return visibleDelegations.value.filter(
    (d) => d.subjectId === selectedUserId.value && !d.revokedAt && !isExpired(d)
  ).length
})

const selectUser = (member: OrganizationMember) => {
  selectedUser.value = member
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

// Module selection functions
const toggleModule = (moduleKey: string, checked: boolean) => {
  const nextModules = new Set(selectedModules.value)
  const nextPerms = new Set(selectedPermissions.value)
  
  const module = moduleList.value.find(m => m.key === moduleKey)
  if (!module) return
  
  if (checked) {
    nextModules.add(moduleKey)
    // Add all permissions from this module
    for (const perm of module.permissions || []) {
      nextPerms.add(perm.key)
    }
  } else {
    nextModules.delete(moduleKey)
    // Remove all permissions from this module
    for (const perm of module.permissions || []) {
      nextPerms.delete(perm.key)
    }
  }
  
  selectedModules.value = nextModules
  selectedPermissions.value = nextPerms
}

const selectAllModules = () => {
  const nextModules = new Set<string>()
  const nextPerms = new Set<string>()
  
  for (const module of moduleList.value) {
    nextModules.add(module.key)
    for (const perm of module.permissions || []) {
      nextPerms.add(perm.key)
    }
  }
  
  selectedModules.value = nextModules
  selectedPermissions.value = nextPerms
}

const deselectAllModules = () => {
  selectedModules.value = new Set()
  selectedPermissions.value = new Set()
}

const getModuleSelectedCount = (moduleKey: string): number => {
  const module = moduleList.value.find(m => m.key === moduleKey)
  if (!module) return 0
  return (module.permissions || []).filter(p => selectedPermissions.value.has(p.key)).length
}

const resetForm = () => {
  recipientMode.value = 'invite'
  userQuery.value = ''
  selectedUser.value = null
  inviteEmail.value = ''
  selectedModules.value = new Set()
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
  if (!currentOrgId.value || !canCreate.value) return
  creating.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/organizations/${currentOrgId.value}/delegations`, {
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

const inviteAndCreateDelegation = async () => {
  if (!currentOrgId.value || !canInvite.value) return
  inviting.value = true
  errorMessage.value = ''
  try {
    // Get module keys from selected modules
    const moduleKeys = Array.from(selectedModules.value)
    
    await $fetch(`/api/organizations/${currentOrgId.value}/delegations/invite`, {
      method: 'POST',
      body: {
        email: inviteEmail.value.trim(),
        moduleKeys,
        permissionKeys: Array.from(selectedPermissions.value),
        expiresAt: toTimestamp(expiresAtInput.value),
        note: note.value.trim() || null
      }
    })
    await refresh()
    resetForm()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Kunde inte bjuda in användare.'
  } finally {
    inviting.value = false
  }
}

const revokeDelegation = async (delegation: AdminDelegation) => {
  if (!currentOrgId.value || delegation.revokedAt) return
  if (!confirm(t('settings.delegations.revokeConfirm'))) return
  pendingAction.value = delegation.id
  errorMessage.value = ''
  try {
    await $fetch(
      `/api/organizations/${currentOrgId.value}/delegations/${delegation.id}/revoke`,
      { method: 'POST' }
    )
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || 'Kunde inte återkalla delegation.'
  } finally {
    pendingAction.value = ''
  }
}

const cancelInvitation = async (invite: DelegationInvitation) => {
  if (!currentOrgId.value) return
  if (!confirm(t('settings.delegations.invitations.cancelConfirm'))) return
  pendingAction.value = invite.id
  errorMessage.value = ''
  try {
    await $fetch(
      `/api/organizations/${currentOrgId.value}/delegations/invitations/${invite.id}`,
      { method: 'DELETE' }
    )
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('settings.delegations.invitations.cancelError')
  } finally {
    pendingAction.value = ''
  }
}

const resendInvitation = async (invite: DelegationInvitation) => {
  if (!currentOrgId.value) return
  pendingAction.value = `resend-${invite.id}`
  errorMessage.value = ''
  try {
    await $fetch(
      `/api/organizations/${currentOrgId.value}/delegations/invitations/${invite.id}/resend`,
      { method: 'POST' }
    )
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('settings.delegations.invitations.resendError')
  } finally {
    pendingAction.value = ''
  }
}

const formatExpires = (value: number | null | undefined) => {
  if (!value) return t('settings.delegations.list.noExpiry')
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

<style scoped>
/* Hide browser's default summary marker */
summary {
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}

/* Rotate chevron when details is open */
details[open] summary .chevron-icon {
  transform: rotate(180deg);
}
</style>

