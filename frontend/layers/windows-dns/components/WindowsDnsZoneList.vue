<template>
  <div class="space-y-3">
    <div
      v-for="zone in zones"
      :key="zone.id"
      class="mod-windows-dns-zone-card group"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Icon icon="mdi:dns" class="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <NuxtLink
              :to="`/windows-dns/${zone.id}`"
              class="font-medium text-slate-900 hover:text-brand dark:text-slate-50"
            >
              {{ zone.zoneName }}
            </NuxtLink>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ zone.serverName }} &middot; {{ zone.zoneType }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span v-if="zone.owned" class="mod-windows-dns-badge-owned">
            <Icon icon="mdi:check-circle" class="h-3 w-3" />
            Owned
          </span>
          <span v-else-if="zone.claimable" class="mod-windows-dns-badge-claimable">
            <Icon icon="mdi:hand-pointing-right" class="h-3 w-3" />
            Claimable
          </span>

          <NuxtLink
            :to="`/windows-dns/${zone.id}`"
            class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 opacity-0 transition group-hover:opacity-100 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
          >
            <Icon icon="mdi:dns-outline" class="h-3.5 w-3.5" />
            Records
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

type Zone = {
  id: string
  zoneName: string
  serverId: string
  serverName: string
  zoneType: string
  owned: boolean
  claimable: boolean
}

defineProps<{
  zones: Zone[]
  loading?: boolean
}>()
</script>

