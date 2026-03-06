<template>
  <section class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{{ t('settings.administration') }}</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.title') }}</h1>
    </header>

    <!-- Loading state while auth is initializing -->
    <div v-if="!showContent" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>

    <div v-if="showContent" class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-center gap-3">
          <Icon icon="mdi:office-building-outline" class="h-6 w-6 text-brand" />
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ organizationSectionTitle }}</h2>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ t('settings.organizations.description') }}
          <span v-if="hasActiveTenant && auth.currentTenant.value" class="block text-xs text-slate-400 dark:text-slate-500">
            {{ t('settings.organizations.showingOnly', { tenant: auth.currentTenant.value.name }) }}
          </span>
        </p>

        <!-- Active Organization Section -->
        <div v-if="hasActiveOrg && activeOrganization" class="mt-4">
          <div class="rounded-xl border border-brand bg-brand-light/40 px-4 py-3 dark:border-brand/70 dark:bg-brand/10">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <p class="font-semibold text-slate-900 dark:text-slate-100">{{ activeOrganization.name }}</p>
                  <span
                    v-if="isPrimaryOrganization(activeOrganization.id)"
                    class="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    {{ t('settings.organizations.primary') }}
                  </span>
                  <span
                    v-else
                    class="text-xs text-slate-400 dark:text-slate-500"
                  >
                    {{ t('settings.organizations.notPrimary') }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ t('settings.organizations.role') }}: {{ activeOrganization.role }}
                  <span
                    v-if="activeOrgAccessLabel"
                    class="ml-2 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand dark:bg-brand/20 dark:text-brand-light"
                  >
                    <Icon icon="mdi:account-hard-hat" class="h-3 w-3" />
                    {{ activeOrgAccessLabel }}
                  </span>
                </p>
                <p class="mt-1 text-xs font-semibold text-brand">{{ t('settings.organizations.activeNow') }}</p>
              </div>
              <button
                class="flex items-center justify-center rounded-full p-2 transition hover:bg-white/20"
                :class="
                  isPrimaryOrganization(activeOrganization.id)
                    ? 'text-yellow-500'
                    : 'text-slate-400 hover:text-yellow-500'
                "
                :title="
                  isPrimaryOrganization(activeOrganization.id)
                    ? t('settings.organizations.isPrimary')
                    : t('settings.organizations.setAsPrimary')
                "
                @click="handleSetPrimary(activeOrganization.id)"
              >
                <Icon
                  :icon="isPrimaryOrganization(activeOrganization.id) ? 'mdi:star' : 'mdi:star-outline'"
                  class="h-5 w-5"
                />
              </button>
            </div>
          </div>
        </div>

        <p
          v-if="!hasActiveOrg"
          class="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {{ t('settings.organizations.noActiveOrg') }}
        </p>

        <!-- Other Organizations Section -->
        <div v-if="otherOrganizations.length > 0" class="mt-6">
          <h3 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.organizations.otherOrganizations') }}</h3>
          
          <!-- Search Input - Only show if more than 3 organizations -->
          <div v-if="otherOrganizations.length > 3" class="mb-4">
            <input
              v-model="searchTerm"
              type="text"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder-slate-500"
              :placeholder="t('settings.organizations.searchPlaceholder')"
              @input="currentPage = 1"
            />
          </div>

          <!-- Organization List -->
          <ul class="space-y-3">
            <li
              v-for="org in pagedOrganizations"
              :key="org.id"
              class="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <div class="flex flex-1 items-center gap-3">
                <button
                  class="flex items-center justify-center rounded-full p-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  :class="
                    isPrimaryOrganization(org.id)
                      ? 'text-yellow-500'
                      : 'text-slate-400 hover:text-yellow-500'
                  "
                  :title="
                    isPrimaryOrganization(org.id)
                      ? t('settings.organizations.isPrimary')
                      : t('settings.organizations.setAsPrimary')
                  "
                  @click="handleSetPrimary(org.id)"
                >
                  <Icon
                    :icon="isPrimaryOrganization(org.id) ? 'mdi:star' : 'mdi:star-outline'"
                    class="h-5 w-5"
                  />
                </button>
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <p class="font-semibold text-slate-900 dark:text-slate-100">{{ org.name }}</p>
                    <span
                      v-if="isPrimaryOrganization(org.id)"
                      class="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                    >
                      {{ t('settings.organizations.primary') }}
                    </span>
                    <span
                      v-if="org.status !== 'active'"
                      class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    >
                      {{ t('settings.organizations.inactive') }}
                    </span>
                    <span
                      v-if="org.accessType === 'delegation'"
                      class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:text-emerald-100"
                    >
                      {{ t('settings.organizations.viaDelegation') }}
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400">
                    {{ t('settings.organizations.role') }}: {{ org.role }}
                    <span
                      v-if="org.accessType === 'msp'"
                      class="ml-2 inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand dark:bg-brand/20 dark:text-brand-light"
                    >
                      <Icon icon="mdi:account-hard-hat" class="h-3 w-3" />
                      {{ t('settings.organizations.viaTenant') }}
                    </span>
                    <span
                      v-else-if="org.accessType === 'delegation'"
                      class="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
                    >
                      <Icon icon="mdi:account-key" class="h-3 w-3" />
                      {{ t('settings.organizations.viaDelegation') }}
                      <span v-if="org.expiresAt" class="text-[10px] text-emerald-700 dark:text-emerald-200">
                        ({{ formatExpiry(org.expiresAt) }})
                      </span>
                    </span>
                  </p>
                </div>
              </div>
              <button
                class="rounded-full border border-slate-200 px-3 py-1 text-xs transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                :disabled="org.status !== 'active'"
                @click="auth.switchOrganization(org.id)"
              >
                {{ t('settings.organizations.select') }}
              </button>
            </li>
          </ul>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="mt-4 flex items-center justify-center gap-2">
            <button
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
              :disabled="currentPage === 1"
              @click="currentPage = Math.max(1, currentPage - 1)"
            >
              {{ t('settings.organizations.previous') }}
            </button>
            <span class="text-sm text-slate-600 dark:text-slate-400">
              {{ t('settings.organizations.page', { current: currentPage, total: totalPages }) }}
            </span>
            <button
              class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-200"
              :disabled="currentPage >= totalPages"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
            >
              {{ t('settings.organizations.next') }}
            </button>
          </div>
        </div>

        <p
          v-if="otherOrganizations.length === 0 && filteredOrganizations.length === 0"
          class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        >
          {{ t('settings.organizations.noOrganizations') }}
        </p>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:account-group-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.memberAccess.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.memberAccess.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/members"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.members.features.status') }}</li>
          <li>• {{ t('settings.members.features.roles') }}</li>
          <li>• {{ t('settings.members.features.remove') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:shield-lock-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.auth.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.auth.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/auth"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.auth.features.idp') }}</li>
          <li>• {{ t('settings.auth.features.cloudflare') }}</li>
          <li>• {{ t('settings.auth.features.require') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:email-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.email.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.email.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/email"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.email.features.override') }}</li>
          <li>• {{ t('settings.email.features.configure') }}</li>
          <li>• {{ t('settings.email.features.customize') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:palette-outline" class="h-6 w-6 text-brand" />
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.branding.title') }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {{ t('settings.branding.description', { orgName: activeOrganisationName }) }}
                </p>
              </div>
            </div>
          </div>
          <NuxtLink
            to="/settings/branding"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.branding.features.logos') }}</li>
          <li>• {{ t('settings.branding.features.color') }}</li>
          <li>• {{ t('settings.branding.features.login') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:web" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.customDomain.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.customDomain.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/domain"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.customDomain.features.own') }}</li>
          <li>• {{ t('settings.customDomain.features.ssl') }}</li>
          <li>• {{ t('settings.customDomain.features.verify') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:puzzle-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.modules.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.modules.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/modules"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.modules.features.enable') }}</li>
          <li>• {{ t('settings.modules.features.permissions') }}</li>
          <li>• {{ t('settings.modules.features.granular') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:file-document-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.audit.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.audit.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/audit"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.audit.features.events') }}</li>
          <li>• {{ t('settings.audit.features.track') }}</li>
          <li>• {{ t('settings.audit.features.overview') }}</li>
        </ul>
      </div>

      <div
        :class="[
          'rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70',
          { 'pointer-events-none opacity-50': isSettingsLocked }
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:key-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.apiTokens.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.apiTokens.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/api-tokens"
            :aria-disabled="isSettingsLocked"
            :tabindex="isSettingsLocked ? -1 : 0"
            :class="[
              'rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200',
              { 'pointer-events-none opacity-50': isSettingsLocked }
            ]"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.apiTokens.features.create') }}</li>
          <li>• {{ t('settings.apiTokens.features.scopes') }}</li>
          <li>• {{ t('settings.apiTokens.features.revoke') }}</li>
        </ul>
      </div>

      <div class="rounded-2xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <Icon icon="mdi:bell-outline" class="h-6 w-6 text-brand" />
              <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ t('settings.operations.title') }}</h2>
            </div>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {{ t('settings.operations.description') }}
            </p>
          </div>
          <NuxtLink
            to="/settings/operations"
            class="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-600 dark:text-slate-200"
          >
            {{ t('settings.open') }}
          </NuxtLink>
        </div>
        <ul class="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
          <li>• {{ t('settings.operations.features.viewAll') }}</li>
          <li>• {{ t('settings.operations.features.manage') }}</li>
          <li>• {{ t('settings.operations.features.unmute') }}</li>
        </ul>
      </div>

    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'
import { matchesSearch } from '~/utils/search'
import type { AuthOrganization } from '~/types/auth'

const { t } = useI18n()
const auth = useAuth()
const { can } = usePermission()

// Bootstrap auth state on mount if not already initialized
onMounted(async () => {
  if (!auth.state.value.initialized && !auth.state.value.loading) {
    await auth.bootstrap()
  }
})

// Computed property to determine if content should be shown
const showContent = computed(() => {
  return auth.state.value.initialized && !auth.state.value.loading
})

const currentTenantId = computed(() => auth.state.value.data?.currentTenantId ?? null)
const hasActiveTenant = computed(() => Boolean(currentTenantId.value))

const PAGE_SIZE = 3
const searchTerm = ref('')
const currentPage = ref(1)

// Reset to page 1 when search term changes
watch(searchTerm, () => {
  currentPage.value = 1
})

const filteredOrganizations = computed(() => {
  const tenantId = currentTenantId.value
  const isSuperAdmin = auth.state.value.data?.user?.isSuperAdmin ?? false
  const tenantRoles = auth.state.value.data?.tenantRoles ?? {}
  
  let orgs: AuthOrganization[]
  // Only filter by tenant if user has membership in that tenant
  // Otherwise, show all organizations where user has direct membership
  if (!tenantId || !tenantRoles[tenantId]) {
    // No active tenant or user doesn't have membership in active tenant - show all organizations
    orgs = auth.organizations.value
  } else {
    // User has membership in active tenant - show only organizations for that tenant
    orgs = auth.organizations.value.filter((org) => org.tenantId === tenantId)
  }

  // Filter out inactive organizations (unless super admin)
  if (!isSuperAdmin) {
    orgs = orgs.filter((org) => org.status === 'active')
  }

  // Sort organizations: lastAccessedAt desc (null last), then alphabetically
  const sorted = [...orgs].sort((a, b) => {
    // 1. lastAccessedAt desc (null last)
    if (a.lastAccessedAt && b.lastAccessedAt) {
      return b.lastAccessedAt - a.lastAccessedAt
    }
    if (a.lastAccessedAt && !b.lastAccessedAt) return -1
    if (!a.lastAccessedAt && b.lastAccessedAt) return 1

    // 2. Alphabetically by name
    return a.name.localeCompare(b.name)
  })

  return sorted
})

const currentOrgId = computed(() => auth.currentOrg.value?.id ?? '')

const activeOrganization = computed(() => {
  const activeOrgId = auth.state.value.data?.currentOrgId
  if (!activeOrgId) return null
  return filteredOrganizations.value.find((org) => org.id === activeOrgId) ?? null
})

const activeOrgAccessLabel = computed(() => {
  if (!activeOrganization.value) return null
  if (activeOrganization.value.accessType === 'msp') {
    return activeOrganization.value.role === 'admin' ? t('settings.organizations.adminViaTenant') : t('settings.organizations.viewerViaTenant')
  }
  if (activeOrganization.value.accessType === 'delegation') {
    return t('settings.organizations.viaDelegation')
  }
  return null
})

const otherOrganizations = computed(() => {
  const activeOrgId = auth.state.value.data?.currentOrgId
  return filteredOrganizations.value.filter((org) => org.id !== activeOrgId)
})

const defaultOrgId = computed(() => auth.state.value.data?.user?.defaultOrgId ?? null)

const isPrimaryOrganization = (orgId: string) => {
  return defaultOrgId.value === orgId
}

const filteredOtherOrganizations = computed(() => {
  if (!searchTerm.value.trim()) {
    return otherOrganizations.value
  }

  return otherOrganizations.value.filter((org) => {
    return (
      matchesSearch(org.name, searchTerm.value) ||
      matchesSearch(org.slug, searchTerm.value)
    )
  })
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredOtherOrganizations.value.length / PAGE_SIZE))
})

const pagedOrganizations = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredOtherOrganizations.value.slice(start, start + PAGE_SIZE)
})

const formatExpiry = (ts: number) => {
  if (!ts) return ''
  const date = new Date(ts)
  return date.toLocaleDateString('sv-SE')
}

async function handleSetPrimary(orgId: string) {
  if (isPrimaryOrganization(orgId)) {
    return // Already primary, do nothing
  }

  try {
    await auth.setPrimaryOrganization(orgId)
  } catch (error) {
    console.error('Failed to set primary organization:', error)
  }
}

const hasActiveOrg = computed(() => Boolean(auth.state.value.data?.currentOrgId))

const organizationSectionTitle = computed(() =>
  hasActiveTenant.value && auth.currentTenant.value
    ? t('settings.organizations.titleForTenant', { tenant: auth.currentTenant.value.name })
    : t('settings.organizations.title')
)
const canManageOrg = can('org:manage')
// Only lock settings if auth is initialized and det saknas rättigheter för aktiv org
const isSettingsLocked = computed(() => {
  if (!auth.state.value.initialized || auth.state.value.loading) {
    return false
  }
  if (!hasActiveOrg.value) {
    return true
  }
  return !canManageOrg.value
})

const activeOrganisationName = computed(() => auth.currentOrg.value?.name ?? t('settings.organizations.noActiveOrg'))
</script>

