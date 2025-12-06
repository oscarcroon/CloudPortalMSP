<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Zoner</p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">Cloudflare-zoner</h2>
      </div>
      <form
        v-if="moduleRights?.canManageZones"
        class="flex flex-col gap-2 md:flex-row md:items-center"
        @submit.prevent="createZone"
      >
        <input
          v-model="zoneName"
          class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          type="text"
          name="zoneName"
          placeholder="example.com"
          required
        />
        <button
          type="submit"
          :disabled="creating || !zoneName"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa zon
        </button>
      </form>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">Laddar zoner...</div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-[1px] dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ zone.name }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ zone.plan ?? 'Plan okänd' }} · {{ zone.status ?? 'status okänd' }}
            </p>
          </div>
          <span
            class="mod-cloudflare-dns-badge"
            :class="zone.aclRestricted ? 'border-amber-200 text-amber-700 dark:border-amber-700' : ''"
          >
            <Icon icon="mdi:shield-check-outline" class="h-4 w-4" />
            {{ zone.effectiveRole ?? 'module' }}
          </span>
        </div>

        <div class="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{{ zone.recordCount ?? '–' }} records</span>
          <div class="flex gap-2">
            <NuxtLink
              :to="`/cloudflare-dns/${zone.id}`"
              class="inline-flex items-center gap-1 text-brand hover:underline"
            >
              Visa
              <Icon icon="mdi:arrow-right" class="h-4 w-4" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  zones: any[]
  moduleRights: {
    canManageZones: boolean
  }
  loading?: boolean
}>()

const emit = defineEmits<{ refresh: [] }>()

const zoneName = ref('')
const creating = ref(false)

const createZone = async () => {
  if (!zoneName.value) return
  creating.value = true
  try {
    await $fetch('/api/dns/cloudflare/zones', {
      method: 'POST',
      body: { name: zoneName.value }
    })
    zoneName.value = ''
    emit('refresh')
  } catch (error) {
    console.error('[cloudflare-dns] kunde inte skapa zon', error)
  } finally {
    creating.value = false
  }
}
</script>


