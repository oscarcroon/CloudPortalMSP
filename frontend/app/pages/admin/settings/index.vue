<template>
  <section class="space-y-8">
    <header class="space-y-2">
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Superadmin</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-white">Superadmin-inställningar</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Samlad startsida för alla verktyg som kräver superadmintillgång.
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
            Öppna
            <Icon icon="mdi:open-in-new" class="h-4 w-4" />
          </NuxtLink>
        </div>
      </article>
    </div>

    <div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
      <p class="font-semibold">Snabbtips</p>
      <p class="mt-1">
        Bokmärk den här sidan – nya superadminverktyg läggs alltid till här först.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

definePageMeta({
  layout: 'default',
  superAdmin: true
})

const adminSections = [
  {
    title: 'Tenants',
    description: 'Hantera distributörer och leverantörer, skapa nya tenants och administrera arv.',
    badge: 'Struktur',
    category: 'Multitenancy',
    icon: 'mdi:account-group',
    to: '/admin/tenants'
  },
  {
    title: 'Organisationer',
    description: 'Överblicka organisationer, medlemskap och deras autentisering.',
    badge: 'Kunder',
    category: 'Organisationer',
    icon: 'mdi:office-building',
    to: '/admin/organizations'
  },
  {
    title: 'Global branding',
    description: 'Sätt portalens standardlogotyper, accentfärger och login-branding.',
    badge: 'Branding',
    category: 'Design',
    icon: 'mdi:palette-outline',
    to: '/admin/branding'
  },
  {
    title: 'RBAC-matris',
    description: 'Granska roller, modulrättigheter och gör justeringar på en central plats.',
    badge: 'Säkerhet',
    category: 'Behörigheter',
    icon: 'mdi:shield-key',
    to: '/admin/rbac-matrix'
  },
  {
    title: 'Audit-loggar',
    description: 'Inspektera kritiska händelser, loginförsök och administrativa spår.',
    badge: 'Revision',
    category: 'Loggar',
    icon: 'mdi:file-search-outline',
    to: '/admin/audit-logs'
  },
  {
    title: 'Admin-email',
    description: 'Konfigurera portalens globala e-postprofiler och testutskick.',
    badge: 'Kommunikation',
    category: 'E-post',
    icon: 'mdi:email-send-outline',
    to: '/admin/settings/email'
  },
  {
    title: 'Superadmin-användare',
    description: 'Visa och uppdatera superadminkonton, status och lösenordsreset.',
    badge: 'Identitet',
    category: 'Användare',
    icon: 'mdi:shield-crown',
    to: '/admin/users'
  },
  {
    title: 'Custom domains',
    description: 'Verifiera tenant-domäner och följ upp DNS-status för CNAME-konfigurationer.',
    badge: 'Routing',
    category: 'Domäner',
    icon: 'mdi:earth',
    to: '/admin/tenants?tab=domains'
  }
]
</script>