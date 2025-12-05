<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">ESXi / Morpheus</p>
        <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-100">Virtuella maskiner</h1>
      </div>
      <div class="flex gap-3">
        <select
          v-model="vmStore.filter.powerState"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">Alla lägen</option>
          <option value="poweredOn">Påslagen</option>
          <option value="poweredOff">Avstängd</option>
        </select>
        <button class="rounded-full border border-brand px-4 py-2 text-sm text-brand transition hover:bg-brand/10 dark:border-brand/70 dark:text-brand-light" @click="vmStore.refresh">
          Uppdatera
        </button>
      </div>
    </header>

    <div class="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900/70">
      <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <tr>
            <th class="px-4 py-3 text-left">Namn</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Resurser</th>
            <th class="px-4 py-3 text-left">Plattform</th>
            <th class="px-4 py-3 text-right">Åtgärder</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-100">
          <tr v-for="vm in vmStore.filteredVms" :key="vm.id">
            <td class="px-4 py-3 font-semibold">{{ vm.name }}</td>
            <td class="px-4 py-3">
              <StatusPill :variant="vm.powerState === 'poweredOn' ? 'success' : 'warning'" dot>
                {{ vm.powerState }}
              </StatusPill>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
              {{ vm.cpu }} vCPU · {{ vm.memory }} RAM · {{ vm.disk }} SSD
            </td>
            <td class="px-4 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {{ vm.platform }}
            </td>
            <td class="px-4 py-3 text-right text-xs">
              <div class="inline-flex gap-2">
                <button class="rounded-full border border-slate-200 px-3 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="vmStore.power(vm.id, 'start')">Starta</button>
                <button class="rounded-full border border-slate-200 px-3 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="vmStore.power(vm.id, 'stop')">Stoppa</button>
                <button class="rounded-full border border-slate-200 px-3 py-1 transition dark:border-slate-600 dark:text-slate-200" @click="vmStore.power(vm.id, 'reboot')">Starta om</button>
              </div>
            </td>
          </tr>
          <tr v-if="!vmStore.filteredVms.length">
            <td colspan="5" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Inga maskiner matchar filtret.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import StatusPill from '~/components/shared/StatusPill.vue'
import { useVmStore } from '~/stores/vms'

const vmStore = useVmStore()

onMounted(() => {
  vmStore.bootstrap()
})
</script>

