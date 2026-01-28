<template>
  <section class="space-y-6">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Managed server</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Serveröversikt</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Samlad status för managed servrar.</p>
    </header>

    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Den här sidan fungerar som placeholder för framtida funktioner där managed servrar kan övervakas.
      </p>
      <ul class="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
        <li v-for="item in checklist" :key="item" class="flex items-center gap-2">
          <span aria-hidden="true">⏳</span>
          {{ item }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
const checklist = [
  'Visa NOC status för respektive server',
  'Uppgradera/patcha operativsystem',
  'Integrera backuptjänst',
  'Logga konfigurationsändringar'
]
</script>

