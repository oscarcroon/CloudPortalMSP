<template>
  <section class="space-y-6">
    <header class="space-y-2">
      <NuxtLink
        :to="`/tenant-admin/tenants/${tenantId}`"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('adminTenants.mspRoles.back') }}
      </NuxtLink>
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          {{ t('adminTenants.mspRoles.title', { name: tenantName }) }}
        </h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('adminTenants.mspRoles.description') }}
        </p>
      </div>
    </header>

    <div v-if="errorMessage" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {{ errorMessage }}
    </div>

    <div v-if="successMessage" class="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
      {{ successMessage }}
    </div>

    <div class="flex items-center justify-between">
      <div class="text-xs text-slate-500 dark:text-slate-300">
        {{ t('adminTenants.mspRoles.results', { count: roles.length }) }}
      </div>
      <div class="flex gap-2">
        <button
          v-if="isProvider"
          class="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10"
          @click="openFromTemplateModal"
        >
          <Icon icon="mdi:content-copy" class="h-4 w-4" />
          {{ t('adminTenants.mspRoles.createFromTemplate') }}
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          @click="openCreateModal"
        >
          <Icon icon="mdi:plus" class="h-4 w-4" />
          {{ t('adminTenants.mspRoles.create') }}
        </button>
      </div>
    </div>

    <div v-if="pending" class="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
      {{ t('adminTenants.mspRoles.loading') }}
    </div>

    <div
      v-else-if="!roles.length"
      class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
    >
      {{ t('adminTenants.mspRoles.empty') }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="role in roles"
        :key="role.id"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow dark:border-white/10 dark:bg-white/5"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-lg font-semibold text-slate-900 dark:text-white">{{ role.name }}</p>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-600 dark:bg-white/10 dark:text-slate-400">
                {{ role.key }}
              </span>
              <span v-if="role.isSystem" class="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                System
              </span>
              <span v-if="role.removedCount > 0" class="rounded bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                {{ t('adminTenants.mspRoles.removedPermissions', { count: role.removedCount }) }}
              </span>
              <!-- Template badge -->
              <span
                v-if="role.sourceTemplateId"
                class="rounded px-2 py-0.5 text-xs font-semibold"
                :class="getTemplateBadgeClass(role)"
                :title="getTemplateBadgeTooltip(role)"
              >
                {{ t('adminTenants.mspRoles.fromTemplate') }}: {{ role.sourceTemplateName || 'Mall' }} v{{ role.sourceTemplateVersion }}
              </span>
            </div>
            <div v-if="role.usageCount > 0" class="text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.usedBy', { count: role.usageCount }) }}
            </div>
            <p v-if="role.description" class="text-sm text-slate-600 dark:text-slate-400">
              {{ role.description }}
            </p>
            <div v-if="role.permissions.length" class="mt-3 space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.mspRoles.permissions') }}
              </p>
              <div class="space-y-1">
                <div
                  v-for="(perms, moduleKey) in groupedPermissions(role.permissions)"
                  :key="moduleKey"
                  class="rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5"
                >
                  <p class="font-semibold text-slate-700 dark:text-slate-200">{{ moduleKey }}</p>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span
                      v-for="perm in perms"
                      :key="perm"
                      class="rounded bg-white px-2 py-0.5 text-slate-600 dark:bg-black/20 dark:text-slate-300"
                    >
                      {{ perm }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.noPermissions') }}
            </div>
          </div>
          <div class="ml-4 flex gap-2">
            <button
              v-if="role.sourceTemplateId && hasUpdateAvailable(role)"
              class="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
              @click="openSyncModal(role)"
            >
              {{ t('adminTenants.mspRoles.upgrade') }}
            </button>
            <button
              v-if="isProvider && linkedDistributors.length > 0"
              class="rounded-lg border border-purple-300 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-50 dark:border-purple-500/50 dark:text-purple-400 dark:hover:bg-purple-500/10"
              @click="openPromoteModal(role)"
            >
              {{ t('adminTenants.mspRoles.promoteToTemplate') }}
            </button>
            <button
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
              @click="openEditModal(role)"
            >
              {{ t('adminTenants.mspRoles.edit') }}
            </button>
            <button
              class="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
              @click="deleteRole(role)"
            >
              {{ t('adminTenants.mspRoles.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    >
      <div class="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ editingRole ? t('adminTenants.mspRoles.editTitle') : t('adminTenants.mspRoles.createTitle') }}
          </h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="closeModal"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Role Name -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.name') }}
            </label>
            <input
              v-model="form.name"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminTenants.mspRoles.form.namePlaceholder')"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.description') }}
            </label>
            <textarea
              v-model="form.description"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminTenants.mspRoles.form.descriptionPlaceholder')"
            />
          </div>

          <!-- Permissions Selection -->
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.permissions') }}
            </label>
            <p class="mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.form.permissionsHint') }}
            </p>

            <div v-if="availablePermissionsLoading" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.loadingPermissions') }}
            </div>

            <div v-else-if="availablePermissions.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.noAvailablePermissions') }}
            </div>

            <div v-else>
              <div class="mb-2">
                <input
                  v-model="moduleSearchQuery"
                  type="text"
                  class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                  :placeholder="t('adminTenants.mspRoles.form.searchPlaceholder', { default: 'Sök moduler eller rättigheter...' })"
                />
              </div>
              <div class="mt-2 space-y-3 max-h-96 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-white/10 dark:bg-white/5">
                <div v-if="filteredModuleList.length === 0" class="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  {{ t('adminTenants.mspRoles.form.noResults') }}
                </div>
                <details
                  v-for="module in filteredModuleList"
                  :key="module.moduleKey"
                  :open="moduleSearchQuery.trim() !== ''"
                  class="group rounded-lg bg-white p-3 dark:bg-black/20"
                >
                  <summary class="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5 rounded px-2 py-1 -mx-2 -my-1 transition-colors">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <Icon icon="mdi:chevron-down" class="chevron-icon h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0" />
                      <span class="truncate">{{ module.moduleName }}</span>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span class="text-xs text-slate-500 whitespace-nowrap">{{ module.permissions.length }} st</span>
                      <button
                        type="button"
                        class="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        @click.stop="toggleModule(module.moduleKey)"
                      >
                        {{ isModuleFullySelected(module) ? t('adminTenants.mspRoles.deselectAll') : t('adminTenants.mspRoles.selectAll') }}
                      </button>
                    </div>
                  </summary>
                  <div class="mt-3 space-y-2">
                    <label
                      v-for="perm in module.permissions"
                      :key="perm.key"
                      class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        :checked="isPermissionSelected(module.moduleKey, perm.key)"
                        class="mt-1 rounded border-slate-300 text-brand focus:ring-brand dark:border-white/20"
                        @change="togglePermission(module.moduleKey, perm.key, $event)"
                      />
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <p class="font-semibold">{{ perm.key }}</p>
                          <span
                            v-if="!perm.isActive || perm.status === 'removed'"
                            class="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                          >
                            {{ t('adminTenants.mspRoles.removed') }}
                          </span>
                          <span
                            v-else-if="perm.status === 'deprecated'"
                            class="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                          >
                            {{ t('adminTenants.mspRoles.deprecated') }}
                          </span>
                        </div>
                        <p v-if="perm.description" class="text-xs text-slate-500 dark:text-slate-400">
                          {{ perm.description }}
                        </p>
                      </div>
                    </label>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="saving"
            @click="closeModal"
          >
            {{ t('adminTenants.mspRoles.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="saving || !form.name"
            @click="saveRole"
          >
            {{ saving ? t('adminTenants.mspRoles.saving') : t('adminTenants.mspRoles.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create from Template Modal -->
    <div
      v-if="showFromTemplateModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    >
      <div class="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('adminTenants.mspRoles.fromTemplateTitle') }}
          </h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="closeFromTemplateModal"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <div v-if="templatesLoading" class="py-8 text-center text-sm text-slate-500">
          {{ t('adminTenants.mspRoles.loadingTemplates') }}
        </div>

        <div v-else-if="availableTemplates.length === 0" class="py-8 text-center text-sm text-slate-500">
          {{ t('adminTenants.mspRoles.noTemplates') }}
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ t('adminTenants.mspRoles.selectTemplate') }}
          </p>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            <div
              v-for="template in availableTemplates"
              :key="template.id"
              class="rounded-lg border p-4 cursor-pointer transition"
              :class="selectedTemplateId === template.id 
                ? 'border-brand bg-brand/5 dark:bg-brand/10' 
                : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20'"
              @click="selectedTemplateId = template.id"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-slate-900 dark:text-white">{{ template.name }}</p>
                    <span class="text-xs text-slate-500">v{{ template.templateVersion }}</span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {{ t('adminTenants.mspRoles.fromDistributor') }}: {{ template.distributorName }}
                  </p>
                  <p v-if="template.description" class="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    {{ template.description }}
                  </p>
                  <div class="mt-2 flex items-center gap-4 text-xs">
                    <span class="text-emerald-600 dark:text-emerald-400">
                      {{ template.permissions.available }} {{ t('adminTenants.mspRoles.permissionsAvailable') }}
                    </span>
                    <span v-if="template.permissions.unavailable > 0" class="text-amber-600 dark:text-amber-400">
                      {{ template.permissions.unavailable }} {{ t('adminTenants.mspRoles.permissionsUnavailable') }}
                    </span>
                  </div>
                </div>
                <div class="ml-4">
                  <input
                    type="radio"
                    :checked="selectedTemplateId === template.id"
                    class="h-4 w-4 text-brand focus:ring-brand"
                    @click.stop="selectedTemplateId = template.id"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-if="selectedTemplateId" class="border-t border-slate-200 dark:border-white/10 pt-4 space-y-4">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.mspRoles.form.name') }} ({{ t('adminTenants.mspRoles.optional') }})
              </label>
              <input
                v-model="fromTemplateForm.name"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
                :placeholder="t('adminTenants.mspRoles.namePlaceholderFromTemplate')"
              />
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="creatingFromTemplate"
            @click="closeFromTemplateModal"
          >
            {{ t('adminTenants.mspRoles.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="creatingFromTemplate || !selectedTemplateId"
            @click="createFromTemplate"
          >
            {{ creatingFromTemplate ? t('adminTenants.mspRoles.creating') : t('adminTenants.mspRoles.createRole') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sync/Upgrade Modal -->
    <div
      v-if="showSyncModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    >
      <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('adminTenants.mspRoles.syncTitle') }}
          </h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="closeSyncModal"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <div v-if="syncLoading" class="py-8 text-center text-sm text-slate-500">
          {{ t('adminTenants.mspRoles.loadingSyncPreview') }}
        </div>

        <div v-else-if="syncPreview" class="space-y-4">
          <div class="rounded-lg bg-slate-50 p-4 dark:bg-white/5">
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ t('adminTenants.mspRoles.syncFrom') }}: {{ syncPreview.template.name }} v{{ syncPreview.template.templateVersion }}
            </p>
            <p class="text-xs text-slate-500 mt-1">
              {{ t('adminTenants.mspRoles.currentVersion') }}: v{{ syncPreview.role.currentVersion }}
            </p>
          </div>

          <div v-if="syncPreview.isModifiedLocally" class="rounded-lg bg-amber-50 border border-amber-200 p-4 dark:bg-amber-900/20 dark:border-amber-500/30">
            <p class="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {{ t('adminTenants.mspRoles.modifiedLocally') }}
            </p>
            <p class="text-xs text-amber-600 dark:text-amber-500 mt-1">
              {{ t('adminTenants.mspRoles.modifiedLocallyHint') }}
            </p>
            <label class="flex items-center gap-2 mt-3">
              <input
                v-model="syncForce"
                type="checkbox"
                class="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <span class="text-sm text-amber-700 dark:text-amber-400">
                {{ t('adminTenants.mspRoles.forceSync') }}
              </span>
            </label>
          </div>

          <div class="space-y-3">
            <div>
              <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('adminTenants.mspRoles.syncStrategy') }}
              </label>
              <div class="mt-2 flex gap-4">
                <label class="flex items-center gap-2">
                  <input
                    v-model="syncStrategy"
                    type="radio"
                    value="merge"
                    class="text-brand focus:ring-brand"
                  />
                  <span class="text-sm text-slate-700 dark:text-slate-200">
                    {{ t('adminTenants.mspRoles.strategyMerge') }}
                  </span>
                </label>
                <label class="flex items-center gap-2">
                  <input
                    v-model="syncStrategy"
                    type="radio"
                    value="replace"
                    class="text-brand focus:ring-brand"
                  />
                  <span class="text-sm text-slate-700 dark:text-slate-200">
                    {{ t('adminTenants.mspRoles.strategyReplace') }}
                  </span>
                </label>
              </div>
            </div>

            <div class="rounded-lg border border-slate-200 p-4 dark:border-white/10">
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                {{ t('adminTenants.mspRoles.syncPreview') }}
              </p>
              <div class="space-y-2 text-sm">
                <p v-if="syncPreview.diff.toAdd.length > 0" class="text-emerald-600 dark:text-emerald-400">
                  + {{ syncPreview.diff.toAdd.length }} {{ t('adminTenants.mspRoles.permissionsToAdd') }}
                </p>
                <p v-if="syncPreview.diff.toRemove.length > 0" class="text-red-600 dark:text-red-400">
                  - {{ syncPreview.diff.toRemove.length }} {{ t('adminTenants.mspRoles.permissionsToRemove') }}
                </p>
                <p class="text-slate-500">
                  = {{ syncPreview.diff.unchanged.length }} {{ t('adminTenants.mspRoles.permissionsUnchanged') }}
                </p>
                <p v-if="syncPreview.skippedPerms > 0" class="text-amber-600 dark:text-amber-400">
                  ⚠ {{ syncPreview.skippedPerms }} {{ t('adminTenants.mspRoles.permissionsSkipped') }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="syncing"
            @click="closeSyncModal"
          >
            {{ t('adminTenants.mspRoles.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/80 disabled:opacity-60"
            :disabled="syncing || (syncPreview?.isModifiedLocally && !syncForce)"
            @click="applySync"
          >
            {{ syncing ? t('adminTenants.mspRoles.syncing') : t('adminTenants.mspRoles.applySync') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Promote to Template Modal -->
    <div
      v-if="showPromoteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
    >
      <div class="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0f172a]">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('adminTenants.mspRoles.promoteToTemplateTitle') }}
          </h3>
          <button
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
            @click="closePromoteModal"
          >
            <Icon icon="mdi:close" class="h-5 w-5" />
          </button>
        </div>

        <p class="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {{ t('adminTenants.mspRoles.promoteToTemplateDescription') }}
        </p>

        <div v-if="promotingRole" class="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-white/5">
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {{ promotingRole.name }}
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {{ promotingRole.permissions.length }} behörigheter
          </p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.selectDistributor') }}
            </label>
            <select
              v-model="promoteForm.distributorId"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
            >
              <option value="">-- Välj distributör --</option>
              <option v-for="dist in linkedDistributors" :key="dist.id" :value="dist.id">
                {{ dist.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('adminTenants.mspRoles.templateName') }}
            </label>
            <input
              v-model="promoteForm.name"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white"
              :placeholder="t('adminTenants.mspRoles.templateNamePlaceholder')"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            :disabled="promoting"
            @click="closePromoteModal"
          >
            {{ t('adminTenants.mspRoles.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-60"
            :disabled="promoting || !promoteForm.distributorId"
            @click="promoteToTemplate"
          >
            {{ promoting ? t('adminTenants.mspRoles.promoting') : t('adminTenants.mspRoles.promoteButton') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, useFetch, useRoute, useRouter, useI18n, navigateTo } from '#imports'
import { Icon } from '@iconify/vue'

const { t } = useI18n()
const router = useRouter()

interface MspRole {
  id: string
  key: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: Array<{ moduleKey: string; permissionKey: string }>
  usageCount: number
  removedCount: number
  // Template-related fields
  sourceTemplateId?: string | null
  sourceTemplateName?: string | null
  sourceTemplateVersion?: number | null
  templateCurrentVersion?: number | null // Current version of the source template
  lastSyncedAt?: string | null
  createdAt: string | null
  updatedAt: string | null
}

interface AvailableTemplate {
  id: string
  key: string
  name: string
  description: string | null
  templateVersion: number
  distributorId: string
  distributorName: string
  permissions: {
    total: number
    available: number
    unavailable: number
  }
}

interface SyncPreview {
  mode: 'dry-run' | 'apply'
  strategy: 'merge' | 'replace'
  template: {
    id: string
    key: string
    name: string
    templateVersion: number
  }
  role: {
    id: string
    key: string
    name: string
    currentVersion: number | null
  }
  diff: {
    toAdd: Array<{ moduleKey: string; permissionKey: string }>
    toRemove: Array<{ moduleKey: string; permissionKey: string }>
    unchanged: Array<{ moduleKey: string; permissionKey: string }>
  }
  skippedPerms: number
  isModifiedLocally: boolean
}

interface AvailablePermission {
  moduleKey: string
  moduleName: string
  permissions: Array<{
    key: string
    description?: string | null
    isActive: boolean
    status: 'active' | 'deprecated' | 'removed'
  }>
}

const route = useRoute()
const tenantId = computed(() => route.params.id as string)

const { data, pending, refresh, error } = await (useFetch as any)(
  `/api/admin/tenants/${tenantId.value}/msp-roles`,
  {
    watch: [tenantId]
  }
)

const { data: availablePermissionsData, pending: availablePermissionsLoading } = await (useFetch as any)(
  `/api/admin/tenants/${tenantId.value}/msp-roles/available-permissions`,
  {
    watch: [tenantId]
  }
)

const roles = computed(() => data.value?.roles ?? [])
const availablePermissions = computed(() => availablePermissionsData.value?.permissions ?? [])
const tenantName = computed(() => route.query.name as string || 'Tenant')

// Filter modules based on search query
const filteredModuleList = computed(() => {
  if (!availablePermissions.value || !Array.isArray(availablePermissions.value)) {
    return []
  }
  
  if (!moduleSearchQuery.value.trim()) {
    return availablePermissions.value
  }
  
  const query = moduleSearchQuery.value.trim().toLowerCase()
  
  return availablePermissions.value
    .map((module) => {
      if (!module || !module.moduleName || !module.moduleKey) {
        return null
      }
      
      // Check if module name matches
      const nameMatches = module.moduleName.toLowerCase().includes(query) || module.moduleKey.toLowerCase().includes(query)
      
      // Filter permissions that match
      const modulePermissions = Array.isArray(module.permissions) ? module.permissions : []
      const matchingPermissions = modulePermissions.filter((perm: any) => {
        if (!perm || !perm.key) return false
        const keyMatches = perm.key.toLowerCase().includes(query)
        const labelMatches = perm.description?.toLowerCase().includes(query) ?? false
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

const errorMessage = ref('')
const successMessage = ref('')
const showModal = ref(false)
const editingRole = ref<MspRole | null>(null)
const saving = ref(false)

const form = reactive({
  name: '',
  description: '',
  permissions: [] as Array<{ moduleKey: string; permissionKey: string }>
})

const moduleSearchQuery = ref('')

const groupedPermissions = (permissions: Array<{ moduleKey: string; permissionKey: string }>) => {
  const grouped: Record<string, string[]> = {}
  for (const perm of permissions) {
    if (!grouped[perm.moduleKey]) {
      grouped[perm.moduleKey] = []
    }
    grouped[perm.moduleKey]!.push(perm.permissionKey)
  }
  return grouped
}

const isPermissionSelected = (moduleKey: string, permissionKey: string): boolean => {
  return form.permissions.some(
    (p) => p.moduleKey === moduleKey && p.permissionKey === permissionKey
  )
}

const togglePermission = (moduleKey: string, permissionKey: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    if (!isPermissionSelected(moduleKey, permissionKey)) {
      form.permissions.push({ moduleKey, permissionKey })
    }
  } else {
    form.permissions = form.permissions.filter(
      (p) => !(p.moduleKey === moduleKey && p.permissionKey === permissionKey)
    )
  }
}

const isModuleFullySelected = (module: AvailablePermission): boolean => {
  return module.permissions.every((perm) => isPermissionSelected(module.moduleKey, perm.key))
}

const toggleModule = (moduleKey: string) => {
  const module = availablePermissions.value.find((m: AvailablePermission) => m.moduleKey === moduleKey)
  if (!module) return

  const allSelected = isModuleFullySelected(module)
  
  if (allSelected) {
    // Deselect all
    form.permissions = form.permissions.filter((p) => p.moduleKey !== moduleKey)
  } else {
    // Select all
    for (const perm of module.permissions) {
      if (!isPermissionSelected(moduleKey, perm.key)) {
        form.permissions.push({ moduleKey, permissionKey: perm.key })
      }
    }
  }
}

const openCreateModal = () => {
  editingRole.value = null
  form.name = ''
  form.description = ''
  form.permissions = []
  moduleSearchQuery.value = ''
  showModal.value = true
}

const openEditModal = (role: MspRole) => {
  editingRole.value = role
  form.name = role.name
  form.description = role.description || ''
  form.permissions = [...role.permissions]
  moduleSearchQuery.value = ''
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  editingRole.value = null
  form.name = ''
  form.description = ''
  form.permissions = []
  moduleSearchQuery.value = ''
}

const saveRole = async () => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (editingRole.value) {
      // Update
      await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/msp-roles/${editingRole.value.id}`, {
        method: 'PUT',
        body: {
          name: form.name,
          description: form.description || null,
          permissions: form.permissions
        }
      })
      successMessage.value = t('adminTenants.mspRoles.messages.updated')
    } else {
      // Create - key will be auto-generated from name
      await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/msp-roles`, {
        method: 'POST',
        body: {
          name: form.name,
          description: form.description || null,
          permissions: form.permissions
        }
      })
      successMessage.value = t('adminTenants.mspRoles.messages.created')
    }
    
    await refresh()
    closeModal()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.error')
  } finally {
    saving.value = false
  }
}

const cloneRole = async (role: MspRole) => {
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/msp-roles/${role.id}/clone`, {
      method: 'POST'
    })
    successMessage.value = t('adminTenants.mspRoles.messages.cloned')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.cloneError')
  }
}

const deleteRole = async (role: MspRole) => {
  if (!confirm(t('adminTenants.mspRoles.deleteConfirm', { name: role.name }))) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/msp-roles/${role.id}`, {
      method: 'DELETE'
    })
    successMessage.value = t('adminTenants.mspRoles.messages.deleted')
    await refresh()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    // Extract error message from $fetch error (err.data?.message) or fallback
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.deleteError')
  }
}

// ===== Template functionality =====

// Check if tenant is a provider (for showing template features)
const { data: tenantData } = await (useFetch as any)(
  `/api/admin/tenants/${tenantId.value}`,
  { watch: [tenantId] }
)
const isProvider = computed(() => tenantData.value?.tenant?.type === 'provider')
const isDistributor = computed(() => tenantData.value?.tenant?.type === 'distributor')

// Redirect distributors to the templates page (distributors should not have MSP roles, only templates)
watch(isDistributor, (newValue) => {
  if (newValue) {
    navigateTo(`/admin/distributors/${tenantId.value}/msp-role-templates`)
  }
}, { immediate: true })

// Linked distributors (for promote to template feature)
interface LinkedDistributor {
  id: string
  name: string
}
const linkedDistributors = ref<LinkedDistributor[]>([])

// Fetch linked distributors when provider
const fetchLinkedDistributors = async () => {
  if (!isProvider.value) return
  try {
    const result = await ($fetch as any)(
      `/api/admin/tenants/${tenantId.value}/distributors`
    )
    linkedDistributors.value = result.distributors || []
  } catch (err) {
    // Silently fail - not critical
  }
}

// Watch for tenant type change and fetch distributors
watch(isProvider, (newValue) => {
  if (newValue) {
    fetchLinkedDistributors()
  }
}, { immediate: true })

// From Template Modal state
const showFromTemplateModal = ref(false)
const availableTemplates = ref<AvailableTemplate[]>([])
const templatesLoading = ref(false)
const selectedTemplateId = ref<string | null>(null)
const creatingFromTemplate = ref(false)
const fromTemplateForm = reactive({
  name: ''
})

// Sync Modal state
const showSyncModal = ref(false)
const syncingRole = ref<MspRole | null>(null)
const syncPreview = ref<SyncPreview | null>(null)
const syncLoading = ref(false)
const syncing = ref(false)
const syncStrategy = ref<'merge' | 'replace'>('merge')
const syncForce = ref(false)

// Promote to Template Modal state
const showPromoteModal = ref(false)
const promotingRole = ref<MspRole | null>(null)
const promoting = ref(false)
const promoteForm = reactive({
  distributorId: '',
  name: ''
})

// Template badge helpers
const getTemplateBadgeClass = (role: MspRole): string => {
  if (!role.sourceTemplateId) return ''
  
  const hasUpdate = hasUpdateAvailable(role)
  if (hasUpdate) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
}

const getTemplateBadgeTooltip = (role: MspRole): string => {
  if (!role.sourceTemplateId) return ''
  
  const hasUpdate = hasUpdateAvailable(role)
  if (hasUpdate) {
    return t('adminTenants.mspRoles.updateAvailable')
  }
  return t('adminTenants.mspRoles.upToDate')
}

const hasUpdateAvailable = (role: MspRole): boolean => {
  if (!role.sourceTemplateId) return false
  if (!role.sourceTemplateVersion || !role.templateCurrentVersion) return false
  return role.sourceTemplateVersion < role.templateCurrentVersion
}

// From Template Modal functions
const openFromTemplateModal = async () => {
  showFromTemplateModal.value = true
  selectedTemplateId.value = null
  fromTemplateForm.name = ''
  templatesLoading.value = true
  
  try {
    const result = await ($fetch as any)(
      `/api/admin/tenants/${tenantId.value}/msp-role-templates/available`
    )
    availableTemplates.value = result.templates
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.loadTemplatesError')
    showFromTemplateModal.value = false
  } finally {
    templatesLoading.value = false
  }
}

const closeFromTemplateModal = () => {
  showFromTemplateModal.value = false
  selectedTemplateId.value = null
  fromTemplateForm.name = ''
  availableTemplates.value = []
}

const createFromTemplate = async () => {
  if (!selectedTemplateId.value) return
  
  creatingFromTemplate.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    await ($fetch as any)(`/api/admin/tenants/${tenantId.value}/msp-roles/from-template`, {
      method: 'POST',
      body: {
        templateId: selectedTemplateId.value,
        name: fromTemplateForm.name || undefined
      }
    })
    
    successMessage.value = t('adminTenants.mspRoles.messages.createdFromTemplate')
    await refresh()
    closeFromTemplateModal()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.createFromTemplateError')
  } finally {
    creatingFromTemplate.value = false
  }
}

// Sync Modal functions
const openSyncModal = async (role: MspRole) => {
  syncingRole.value = role
  showSyncModal.value = true
  syncPreview.value = null
  syncStrategy.value = 'merge'
  syncForce.value = false
  syncLoading.value = true
  
  try {
    const result = await ($fetch as any)(
      `/api/admin/tenants/${tenantId.value}/msp-roles/${role.id}/sync-from-template`,
      {
        method: 'POST',
        body: {
          mode: 'dry-run',
          strategy: syncStrategy.value
        }
      }
    )
    syncPreview.value = result
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.syncPreviewError')
    showSyncModal.value = false
  } finally {
    syncLoading.value = false
  }
}

const closeSyncModal = () => {
  showSyncModal.value = false
  syncingRole.value = null
  syncPreview.value = null
  syncStrategy.value = 'merge'
  syncForce.value = false
}

const applySync = async () => {
  if (!syncingRole.value) return
  
  syncing.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    await ($fetch as any)(
      `/api/admin/tenants/${tenantId.value}/msp-roles/${syncingRole.value.id}/sync-from-template`,
      {
        method: 'POST',
        body: {
          mode: 'apply',
          strategy: syncStrategy.value,
          force: syncForce.value
        }
      }
    )
    
    successMessage.value = t('adminTenants.mspRoles.messages.synced')
    await refresh()
    closeSyncModal()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.syncError')
  } finally {
    syncing.value = false
  }
}

// Watch for strategy changes to update preview
watch(syncStrategy, async (newStrategy) => {
  if (!syncingRole.value || !showSyncModal.value) return
  
  syncLoading.value = true
  try {
    const result = await ($fetch as any)(
      `/api/admin/tenants/${tenantId.value}/msp-roles/${syncingRole.value.id}/sync-from-template`,
      {
        method: 'POST',
        body: {
          mode: 'dry-run',
          strategy: newStrategy
        }
      }
    )
    syncPreview.value = result
  } catch (err: any) {
    // Keep old preview on error
  } finally {
    syncLoading.value = false
  }
})

// Promote to Template Modal functions
const openPromoteModal = (role: MspRole) => {
  promotingRole.value = role
  promoteForm.distributorId = linkedDistributors.value.length === 1 ? linkedDistributors.value[0]!.id : ''
  promoteForm.name = ''
  showPromoteModal.value = true
}

const closePromoteModal = () => {
  showPromoteModal.value = false
  promotingRole.value = null
  promoteForm.distributorId = ''
  promoteForm.name = ''
}

const promoteToTemplate = async () => {
  if (!promotingRole.value || !promoteForm.distributorId) return
  
  promoting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    await ($fetch as any)(`/api/admin/distributors/${promoteForm.distributorId}/msp-role-templates/from-role`, {
      method: 'POST',
      body: {
        roleId: promotingRole.value.id,
        providerTenantId: tenantId.value,
        name: promoteForm.name || undefined
      }
    })
    
    successMessage.value = t('adminTenants.mspRoles.messages.promotedToTemplate')
    closePromoteModal()
    setTimeout(() => {
      successMessage.value = ''
    }, 3000)
  } catch (err: any) {
    errorMessage.value = err?.data?.message || err?.message || t('adminTenants.mspRoles.messages.promoteError')
  } finally {
    promoting.value = false
  }
}

if (error.value) {
  errorMessage.value = error.value.message
}
</script>

<style scoped>
/* Rotate chevron when details is open */
details[open] summary .chevron-icon {
  transform: rotate(180deg);
}
</style>
