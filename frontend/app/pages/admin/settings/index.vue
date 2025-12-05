<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-white">{{ t('admin.title') }}</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ t('admin.subtitle') }}
      </p>
    </header>

    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="section in adminSections"
        :key="section.to"
        class="flex flex-col rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/70"
      >
        <div class="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon :icon="section.icon" class="h-5 w-5" />
          </div>
          <div>
            <p class="text-base font-semibold">{{ section.title }}</p>
            <p v-if="section.category" class="text-xs uppercase tracking-wide text-slate-400">
              {{ section.category }}
            </p>
          </div>
        </div>
        <p class="mt-4 flex-1 text-sm text-slate-600 dark:text-slate-400">
          {{ section.description }}
        </p>
        <div class="mt-5 flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ section.badge }}
          </span>
          <NuxtLink
            :to="section.to"
            class="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
          >
            {{ t('admin.open') }}
            <Icon icon="mdi:open-in-new" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </article>
    </div>

    <div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p class="font-semibold">{{ t('admin.quickTip') }}</p>
      <p class="mt-1">
        {{ t('admin.quickTipText') }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from '#imports'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const { t } = useI18n()

const adminSections = [
  {
    title: t('admin.sections.tenants.title'),
    description: t('admin.sections.tenants.description'),
    badge: t('admin.sections.tenants.badge'),
    category: t('admin.sections.tenants.category'),
    icon: 'mdi:account-group',
    to: '/admin/tenants'
  },
  {
    title: t('admin.sections.modules.title'),
    description: t('admin.sections.modules.description'),
    badge: t('admin.sections.modules.badge'),
    category: t('admin.sections.modules.category'),
    icon: 'mdi:puzzle-outline',
    to: '/admin/modules'
  },
  {
    title: t('admin.sections.organizations.title'),
    description: t('admin.sections.organizations.description'),
    badge: t('admin.sections.organizations.badge'),
    category: t('admin.sections.organizations.category'),
    icon: 'mdi:office-building',
    to: '/admin/organizations'
  },
  {
    title: t('admin.sections.globalBranding.title'),
    description: t('admin.sections.globalBranding.description'),
    badge: t('admin.sections.globalBranding.badge'),
    category: t('admin.sections.globalBranding.category'),
    icon: 'mdi:palette-outline',
    to: '/admin/branding'
  },
  {
    title: t('admin.sections.rbacMatrix.title'),
    description: t('admin.sections.rbacMatrix.description'),
    badge: t('admin.sections.rbacMatrix.badge'),
    category: t('admin.sections.rbacMatrix.category'),
    icon: 'mdi:shield-key',
    to: '/admin/rbac-matrix'
  },
  {
    title: t('admin.sections.auditLogs.title'),
    description: t('admin.sections.auditLogs.description'),
    badge: t('admin.sections.auditLogs.badge'),
    category: t('admin.sections.auditLogs.category'),
    icon: 'mdi:file-search-outline',
    to: '/admin/audit-logs'
  },
  {
    title: t('admin.sections.adminEmail.title'),
    description: t('admin.sections.adminEmail.description'),
    badge: t('admin.sections.adminEmail.badge'),
    category: t('admin.sections.adminEmail.category'),
    icon: 'mdi:email-send-outline',
    to: '/admin/settings/email'
  },
  {
    title: t('admin.sections.users.title'),
    description: t('admin.sections.users.description'),
    badge: t('admin.sections.users.badge'),
    category: t('admin.sections.users.category'),
    icon: 'mdi:shield-crown',
    to: '/admin/users'
  },
  {
    title: t('admin.sections.customDomains.title'),
    description: t('admin.sections.customDomains.description'),
    badge: t('admin.sections.customDomains.badge'),
    category: t('admin.sections.customDomains.category'),
    icon: 'mdi:earth',
    to: '/admin/tenants?tab=domains'
  }
]
</script>