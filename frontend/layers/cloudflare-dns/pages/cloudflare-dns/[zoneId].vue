<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <p class="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">Cloudflare</p>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-3">
          <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
            <span v-if="zonePending" class="inline-flex items-center gap-2 text-base text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              Laddar zon...
            </span>
            <span v-else>{{ zoneData?.zone?.name ?? '—' }}</span>
          </h1>
          <NuxtLink
            to="/cloudflare-dns"
            class="inline-flex items-center gap-1 text-sm text-brand hover:underline"
          >
            <Icon icon="mdi:arrow-left" class="h-4 w-4" />
            Tillbaka
          </NuxtLink>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          <template v-if="zonePending">
            <span class="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
              Hämtar status...
            </span>
          </template>
          <template v-else>
            Status: {{ zoneData?.zone?.status ?? 'okänd' }} · Plan: {{ zoneData?.zone?.plan ?? 'okänd' }}
          </template>
        </p>
        <div class="flex items-center gap-2">
          <span class="mod-cloudflare-dns-badge">
            <Icon icon="mdi:shield-check-outline" class="h-4 w-4" />
            <template v-if="zonePending">
              <Icon icon="mdi:loading" class="h-4 w-4 animate-spin" />
            </template>
            <template v-else>
              {{ zoneData?.access?.zoneRole ?? 'inherit' }}
            </template>
          </span>
        </div>
      </div>
    </header>

    <CloudflareZoneRecordsTable
      v-if="zoneId && recordsData?.records"
      :zone-id="zoneId"
      :records="recordsData.records"
      :can-edit="recordsData.access?.canEditRecords ?? false"
      @refresh="refreshRecords"
    />

    <CloudflareAclEditor
      v-if="zoneId && zoneData?.access?.canManageAcls"
      :zone-id="zoneId"
      :entries="aclData?.entries ?? []"
      :can-manage="true"
      @refreshed="refreshAcl"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CloudflareZoneRecordsTable from '@cloudflare-dns/components/CloudflareZoneRecordsTable.vue'
import CloudflareAclEditor from '@cloudflare-dns/components/CloudflareAclEditor.vue'

const route = useRoute()
const zoneId = computed(() => route.params.zoneId as string)

const { data: zoneData, refresh: refreshZone, pending: zonePending } = useAsyncData(
  () => $fetch(`/api/dns/cloudflare/zones/${zoneId.value}`),
  { watch: [zoneId] }
)

const { data: recordsData, refresh: refreshRecords } = useAsyncData(
  () => $fetch(`/api/dns/cloudflare/zones/${zoneId.value}/records`),
  { watch: [zoneId] }
)

const { data: aclData, refresh: refreshAcl } = useAsyncData(
  () =>
    zoneData.value?.access?.canManageAcls
      ? $fetch(`/api/dns/cloudflare/zones/${zoneId.value}/acl`)
      : Promise.resolve({ entries: [] }),
  {
    watch: [zoneData, zoneId],
    key: computed(() => `cloudflare-acl-${zoneId.value}`)
  }
)

watch(zoneData, async (value) => {
  if (value?.access?.canManageAcls) {
    await refreshAcl()
  }
})

const refreshAll = async () => {
  await Promise.all([refreshZone(), refreshRecords(), refreshAcl()])
}

onMounted(() => {
  void refreshAll()
})
</script>


