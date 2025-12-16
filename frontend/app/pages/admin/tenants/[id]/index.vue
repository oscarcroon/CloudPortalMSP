<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/admin/tenants"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        {{ t('adminTenants.detail.backToList') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ t('adminTenants.detail.category') }}</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ tenant?.name ?? t('adminTenants.detail.loading') }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          <span v-if="tenant?.type === 'distributor'">{{ t('adminTenants.detail.types.distributor') }}</span>
          <span v-else-if="tenant?.type === 'provider'">{{ t('adminTenants.detail.types.provider') }}</span>
          <span v-else-if="tenant?.type === 'organization'">{{ t('adminTenants.detail.types.organization') }}</span>
        </p>
      </div>
    </header>

    <div v-if="error" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ error }}
    </div>

    <div v-if="pending" class="text-sm text-slate-600 dark:text-slate-400">{{ t('adminTenants.detail.loadingDetails') }}</div>

    <div v-else-if="tenant" class="space-y-6">
      <!-- Tenant Information -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('adminTenants.detail.sections.information') }}</h2>
          <button
            v-if="canEdit && (tenant.type === 'provider' || tenant.type === 'distributor')"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            @click="isEditing = !isEditing"
          >
            <Icon :icon="isEditing ? 'mdi:close' : 'mdi:pencil-outline'" class="h-3 w-3" />
            {{ isEditing ? t('adminTenants.detail.actions.cancel') : t('adminTenants.detail.actions.edit') }}
          </button>
        </div>
        
        <div v-if="updateError" class="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {{ updateError }}
        </div>

        <div v-if="!isEditing" class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.name') }}</p>
            <p class="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{{ tenant.name }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.slug') }}</p>
            <p class="mt-1 font-mono text-sm text-slate-700 dark:text-slate-300">{{ tenant.slug }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.type') }}</p>
            <span
              class="mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
              :class="getTypeClass(tenant.type)"
            >
              {{ t(`adminTenants.badges.${tenant.type}`) }}
            </span>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.status') }}</p>
            <StatusPill :variant="tenant.status === 'active' ? 'success' : 'warning'" class="mt-1">
              {{ t(`adminTenants.statuses.${tenant.status}`) }}
            </StatusPill>
          </div>
        </div>

        <form v-else @submit.prevent="handleSave" class="mt-4 space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label for="name" class="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.detail.fields.name') }}
              </label>
              <input
                id="name"
                v-model="editForm.name"
                type="text"
                required
                minlength="2"
                maxlength="120"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
            </div>
            <div>
              <label for="slug" class="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.detail.fields.slug') }}
              </label>
              <input
                id="slug"
                v-model="editForm.slug"
                type="text"
                required
                minlength="2"
                maxlength="120"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.detail.form.slugHint') }}
              </p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="saving"
              class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Icon v-if="saving" icon="mdi:loading" class="h-4 w-4 animate-spin" />
              <span v-else>{{ t('adminTenants.detail.actions.save') }}</span>
            </button>
            <button
              type="button"
              @click="cancelEdit"
              class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {{ t('adminTenants.detail.actions.cancel') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="tenant.type === 'distributor' && canCreateProvider"
          :to="`/admin/tenants/${tenant.id}/providers/new`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Icon icon="mdi:store" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.createProvider') }}
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' && canCreateOrganization"
          :to="`/admin/organizations/new?tenantId=${tenant.id}`"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80"
        >
          <Icon icon="mdi:home" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.createOrganization') }}
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/members`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:account-group" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.members') }}
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/email`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:email-outline" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.emailSettings') }}
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/modules`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:puzzle-outline" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.modulePermissions') }}
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/msp-roles`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:shield-account" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.mspRoles') }}
        </NuxtLink>
        <NuxtLink
          v-if="tenant.type === 'provider' || tenant.type === 'distributor'"
          :to="`/admin/tenants/${tenant.id}/branding`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:palette-outline" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.branding') }}
        </NuxtLink>
        <NuxtLink
          v-if="(tenant.type === 'provider' || tenant.type === 'distributor') && canReadAuditLogs"
          :to="`/admin/tenants/${tenant.id}/audit-logs`"
          class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
        >
          <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
          {{ t('adminTenants.detail.actions.auditLogs') }}
        </NuxtLink>
      </div>

      <!-- Linked Tenants (Providers for Distributors, Distributors for Providers) -->
      <div v-if="tenant.type === 'distributor' || tenant.type === 'provider'" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              v-if="tenant.type === 'provider'"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            >
              <Icon icon="mdi:city" class="h-5 w-5" />
            </div>
            <div
              v-else-if="tenant.type === 'distributor'"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <Icon icon="mdi:store" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                <span v-if="tenant.type === 'distributor'">{{ t('adminTenants.detail.sections.linkedTenants.providers') }}</span>
                <span v-else-if="tenant.type === 'provider'">{{ t('adminTenants.detail.sections.linkedTenants.distributors') }}</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                <span v-if="tenant.type === 'distributor'">{{ t('adminTenants.detail.sections.linkedTenants.countProviders', { count: linkedTenants.length }) }}</span>
                <span v-else-if="tenant.type === 'provider'">{{ t('adminTenants.detail.sections.linkedTenants.countDistributors', { count: linkedTenants.length }) }}</span>
              </p>
            </div>
          </div>
          <button
            v-if="tenant.type === 'provider' && canEditTenant"
            class="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            @click="openEditDistributorsModal"
          >
            <Icon icon="mdi:pencil-outline" class="h-3 w-3" />
            {{ t('adminTenants.detail.actions.edit') }}
          </button>
        </div>
        <div v-if="linkedTenants.length === 0" class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
          <span v-if="tenant.type === 'provider'">{{ t('adminTenants.detail.sections.linkedTenants.noneDistributors') }}</span>
          <span v-else>{{ t('adminTenants.detail.sections.linkedTenants.noneProviders') }}</span>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Namn</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Slug</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">E-post</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr
                v-for="linked in linkedTenants"
                :key="linked.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToTenant(linked.id)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ linked.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ linked.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="linked.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    :title="t('adminTenants.emailOverride.active')"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    {{ t('adminTenants.detail.email.override') }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">{{ t('adminTenants.detail.email.inherited') }}</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="linked.status === 'active' ? 'success' : 'warning'">
                    {{ t(`adminTenants.statuses.${linked.status}`) }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Organizations (for Providers) -->
      <div v-if="tenant.type === 'provider' && organizations.length > 0" class="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0c1524]">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <Icon icon="mdi:home" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ t('adminTenants.detail.sections.organizations.title') }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.sections.organizations.count', { count: organizations.length }) }}</p>
            </div>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.name') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.slug') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.email') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.status') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr
                v-for="org in organizations"
                :key="org.id"
                class="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-white/5"
                @click="navigateToOrg(org.slug)"
              >
                <td class="px-6 py-3 font-semibold text-slate-900 dark:text-white">{{ org.name }}</td>
                <td class="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{{ org.slug }}</td>
                <td class="px-6 py-3">
                  <span
                    v-if="org.hasEmailOverride"
                    class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    :title="t('adminTenants.emailOverride.active')"
                  >
                    <Icon icon="mdi:email-check" class="h-3 w-3" />
                    {{ t('adminTenants.detail.email.override') }}
                  </span>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">{{ t('adminTenants.detail.email.inherited') }}</span>
                </td>
                <td class="px-6 py-3">
                  <StatusPill :variant="org.status === 'active' ? 'success' : 'warning'">
                    {{ t(`adminTenants.statuses.${org.status}`) }}
                  </StatusPill>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pending Invitations -->
      <div v-if="tenant.type === 'provider' || tenant.type === 'distributor'" class="rounded-xl border border-dashed border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
          <div class="flex items-center justify-between">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ t('adminTenants.detail.sections.pendingInvitations.title') }}</p>
            <NuxtLink
              :to="`/admin/tenants/${tenant.id}/members`"
              class="text-xs text-slate-500 transition hover:text-brand dark:text-slate-400"
            >
              {{ t('adminTenants.detail.sections.pendingInvitations.viewAllMembers') }}
            </NuxtLink>
          </div>
        </div>
        <div v-if="inviteActionMessage" class="mx-6 mt-4 rounded-lg bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-200">
          {{ inviteActionMessage }}
        </div>
        <div v-else-if="inviteActionError" class="mx-6 mt-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">
          {{ inviteActionError }}
        </div>
        <div v-if="!invites.length" class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.detail.sections.pendingInvitations.none') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-white/5">
            <thead class="bg-slate-50 dark:bg-white/5">
              <tr>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.email') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('settings.members.table.role') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.status') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.invitations.invitedBy') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.invitations.expiresAt') }}</th>
                <th class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.fields.organization') }}</th>
                <th v-if="canInviteMember" class="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 text-right">{{ t('settings.members.table.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-white/5">
              <tr v-for="invite in invites" :key="invite.id">
                <td class="px-6 py-3 text-slate-700 dark:text-slate-200">{{ invite.email }}</td>
                <td class="px-6 py-3">{{ t(`rbac.roles.${invite.role}`) }}</td>
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
                    {{ t('adminTenants.detail.invitations.willCreate', { name: invite.organizationName }) }}
                  </span>
                  <span v-else class="text-slate-400 dark:text-slate-500">—</span>
                </td>
                <td v-if="canInviteMember" class="px-6 py-3 text-right">
                  <div v-if="invite.status === 'pending'" class="flex justify-end gap-2">
                  <button
                      type="button"
                      class="rounded border border-brand/40 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-40 dark:border-brand/60 dark:text-brand"
                      :disabled="inviteResendLoadingId === invite.id || inviteCancelLoadingId === invite.id"
                      @click="resendInvite(invite.id)"
                    >
                      {{ inviteResendLoadingId === invite.id ? t('adminTenants.detail.invitations.resending') : t('adminTenants.detail.invitations.resend') }}
                    </button>
                    <button
                      type="button"
                    class="rounded border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-500 disabled:opacity-40 dark:border-red-500/30 dark:text-red-200"
                      :disabled="inviteCancelLoadingId === invite.id || inviteResendLoadingId === invite.id"
                    @click="cancelInvite(invite.id)"
                  >
                    {{ inviteCancelLoadingId === invite.id ? t('adminTenants.detail.invitations.cancelling') : t('adminTenants.detail.invitations.cancel') }}
                  </button>
                  </div>
                  <span v-else class="text-xs text-slate-400 dark:text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Danger Zone (providers & distributors) -->
      <section
        v-if="showTenantDangerZone"
        class="rounded-xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-500/40 dark:bg-[#1a0f14]"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-lg font-semibold text-red-700 dark:text-red-200">{{ t('adminTenants.detail.sections.dangerZone.title') }}</h2>
            <p class="text-sm text-red-600 dark:text-red-300">
              {{ deleteCopy.dangerDescription }}
            </p>
          </div>
          <button
            class="rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500 dark:text-red-200 dark:hover:bg-red-500/10"
            :disabled="!tenant"
            @click="openDeleteModal"
          >
            {{ deleteCopy.buttonLabel }}
          </button>
        </div>
      </section>
    </div>

    <!-- Edit Distributors Modal -->
    <Modal :show="showEditDistributorsModal" @close="closeEditDistributorsModal">
      <template #title>{{ t('adminTenants.detail.editDistributors.title') }}</template>
      <template #content>
        <form @submit.prevent="handleSaveDistributors" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">{{ t('adminTenants.detail.editDistributors.label') }}</label>
            <div class="mt-2 space-y-2 max-h-60 overflow-y-auto">
              <label
                v-for="distributor in allDistributors"
                :key="distributor.id"
                class="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="distributor.id"
                  v-model="editDistributorsForm.distributorIds"
                  class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/10 dark:bg-black/20"
                />
                <span class="text-sm text-slate-900 dark:text-white">
                  {{ distributor.name }} ({{ distributor.slug }})
                </span>
              </label>
              <p v-if="allDistributors.length === 0" class="text-sm text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.detail.editDistributors.none') }}
              </p>
            </div>
            <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.detail.editDistributors.hint') }}
            </p>
          </div>
          <div v-if="editDistributorsError" class="text-sm text-red-500">{{ editDistributorsError }}</div>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              @click="closeEditDistributorsModal"
            >
              {{ t('adminTenants.detail.actions.cancel') }}
            </button>
            <button
              type="submit"
              class="inline-flex justify-center rounded-md border border-transparent bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand/80 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
              :disabled="savingDistributors"
            >
              <Icon v-if="savingDistributors" icon="mdi:loading" class="h-5 w-5 animate-spin" />
              <span v-else>{{ t('adminTenants.detail.actions.save') }}</span>
            </button>
          </div>
        </form>
      </template>
    </Modal>

    <!-- Delete Distributor Modal -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
      @click.self="closeDeleteModal"
    >
      <form
        class="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]"
        @submit.prevent="submitDelete"
      >
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ deleteCopy.modalTitle }}</h3>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.detail.delete.confirmText', { possessive: deleteCopy.subjectPossessive, slug: tenant?.slug ?? '', extra: deleteCopy.modalExtra }) }}
        </p>
        <div>
          <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ t('adminTenants.detail.delete.confirmSlug') }}</label>
          <input
            v-model="deleteForm.confirmSlug"
            type="text"
            required
            class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-white/10 dark:bg-black/20 dark:text-white"
            :placeholder="tenant?.slug ?? ''"
          />
        </div>
        <label class="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200">
          <input v-model="deleteForm.acknowledgeImpact" type="checkbox" class="mt-1 rounded border-slate-300 dark:border-white/20" />
          <span>{{ deleteCopy.acknowledgementText }}</span>
        </label>
        <div v-if="deleteError" class="rounded bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300 whitespace-pre-line">
          {{ deleteError }}
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200"
            @click="closeDeleteModal"
          >
            {{ t('adminTenants.detail.actions.cancel') }}
          </button>
          <button
            type="submit"
            class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
            :disabled="deleteDisabled || deleteLoading"
          >
            {{ deleteLoading ? t('adminTenants.detail.actions.deleting') : t('adminTenants.detail.actions.delete') }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, useFetch, useRoute, useRouter, watch } from '#imports'
