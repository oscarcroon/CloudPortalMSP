<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Plugin template</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">Example Module</h1>
        <p class="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          Bygg UI med core Tailwind-klasser. Lägg till modul-specifika justeringar med prefixade
          utilities vid behov.
        </p>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <Icon icon="mdi:play-circle-outline" class="h-4 w-4" />
          Primary action
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <Icon icon="mdi:file-document-outline" class="h-4 w-4" />
          Secondary
        </button>
      </div>
    </header>

    <section class="mod-example-module-panel space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Core layout</p>
          <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">Start building fast</h2>
        </div>
        <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Icon icon="mdi:shield-check-outline" class="h-4 w-4 text-brand" />
          <span>Uses only core Tailwind + prefixed utilities</span>
        </div>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Den här sektionen visar hur du kombinerar core-klasser för paneler/kort och kompletterar med
        en modul-prefixad utility (`mod-example-module-panel`) för återanvändbar layout.
      </p>
      <div class="grid gap-4 md:grid-cols-2">
        <ExampleModuleCard
          v-for="card in cards"
          :key="card.title"
          :title="card.title"
          :badge="card.badge"
          :icon="card.icon"
          :tags="card.tags"
        >
          {{ card.description }}
        </ExampleModuleCard>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import ExampleModuleCard from '@example-module/components/ExampleModuleCard.vue'

const cards = [
  {
    title: 'Use core layout primitives',
    badge: 'Layout',
    description: 'Stack blocks with flex/grid, gap, padding och brand-färg för accent.',
    icon: 'mdi:view-dashboard-outline',
    tags: ['flex/grid', 'gap-4', 'rounded-2xl']
  },
  {
    title: 'Add scoped utilities',
    badge: 'Utilities',
    description: 'Om du behöver dela styling, lägg till en prefixad utility i @layer components.',
    icon: 'mdi:hammer-wrench',
    tags: ['mod-example-module-*', '@layer components', 'scoped styles']
  }
]
</script>


