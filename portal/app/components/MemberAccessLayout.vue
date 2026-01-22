<template>
  <section class="space-y-6">
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <NuxtLink
            to="/settings"
            class="text-xs uppercase tracking-[0.3em] text-slate-400 transition hover:text-brand dark:text-slate-500"
          >
            {{ t('settings.members.backToSettings') }}
          </NuxtLink>
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {{ t('settings.memberAccess.title') }}
          </h1>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ t('settings.memberAccess.description') }}
          </p>
        </div>

        <div
          v-if="currentOrgName"
          class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand/20">
            <Icon icon="mdi:domain" class="h-5 w-5" />
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ t('settings.members.activeOrganization') }}
            </p>
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ currentOrgName }}
            </p>
          </div>
        </div>
      </div>

      <nav class="flex flex-wrap gap-2">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.key"
          :to="tab.to"
          :aria-disabled="isTabDisabled(tab)"
          :tabindex="isTabDisabled(tab) ? -1 : 0"
          :class="tabClass(tab.key, isTabDisabled(tab))"
        >
          <Icon :icon="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </NuxtLink>
      </nav>
    </header>

    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed } from '#imports'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router'
import { useAuth } from '~/composables/useAuth'
import { usePermission } from '~/composables/usePermission'
import { useI18n } from '#imports'

type TabKey = 'members' | 'groups' | 'group-permissions' | 'delegations'

const { t } = useI18n()
const route = useRoute()
const auth = useAuth()
const { can } = usePermission()

const tabs = computed(() => ([
  {
    key: 'members' as const,
    to: '/settings/members',
    label: t('settings.members.title'),
    icon: 'mdi:account'
  },
  {
    key: 'groups' as const,
    to: '/settings/groups',
    label: t('settings.groups.title'),
    icon: 'mdi:account-multiple'
  },
  {
    key: 'group-permissions' as const,
    to: '/settings/group-permissions',
    label: t('settings.groupPermissions.title'),
    icon: 'mdi:shield-account'
  },
  {
    key: 'delegations' as const,
    to: '/settings/delegations',
    label: t('settings.delegations.title'),
    icon: 'mdi:account-key'
  }
]))

const activeTab = computed<TabKey>(() => {
  const path = route.path
  if (path.startsWith('/settings/group-permissions')) return 'group-permissions'
  if (path.startsWith('/settings/groups')) return 'groups'
  if (path.startsWith('/settings/delegations')) return 'delegations'
  return 'members'
})

const hasActiveOrg = computed(() => Boolean(auth.state.value.data?.currentOrgId))
const currentOrgName = computed(() => auth.currentOrg.value?.name ?? '')
const canManageOrg = can('org:manage')
const isSettingsLocked = computed(() => {
  if (!auth.state.value.initialized || auth.state.value.loading) {
    return false
  }
  if (!hasActiveOrg.value) {
    return true
  }
  return !canManageOrg.value
})

const isTabDisabled = (tab: { key: TabKey }) => {
  if (isSettingsLocked.value) {
    return true
  }
  if (tab.key === 'delegations') {
    return !canManageOrg.value
  }
  return false
}

const tabClass = (key: TabKey, disabled: boolean) => {
  const base =
    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition'
  const active =
    activeTab.value === key
      ? 'border-brand bg-brand/10 text-brand dark:border-brand/80 dark:bg-brand/10 dark:text-brand/80'
      : 'border-slate-200 text-slate-600 hover:border-brand hover:text-brand dark:border-white/10 dark:text-slate-200'
  const disabledClass = disabled ? 'pointer-events-none opacity-50' : ''
  return [base, active, disabledClass].join(' ')
}
</script>