import { Icon } from '@iconify/vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import Modal from '~/components/shared/Modal.vue'
import type { AdminTenantDetail, AdminTenantSummary } from '~/types/admin'
import { useAuth } from '~/composables/useAuth'
import { tenantRolePermissionMap } from '~/constants/rbac'
import { useI18n } from '#imports'

const { t } = useI18n()

definePageMeta({
  layout: 'default'
})

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const tenantId = route.params.id as string
type TenantRoleKey = keyof typeof tenantRolePermissionMap

const { data, pending, error, refresh } = await useFetch<AdminTenantDetail>(`/api/admin/tenants/${tenantId}`)

const tenant = computed(() => data.value?.tenant)
const childTenants = computed(() => data.value?.childTenants ?? [])
const linkedTenants = computed<AdminTenantSummary[]>(() => data.value?.linkedTenants ?? [])
const organizations = computed(() => data.value?.organizations ?? [])
const invites = computed(() => data.value?.invites ?? [])

const isEditing = ref(false)
const saving = ref(false)
const updateError = ref('')
const editForm = ref({
  name: '',
  slug: ''
})

// Delete tenant state
const showDeleteModal = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')
const deleteForm = reactive({
  confirmSlug: '',
  acknowledgeImpact: false
})

const deletableTenantTypes = ['distributor', 'provider'] as const
type DeletableTenantType = (typeof deletableTenantTypes)[number]

