<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <NuxtLink
        to="/settings"
        class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
      >
        ← {{ t('nav.settings') }}
      </NuxtLink>
      <div>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.operations.title') }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ t('settings.operations.subtitle') }}
        </p>
      </div>
    </header>

    <!-- Tab navigation -->
    <div class="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition"
        :class="activeTab === tab.id
          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'"
        @click="activeTab = tab.id"
      >
        <Icon :icon="tab.icon" class="mr-2 inline h-4 w-4" />
        {{ tab.label }}
      </button>
    </div>

    <ClientOnly>
      <!-- UPSTREAM INCIDENTS TAB -->
      <div v-if="activeTab === 'upstream'" class="space-y-6">
        <div v-if="loadingUpstream" class="flex items-center justify-center py-12">
          <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
          <span class="ml-3 text-sm text-slate-500">{{ t('settings.operations.loading') }}</span>
        </div>

        <template v-else>
          <!-- Active Incidents Section -->
          <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
            <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
                {{ t('settings.operations.activeIncidents') }}
              </h2>
            </div>

            <div v-if="visibleUpstreamIncidents.length === 0" class="px-6 py-8 text-center">
              <Icon icon="mdi:check-circle-outline" class="mx-auto h-12 w-12 text-emerald-500" />
              <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {{ t('settings.operations.noActiveIncidents') }}
              </p>
            </div>

            <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
              <div
                v-for="incident in visibleUpstreamIncidents"
                :key="incident.id"
                class="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                    :class="severityBgClass(incident.severity)"
                  >
                    <Icon :icon="severityIcon(incident.severity)" class="h-5 w-5" :class="severityIconClass(incident.severity)" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-medium text-slate-900 dark:text-slate-100">{{ incident.title }}</p>
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="severityBadgeClass(incident.severity)"
                      >
                        {{ t(`operations.severity.${incident.severity}`) }}
                      </span>
                      <span v-if="incident.isPlanned" class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                        <Icon icon="mdi:clock-outline" class="h-3 w-3" />
                        {{ t('operations.planned') }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {{ t('operations.from') }} {{ incident.sourceTenantName }}
                      <span v-if="incident.startsAt"> · {{ formatDate(incident.startsAt) }}</span>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button
                    class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    :disabled="mutingId === incident.id"
                    @click="hideForMe(incident.id)"
                  >
                    <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                    <Icon v-else icon="mdi:bell-off-outline" class="h-3.5 w-3.5" />
                    {{ t('settings.operations.hideForMe') }}
                  </button>
                  <button
                    v-if="canManageOrg"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                    :disabled="mutingId === incident.id"
                    @click="hideForOrg(incident.id)"
                  >
                    <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                    <Icon v-else icon="mdi:account-group" class="h-3.5 w-3.5" />
                    {{ t('settings.operations.hideForOrg') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Hidden Incidents Section -->
          <div class="rounded-2xl border border-slate-200 bg-white shadow-card dark:border-white/10 dark:bg-[#0c1524]">
            <div class="border-b border-slate-200 px-6 py-4 dark:border-white/5">
              <h2 class="text-sm font-semibold text-slate-900 dark:text-white">
                {{ t('settings.operations.hiddenIncidents') }}
              </h2>
            </div>

            <div v-if="hiddenUpstreamIncidents.length === 0" class="px-6 py-8 text-center">
              <Icon icon="mdi:eye-outline" class="mx-auto h-12 w-12 text-slate-400" />
              <p class="mt-3 text-sm text-slate-600 dark:text-slate-300">
                {{ t('settings.operations.noHiddenIncidents') }}
              </p>
            </div>

            <div v-else class="divide-y divide-slate-100 dark:divide-white/5">
              <div
                v-for="incident in hiddenUpstreamIncidents"
                :key="incident.id"
                class="flex items-center justify-between gap-4 px-6 py-4 bg-slate-50/50 dark:bg-white/[0.02]"
              >
                <div class="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg opacity-60"
                    :class="severityBgClass(incident.severity)"
                  >
                    <Icon :icon="severityIcon(incident.severity)" class="h-5 w-5" :class="severityIconClass(incident.severity)" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-medium text-slate-600 dark:text-slate-400">{{ incident.title }}</p>
                      <span
                        v-if="incident.isUserMuted"
                        class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-400"
                      >
                        {{ t('settings.operations.hiddenForMe') }}
                      </span>
                      <span
                        v-if="incident.isScopeMuted"
                        class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                      >
                        {{ t('settings.operations.hiddenForOrg') }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {{ t('operations.from') }} {{ incident.sourceTenantName }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button
                    v-if="incident.isUserMuted"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                    :disabled="mutingId === incident.id"
                    @click="showForMe(incident.id)"
                  >
                    <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                    <Icon v-else icon="mdi:bell-outline" class="h-3.5 w-3.5" />
                    {{ t('settings.operations.showForMe') }}
                  </button>
                  <button
                    v-if="incident.isScopeMuted && canManageOrg"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                    :disabled="mutingId === incident.id"
                    @click="showForOrg(incident.id)"
                  >
                    <Icon v-if="mutingId === incident.id" icon="mdi:loading" class="h-3.5 w-3.5 animate-spin" />
                    <Icon v-else icon="mdi:account-group" class="h-3.5 w-3.5" />
                    {{ t('settings.operations.showForOrg') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- ORGANIZATION'S OWN INCIDENTS TAB -->
      <div v-if="activeTab === 'internal'" class="space-y-6">
        <!-- Header with create button -->
        <div v-if="canManageOrg" class="flex items-center justify-between">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ t('settings.incidents.subtitle') }}
          </p>
          <button
            class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
            @click="showCreateModal = true"
          >
            <Icon icon="mdi:plus" class="h-4 w-4" />
            {{ t('settings.incidents.create') }}
          </button>
        </div>

        <!-- Filter tabs for internal incidents -->
        <div class="flex gap-2">
          <button
            v-for="f in internalFilterTabs"
            :key="f.value"
            class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
            :class="internalFilter === f.value
              ? 'bg-brand text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'"
            @click="internalFilter = f.value; fetchInternalIncidents()"
          >
            {{ f.label }}
          </button>
        </div>

        <div v-if="loadingInternal" class="flex items-center justify-center py-12">
          <Icon icon="mdi:loading" class="h-8 w-8 animate-spin text-brand" />
        </div>

        <div v-else-if="internalIncidents.length === 0" class="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-card dark:border-white/10 dark:bg-[#0c1524]">
          <Icon icon="mdi:bell-off-outline" class="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600" />
          <h3 class="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ t('settings.incidents.noIncidents') }}
          </h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ t('settings.incidents.noIncidentsDesc') }}
          </p>
          <button
            v-if="canManageOrg"
            class="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
            @click="showCreateModal = true"
          >
            <Icon icon="mdi:plus" class="h-4 w-4" />
            {{ t('settings.incidents.createFirst') }}
          </button>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="incident in internalIncidents"
            :key="incident.id"
            class="rounded-2xl border bg-white shadow-card transition hover:shadow-md dark:bg-[#0c1524]"
            :class="incidentBorderClass(incident.severity)"
          >
            <div class="flex items-center gap-4 p-5">
              <div
                class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
                :class="severityBgClass(incident.severity)"
              >
                <Icon :icon="severityIcon(incident.severity)" class="h-6 w-6" :class="severityIconClass(incident.severity)" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-slate-900 dark:text-slate-100">{{ incident.title }}</span>
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="severityBadgeClass(incident.severity)"
                  >
                    {{ t(`operations.severity.${incident.severity}`) }}
                  </span>
                  <span
                    v-if="incident.status === 'archived'"
                    class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-400"
                  >
                    {{ t('admin.tenantAdmin.operations.status.archived') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {{ formatDate(incident.createdAt) }}
                  <span v-if="incident.createdBy"> · {{ incident.createdBy.fullName || incident.createdBy.email }}</span>
                </p>
              </div>

              <div v-if="canManageOrg" class="flex items-center gap-2 flex-shrink-0">
                <button
                  class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-300"
                  :title="t('common.edit')"
                  @click="openEditModal(incident)"
                >
                  <Icon icon="mdi:pencil" class="h-5 w-5" />
                </button>
                <button
                  v-if="incident.status === 'active'"
                  class="rounded-lg p-2 text-slate-400 transition hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                  :title="t('admin.tenantAdmin.operations.archive')"
                  :disabled="actionLoading === incident.id"
                  @click="archiveIncident(incident.id)"
                >
                  <Icon v-if="actionLoading === incident.id" icon="mdi:loading" class="h-5 w-5 animate-spin" />
                  <Icon v-else icon="mdi:archive" class="h-5 w-5" />
                </button>
                <button
                  v-if="incident.status === 'archived'"
                  class="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                  :title="t('admin.tenantAdmin.operations.unarchive')"
                  :disabled="actionLoading === incident.id"
                  @click="unarchiveIncident(incident.id)"
                >
                  <Icon v-if="actionLoading === incident.id" icon="mdi:loading" class="h-5 w-5 animate-spin" />
                  <Icon v-else icon="mdi:archive-arrow-up" class="h-5 w-5" />
                </button>
                <button
                  class="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  :title="t('admin.tenantAdmin.operations.delete')"
                  :disabled="actionLoading === incident.id"
                  @click="confirmDelete(incident)"
                >
                  <Icon icon="mdi:delete" class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal || editingIncident"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeModal"
      >
        <div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ editingIncident ? t('settings.incidents.edit') : t('settings.incidents.create') }}
          </h3>
          
          <form class="mt-6 space-y-5" @submit.prevent="handleSubmit">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {{ t('admin.tenantAdmin.operations.incidentTitle') }} *
              </label>
              <input
                v-model="form.title"
                type="text"
                required
                maxlength="200"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>

            <!-- Status (only when editing) -->
            <div v-if="editingIncident">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {{ t('admin.tenantAdmin.operations.status.label') }}
              </label>
              <div class="flex gap-2">
                <button
                  v-for="st in statusOptions"
                  :key="st.value"
                  type="button"
                  class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                  :class="form.status === st.value ? st.activeClass : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'"
                  @click="form.status = st.value"
                >
                  {{ st.label }}
                </button>
              </div>
            </div>

            <!-- Severity -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {{ t('admin.tenantAdmin.operations.severity') }}
              </label>
              <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
                <button
                  v-for="sev in severityOptions"
                  :key="sev.value"
                  type="button"
                  class="rounded-lg border px-2 py-2 text-xs font-medium transition"
                  :class="form.severity === sev.value ? sev.activeClass : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'"
                  @click="form.severity = sev.value"
                >
                  <Icon :icon="sev.icon" class="inline h-4 w-4 mr-1" />
                  {{ sev.label }}
                </button>
              </div>
            </div>

            <!-- Time window -->
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {{ t('admin.tenantAdmin.operations.startsAt') }}
                </label>
                <input
                  v-model="form.startsAt"
                  type="datetime-local"
                  class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {{ t('admin.tenantAdmin.operations.endsAt') }}
                </label>
                <input
                  v-model="form.endsAt"
                  type="datetime-local"
                  class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-900 focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>

            <!-- Body -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {{ t('admin.tenantAdmin.operations.incidentBody') }}
              </label>
              <textarea
                v-model="form.bodyMarkdown"
                rows="4"
                maxlength="10000"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 font-mono text-sm focus:border-brand focus:ring-brand dark:border-white/20 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>

            <!-- Error -->
            <div v-if="formError" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {{ formError }}
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                @click="closeModal"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="submitting || !form.title.trim()"
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-50"
              >
                <Icon v-if="submitting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
                {{ editingIncident ? t('common.save') : t('admin.tenantAdmin.operations.publish') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div
        v-if="deleteTarget"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="deleteTarget = null"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('admin.tenantAdmin.operations.confirmDelete') }}
          </h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ deleteTarget.title }}
          </p>
          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              @click="deleteTarget = null"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
              :disabled="actionLoading === deleteTarget.id"
              @click="deleteIncident(deleteTarget.id)"
            >
              <Icon v-if="actionLoading === deleteTarget.id" icon="mdi:loading" class="inline h-4 w-4 animate-spin mr-1" />
              {{ t('admin.tenantAdmin.operations.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { refreshOperationsFeed } from '~/composables/useOperationsFeed'

definePageMeta({
  layout: 'default'
})

const { t } = useI18n()
const auth = useAuth()

// Tab state
const activeTab = ref<'upstream' | 'internal'>('upstream')

const tabs = computed(() => [
  { id: 'upstream' as const, label: t('settings.operations.upstreamTab'), icon: 'mdi:arrow-down-bold' },
  { id: 'internal' as const, label: t('settings.operations.internalTab'), icon: 'mdi:office-building' }
])

// ========== UPSTREAM INCIDENTS ==========
interface UpstreamIncident {
  id: string
  title: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved'
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  sourceTenantId: string
  sourceTenantName: string
  sourceTenantType: string
  isUserMuted: boolean
  isScopeMuted: boolean
  isMuted: boolean
  isPlanned: boolean
}

const loadingUpstream = ref(true)
const mutingId = ref<string | null>(null)
const upstreamIncidents = ref<UpstreamIncident[]>([])

const visibleUpstreamIncidents = computed(() => upstreamIncidents.value.filter((i) => !i.isMuted))
const hiddenUpstreamIncidents = computed(() => upstreamIncidents.value.filter((i) => i.isMuted))

async function fetchUpstreamIncidents() {
  loadingUpstream.value = true
  try {
    const response = await $fetch<{ incidents: UpstreamIncident[] }>('/api/operations/incidents?includeMuted=1', {
      credentials: 'include'
    })
    upstreamIncidents.value = response.incidents
  } catch (err) {
    console.error('Failed to fetch upstream incidents:', err)
  } finally {
    loadingUpstream.value = false
  }
}

async function hideForMe(incidentId: string) {
  mutingId.value = incidentId
  try {
    await $fetch(`/api/operations/incidents/${incidentId}/mute`, { method: 'POST', credentials: 'include' })
    await fetchUpstreamIncidents()
  } catch (err) {
    console.error('Failed to hide incident:', err)
  } finally {
    mutingId.value = null
  }
}

async function showForMe(incidentId: string) {
  mutingId.value = incidentId
  try {
    await $fetch(`/api/operations/incidents/${incidentId}/unmute`, { method: 'POST', credentials: 'include' })
    await fetchUpstreamIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to show incident:', err)
  } finally {
    mutingId.value = null
  }
}

async function hideForOrg(incidentId: string) {
  mutingId.value = incidentId
  try {
    await $fetch(`/api/admin/incidents/${incidentId}/mute`, {
      method: 'POST',
      body: { targetType: 'organization' },
      credentials: 'include'
    })
    await fetchUpstreamIncidents()
  } catch (err) {
    console.error('Failed to hide incident for org:', err)
  } finally {
    mutingId.value = null
  }
}

async function showForOrg(incidentId: string) {
  mutingId.value = incidentId
  try {
    await $fetch(`/api/admin/incidents/${incidentId}/unmute`, {
      method: 'POST',
      body: { targetType: 'organization' },
      credentials: 'include'
    })
    await fetchUpstreamIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to show incident for org:', err)
  } finally {
    mutingId.value = null
  }
}

// ========== INTERNAL (ORG) INCIDENTS ==========
interface InternalIncident {
  id: string
  title: string
  slug: string
  bodyMarkdown: string | null
  severity: 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned'
  status: 'active' | 'resolved' | 'archived'
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  createdBy: { id: string; email: string; fullName: string | null } | null
}

const loadingInternal = ref(true)
const internalIncidents = ref<InternalIncident[]>([])
const internalFilter = ref<'active' | 'archived' | 'all'>('active')
const actionLoading = ref<string | null>(null)
const deleteTarget = ref<InternalIncident | null>(null)

const internalFilterTabs = computed(() => [
  { value: 'active' as const, label: t('admin.tenantAdmin.operations.activeIncidents') },
  { value: 'archived' as const, label: t('admin.tenantAdmin.operations.archivedIncidents') },
  { value: 'all' as const, label: t('common.all') }
])

const currentOrgId = computed(() => auth.currentOrg?.value?.id)

const canManageOrg = computed(() => {
  const org = auth.currentOrg?.value
  if (!org) return false
  const orgRoles = auth.orgRoles?.value ?? {}
  const role = orgRoles[org.id]
  return role === 'owner' || role === 'admin' || role === 'support'
})

async function fetchInternalIncidents() {
  if (!currentOrgId.value) {
    loadingInternal.value = false
    return
  }
  loadingInternal.value = true
  try {
    const response = await $fetch<{ incidents: InternalIncident[] }>(
      `/api/organizations/${currentOrgId.value}/incidents?filter=${internalFilter.value}`,
      { credentials: 'include' }
    )
    internalIncidents.value = response.incidents
  } catch (err) {
    console.error('Failed to fetch internal incidents:', err)
  } finally {
    loadingInternal.value = false
  }
}

// Modal state
const showCreateModal = ref(false)
const editingIncident = ref<InternalIncident | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)

const form = ref({
  title: '',
  status: 'active' as 'active' | 'resolved' | 'archived',
  severity: 'notice' as 'critical' | 'outage' | 'notice' | 'maintenance' | 'planned',
  bodyMarkdown: '',
  startsAt: '',
  endsAt: ''
})

const statusOptions = computed(() => [
  { value: 'active' as const, label: t('admin.tenantAdmin.operations.status.active'), activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { value: 'resolved' as const, label: t('admin.tenantAdmin.operations.status.resolved'), activeClass: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-300' },
  { value: 'archived' as const, label: t('admin.tenantAdmin.operations.status.archived'), activeClass: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300' }
])

const severityOptions = computed(() => [
  { value: 'critical' as const, label: t('operations.severity.critical'), icon: 'mdi:alert-circle', activeClass: 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-300' },
  { value: 'outage' as const, label: t('operations.severity.outage'), icon: 'mdi:alert', activeClass: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/50 dark:bg-orange-500/20 dark:text-orange-300' },
  { value: 'maintenance' as const, label: t('operations.severity.maintenance'), icon: 'mdi:wrench', activeClass: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/20 dark:text-sky-300' },
  { value: 'planned' as const, label: t('operations.severity.planned'), icon: 'mdi:calendar-clock', activeClass: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-300' },
  { value: 'notice' as const, label: t('operations.severity.notice'), icon: 'mdi:information', activeClass: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-300' }
])

function openEditModal(incident: InternalIncident) {
  editingIncident.value = incident
  form.value = {
    title: incident.title,
    status: incident.status,
    severity: incident.severity,
    bodyMarkdown: incident.bodyMarkdown || '',
    startsAt: incident.startsAt ? formatDatetimeLocal(incident.startsAt) : '',
    endsAt: incident.endsAt ? formatDatetimeLocal(incident.endsAt) : ''
  }
  formError.value = null
}

function closeModal() {
  showCreateModal.value = false
  editingIncident.value = null
  form.value = { title: '', status: 'active', severity: 'notice', bodyMarkdown: '', startsAt: '', endsAt: '' }
  formError.value = null
}

async function handleSubmit() {
  if (!currentOrgId.value || !form.value.title.trim()) return
  
  submitting.value = true
  formError.value = null

  try {
    const payload = {
      title: form.value.title.trim(),
      severity: form.value.severity,
      bodyMarkdown: form.value.bodyMarkdown.trim() || null,
      startsAt: form.value.startsAt ? new Date(form.value.startsAt).toISOString() : null,
      endsAt: form.value.endsAt ? new Date(form.value.endsAt).toISOString() : null,
      ...(editingIncident.value ? { status: form.value.status } : {})
    }

    if (editingIncident.value) {
      await $fetch(`/api/organizations/${currentOrgId.value}/incidents/${editingIncident.value.id}`, {
        method: 'PUT',
        body: payload,
        credentials: 'include'
      })
    } else {
      await $fetch(`/api/organizations/${currentOrgId.value}/incidents`, {
        method: 'POST',
        body: payload,
        credentials: 'include'
      })
    }

    closeModal()
    await fetchInternalIncidents()
    await refreshOperationsFeed()
  } catch (err: any) {
    formError.value = err.data?.message || err.message || 'Failed to save incident'
  } finally {
    submitting.value = false
  }
}

async function archiveIncident(incidentId: string) {
  if (!currentOrgId.value) return
  actionLoading.value = incidentId
  try {
    await $fetch(`/api/organizations/${currentOrgId.value}/incidents/${incidentId}/archive`, {
      method: 'POST',
      credentials: 'include'
    })
    await fetchInternalIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to archive incident:', err)
  } finally {
    actionLoading.value = null
  }
}

async function unarchiveIncident(incidentId: string) {
  if (!currentOrgId.value) return
  actionLoading.value = incidentId
  try {
    await $fetch(`/api/organizations/${currentOrgId.value}/incidents/${incidentId}/unarchive`, {
      method: 'POST',
      credentials: 'include'
    })
    await fetchInternalIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to unarchive incident:', err)
  } finally {
    actionLoading.value = null
  }
}

function confirmDelete(incident: InternalIncident) {
  deleteTarget.value = incident
}

async function deleteIncident(incidentId: string) {
  if (!currentOrgId.value) return
  actionLoading.value = incidentId
  try {
    await $fetch(`/api/organizations/${currentOrgId.value}/incidents/${incidentId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    deleteTarget.value = null
    await fetchInternalIncidents()
    await refreshOperationsFeed()
  } catch (err) {
    console.error('Failed to delete incident:', err)
  } finally {
    actionLoading.value = null
  }
}

// ========== HELPERS ==========
function severityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return 'mdi:alert-circle'
    case 'outage': return 'mdi:alert'
    case 'maintenance': return 'mdi:wrench'
    case 'planned': return 'mdi:calendar-clock'
    default: return 'mdi:information'
  }
}

function severityIconClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'text-red-600 dark:text-red-400'
    case 'outage': return 'text-orange-600 dark:text-orange-400'
    case 'maintenance':
    case 'planned': return 'text-blue-600 dark:text-blue-400'
    default: return 'text-amber-600 dark:text-amber-400'
  }
}

function severityBgClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 dark:bg-red-500/20'
    case 'outage': return 'bg-orange-100 dark:bg-orange-500/20'
    case 'maintenance':
    case 'planned': return 'bg-blue-100 dark:bg-blue-500/20'
    default: return 'bg-amber-100 dark:bg-amber-500/20'
  }
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
    case 'outage': return 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
    case 'maintenance':
    case 'planned': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
    default: return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
  }
}

function incidentBorderClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-200 dark:border-red-500/30'
    case 'outage': return 'border-orange-200 dark:border-orange-500/30'
    case 'maintenance':
    case 'planned': return 'border-blue-200 dark:border-blue-500/30'
    default: return 'border-amber-200 dark:border-amber-500/30'
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
}

function formatDatetimeLocal(dateStr: string): string {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Fetch data on mount and when tab changes
watch(activeTab, (tab) => {
  if (tab === 'upstream' && upstreamIncidents.value.length === 0) {
    fetchUpstreamIncidents()
  } else if (tab === 'internal' && internalIncidents.value.length === 0) {
    fetchInternalIncidents()
  }
})

watch(currentOrgId, () => {
  if (activeTab.value === 'internal') {
    fetchInternalIncidents()
  }
})

onMounted(() => {
  fetchUpstreamIncidents()
  if (currentOrgId.value) {
    fetchInternalIncidents()
  }
})
</script>
