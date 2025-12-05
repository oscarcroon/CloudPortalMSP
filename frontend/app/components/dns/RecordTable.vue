<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900/60">
    <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
      <thead class="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">
        <tr>
          <th class="px-4 py-3">Typ</th>
          <th class="px-4 py-3">Namn</th>
          <th class="px-4 py-3">Innehåll</th>
          <th class="px-4 py-3 text-right">TTL</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white text-slate-700 dark:divide-slate-800 dark:bg-slate-900/60 dark:text-slate-100">
        <tr v-for="record in records" :key="record.id">
          <td class="px-4 py-3 font-semibold">{{ record.type }}</td>
          <td class="px-4 py-3">{{ record.name }}</td>
          <td class="px-4 py-3">{{ record.content }}</td>
          <td class="px-4 py-3 text-right">{{ record.ttl }} s</td>
        </tr>
        <tr v-if="!records.length">
          <td colspan="4" class="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
            Inga DNS-poster hittades.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { DnsRecord } from '~/types/dns'

defineProps<{
  records: DnsRecord[]
}>()
</script>