const isTenantDeletable = computed(() => {
  if (!tenant.value) return false
  return deletableTenantTypes.includes(tenant.value.type as DeletableTenantType)
})

const showTenantDangerZone = computed(() => auth.isSuperAdmin.value && isTenantDeletable.value)

interface DeleteCopy {
  dangerDescription: string
  buttonLabel: string
  modalTitle: string
  subjectPossessive: string
  modalExtra: string
  acknowledgementText: string
  errorFallback: string
}

const distributorDeleteCopy = computed<DeleteCopy>(() => ({
  dangerDescription: t('adminTenants.detail.delete.distributor.description'),
  buttonLabel: t('adminTenants.detail.delete.distributor.button'),
  modalTitle: t('adminTenants.detail.delete.distributor.modalTitle'),
  subjectPossessive: t('adminTenants.detail.delete.distributor.possessive'),
  modalExtra: t('adminTenants.detail.delete.distributor.extra'),
  acknowledgementText: t('adminTenants.detail.delete.distributor.acknowledgement'),
  errorFallback: t('adminTenants.detail.delete.distributor.error')
}))

const providerDeleteCopy = computed<DeleteCopy>(() => ({
  dangerDescription: t('adminTenants.detail.delete.provider.description'),
  buttonLabel: t('adminTenants.detail.delete.provider.button'),
  modalTitle: t('adminTenants.detail.delete.provider.modalTitle'),
  subjectPossessive: t('adminTenants.detail.delete.provider.possessive'),
  modalExtra: t('adminTenants.detail.delete.provider.extra'),
  acknowledgementText: t('adminTenants.detail.delete.provider.acknowledgement'),
  errorFallback: t('adminTenants.detail.delete.provider.error')
}))

