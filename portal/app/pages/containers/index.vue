<template>
  <section class="space-y-8">
    <header>
      <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Incus</p>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Containers</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">Starta, stoppa och övervaka containrar per projekt/organisation.</p>
    </header>

    <div class="rounded-3xl border border-slate-100 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-900/70">
      <div class="flex flex-wrap items-center gap-3">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Projekt
          <select
            v-model="containerStore.selectedProjectId"
            class="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option v-for="project in containerStore.projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </label>
        <StatusPill variant="info">Containers: {{ containerStore.filteredContainers.length }}</StatusPill>
      </div>

      <div class="mt-6 grid gap-4 sm:grid-cols-2">
        <article
          v-for="container in containerStore.filteredContainers"
          :key="container.id"
          class="rounded-2xl border border-slate-100 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ container.image }}</p>
              <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{{ container.name }}</h3>
            </div>
            <StatusPill :variant="container.status === 'RUNNING' ? 'success' : 'warning'" dot>
              {{ container.status }}
            </StatusPill>
          </div>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {{ container.cpu }} vCPU · {{ container.memory }} RAM
          </p>
          <div class="mt-4 flex gap-2 text-sm">
            <button class="rounded-full border border-slate-200 px-4 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="containerStore.requestAction(container.id, 'start')">
              Starta
            </button>
            <button class="rounded-full border border-slate-200 px-4 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="containerStore.requestAction(container.id, 'stop')">
              Stoppa
            </button>
            <button class="rounded-full border border-slate-200 px-4 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="containerStore.requestAction(container.id, 'restart')">
              Starta om
            </button>
          </div>
        </article>
        <p v-if="!containerStore.filteredContainers.length" class="text-sm text-slate-500 dark:text-slate-400">
          Inga containrar för projektet ännu.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useContainerStore } from '~/stores/containers'

const containerStore = useContainerStore()

onMounted(() => {
  containerStore.bootstrap()
})
</script>

