<template>
  <section class="space-y-6">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">WordPress</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Webbplatser</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Status, versioner och senaste backup för varje sajt.</p>
    </header>

    <div class="grid gap-4 lg:grid-cols-2">
      <article
        v-for="site in wpStore.sites"
        :key="site.id"
        class="rounded-2xl border border-slate-100 bg-white p-5 shadow-card dark:border-slate-700 dark:bg-slate-900/70"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{{ site.name }}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">{{ site.domain }}</p>
          </div>
          <StatusPill :variant="site.status === 'healthy' ? 'success' : 'warning'" dot>
            {{ site.status }}
          </StatusPill>
        </div>
        <dl class="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
          <div class="flex justify-between">
            <dt>Version</dt>
            <dd class="font-medium">{{ site.version }}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Senaste backup</dt>
            <dd class="font-medium">{{ site.lastBackup }}</dd>
          </div>
          <div class="flex justify-between">
            <dt>Region</dt>
            <dd class="font-medium">{{ site.region }}</dd>
          </div>
        </dl>
        <div class="mt-4 flex flex-wrap gap-2 text-xs">
          <button class="rounded-full border border-slate-200 px-3 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="wpStore.trigger(site.id, 'deploy')">
            Deploy
          </button>
          <button class="rounded-full border border-slate-200 px-3 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="wpStore.trigger(site.id, 'backup')">
            Backup
          </button>
          <button class="rounded-full border border-slate-200 px-3 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="wpStore.trigger(site.id, 'update')">
            Uppdatera
          </button>
        </div>
      </article>
      <p v-if="!wpStore.sites.length" class="text-sm text-slate-500 dark:text-slate-400">Inga sajter kopplade än.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useWordpressStore } from '~/stores/wordpress'

const wpStore = useWordpressStore()

onMounted(() => {
  wpStore.bootstrap()
})
</script>