const deleteCopy = computed<DeleteCopy>(() =>
  tenant.value?.type === 'provider' ? providerDeleteCopy.value : distributorDeleteCopy.value
)


// Invite management state
const inviteCancelLoadingId = ref<string>('')
const inviteResendLoadingId = ref<string>('')
const inviteActionMessage = ref('')
const inviteActionError = ref('')

watch(
  () => tenant.value,
  (t) => {
  if (t) {
    editForm.value.name = t.name
    editForm.value.slug = t.slug
  }
  },
  { immediate: true }
)


const canEdit = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  return role === 'admin'
})


const canReadAuditLogs = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  
  const tenantRolesRecord = (auth.state.value.data?.tenantRoles ?? {}) as Record<string, TenantRoleKey>
  const includeChildrenRecord = (auth.state.value.data?.tenantIncludeChildren ?? {}) as Record<string, boolean>

  const directRole = tenantRolesRecord[tenant.value.id]
  if (directRole && tenantRolePermissionMap[directRole]?.includes('audit:read')) {
    return true
  }

  for (const childTenantId of Object.keys(tenantRolesRecord)) {
    const childRole = tenantRolesRecord[childTenantId]
    if (!childRole) continue
    if (tenantRolePermissionMap[childRole]?.includes('audit:read')) {
      const includeChildren = includeChildrenRecord[childTenantId] ?? false
      if (includeChildren || childTenantId === tenant.value.id) {
        return true
      }
    }
  }
  
  return false
})

