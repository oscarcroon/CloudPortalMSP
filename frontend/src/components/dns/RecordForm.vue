<template>
  <form class="rounded-2xl border border-dashed border-brand/40 bg-white p-4 shadow-sm dark:border-brand/30 dark:bg-slate-900/60" @submit.prevent="submit">
    <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Skapa DNS-post</h4>
    <div class="mt-3 grid gap-4 md:grid-cols-2">
      <label class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Typ
        <select
          v-model="form.type"
          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="A">A</option>
          <option value="AAAA">AAAA</option>
          <option value="CNAME">CNAME</option>
          <option value="TXT">TXT</option>
        </select>
      </label>
      <label class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Namn
        <input
          v-model="form.name"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          required
        />
      </label>
      <label class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 md:col-span-2">
        Innehåll
        <input
          v-model="form.content"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          required
        />
      </label>
      <label class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        TTL (sekunder)
        <input
          v-model.number="form.ttl"
          type="number"
          min="60"
          class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      <label class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <input v-model="form.proxied" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-brand focus:ring-brand" />
        Proxy via Cloudflare
      </label>
    </div>

    <button type="submit" class="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      Spara
    </button>
  </form>
</template>

<script setup lang="ts">
import type { CreateDnsRecordPayload } from '~/types/dns'

const emit = defineEmits<{
  submit: [payload: CreateDnsRecordPayload]
}>()

const form = reactive<CreateDnsRecordPayload>({
  type: 'A',
  name: '',
  content: '',
  ttl: 300,
  proxied: true
})

function submit() {
  emit('submit', { ...form })
}
</script>