const cancelEdit = () => {
  if (tenant.value) {
    editForm.value.name = tenant.value.name
    editForm.value.slug = tenant.value.slug
  }
  isEditing.value = false
  updateError.value = ''
}

const handleSave = async () => {
  if (!tenant.value) return
  saving.value = true
  updateError.value = ''
  
  try {
    await $fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PUT',
      body: {
        name: editForm.value.name.trim(),
        slug: editForm.value.slug.trim()
      }
    })
    await refresh()
    isEditing.value = false
  } catch (err) {
    updateError.value = err instanceof Error ? err.message : t('adminTenants.detail.form.saveError')
  } finally {
    saving.value = false
  }
}

const canCreateProvider = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'distributor') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false
  return role === 'admin' && includeChildren
})

const canCreateOrganization = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  if (tenant.value.type !== 'provider') return false
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  // For creating organizations directly under a provider, admin role is sufficient
  // includeChildren is only needed for accessing child tenants, not for creating orgs under your own tenant
  return role === 'admin'
})

const canInviteMember = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles?.[tenant.value.id]
  const includeChildren = auth.state.value.data?.tenantIncludeChildren?.[tenant.value.id] ?? false

  if (tenant.value.type === 'distributor') {
    return role === 'admin' && includeChildren
  }

  if (tenant.value.type === 'provider') {
    return role === 'admin'
  }

  return false
})

const canEditTenant = computed(() => {
  if (!tenant.value) return false
  if (auth.isSuperAdmin.value) return true
  const role = auth.state.value.data?.tenantRoles[tenant.value.id]
  return role === 'admin'
})

// Fetch all distributors for editing provider links
interface TenantsResponse {
  tenants: AdminTenantSummary[]
  organizations?: any[]
  distributorProviderLinks?: any[]
}

const { data: distributorsData } = await useFetch<TenantsResponse>('/api/admin/tenants', {
  query: { type: 'distributor' }
})

const allDistributors = computed(() => distributorsData.value?.tenants ?? [])

// Edit distributors modal state
const showEditDistributorsModal = ref(false)
const savingDistributors = ref(false)
const editDistributorsError = ref('')
const editDistributorsForm = ref({
  distributorIds: [] as string[]
})

const openEditDistributorsModal = () => {
  if (tenant.value?.type === 'provider') {
    // Initialize form with currently linked distributors
    editDistributorsForm.value.distributorIds = linkedTenants.value.map(t => t.id)
    editDistributorsError.value = ''
    showEditDistributorsModal.value = true
  }
}

const closeEditDistributorsModal = () => {
  showEditDistributorsModal.value = false
  editDistributorsError.value = ''
}

const handleSaveDistributors = async () => {
  if (!tenant.value || tenant.value.type !== 'provider') return

  savingDistributors.value = true
  editDistributorsError.value = ''

  try {
    await $fetch(`/api/admin/tenants/${tenantId}/providers`, {
      method: 'PUT',
      body: {
        distributorIds: editDistributorsForm.value.distributorIds
      }
    })
    await refresh()
    closeEditDistributorsModal()
  } catch (err: any) {
    editDistributorsError.value = err.data?.message || err.message || t('adminTenants.detail.editDistributors.saveError')
  } finally {
    savingDistributors.value = false
  }
}

const navigateToTenant = (id: string) => {
  router.push(`/admin/tenants/${id}`)
}

const navigateToOrg = (slug: string) => {
  router.push(`/admin/organizations/${slug}/overview`)
}

const openDeleteModal = () => {
  if (isTenantDeletable.value && auth.isSuperAdmin.value) {
    deleteForm.confirmSlug = ''
    deleteForm.acknowledgeImpact = false
    deleteError.value = ''
    showDeleteModal.value = true
  }
}

const closeDeleteModal = () => {
  showDeleteModal.value = false
  deleteError.value = ''
  deleteForm.confirmSlug = ''
  deleteForm.acknowledgeImpact = false
}

const deleteDisabled = computed(() => {
  return !deleteForm.confirmSlug || !deleteForm.acknowledgeImpact || deleteForm.confirmSlug !== tenant.value?.slug
})

const submitDelete = async () => {
  if (!tenant.value || !isTenantDeletable.value) return
  deleteError.value = ''
  deleteLoading.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/delete`, {
      method: 'POST',
      body: {
        confirmSlug: deleteForm.confirmSlug.trim(),
        acknowledgeImpact: deleteForm.acknowledgeImpact
      }
    })
    closeDeleteModal()
    router.replace({ path: '/admin/tenants', query: { deleted: tenant.value.slug } })
  } catch (err: any) {
    // Extract error message from API response
    const errorMessage = err?.data?.message || err?.message || deleteCopy.value.errorFallback
    deleteError.value = errorMessage
  } finally {
    deleteLoading.value = false
  }
}


const getTypeLabel = (type: string) => {
  return t(`adminTenants.badges.${type}`)
}

const getTypeClass = (type: string) => {
  switch (type) {
    case 'provider':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'distributor':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    case 'organization':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
  }
}


const formatDate = (value: string | null) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return value
  }
}

const invitationStatusLabel = (status: string) => {
  return t(`settings.members.invitationStatus.${status}`)
}

const cancelInvite = async (inviteId: string) => {
  if (!confirm(t('adminTenants.detail.invitations.cancelConfirm'))) {
    return
  }
  inviteCancelLoadingId.value = inviteId
  inviteActionMessage.value = ''
  inviteActionError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/invitations/${inviteId}/cancel`, {
      method: 'DELETE'
    })
    await refresh()
    inviteActionMessage.value = t('adminTenants.detail.invitations.cancelled')
    setTimeout(() => (inviteActionMessage.value = ''), 3000)
  } catch (err: any) {
    // Error handling for invite cancellation
    const message = err?.data?.message || err?.message || t('adminTenants.detail.invitations.cancelError')
    inviteActionError.value = message
    console.error('Failed to cancel invite:', err)
  } finally {
    inviteCancelLoadingId.value = ''
  }
}

const resendInvite = async (inviteId: string) => {
  inviteResendLoadingId.value = inviteId
  inviteActionMessage.value = ''
  inviteActionError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/invitations/${inviteId}/resend`, {
      method: 'POST'
    })
    await refresh()
    inviteActionMessage.value = t('adminTenants.detail.invitations.resent')
    setTimeout(() => (inviteActionMessage.value = ''), 3000)
  } catch (err: any) {
    const message = err?.data?.message || err?.message || t('adminTenants.detail.invitations.resendError')
    inviteActionError.value = message
    console.error('Failed to resend invite:', err)
  } finally {
    inviteResendLoadingId.value = ''
  }
}
</script>

