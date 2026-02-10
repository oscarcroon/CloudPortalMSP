<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ t('cloudflareDns.zoneList.label') }}
        </p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
          {{ t('cloudflareDns.zoneList.title') }}
        </h2>
      </div>
      <div v-if="moduleRights?.canManageZones" class="flex flex-col gap-2 md:flex-row md:items-center">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          @click="showOnboard = true"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          {{ t('cloudflareDns.zoneList.create') }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
      {{ t('cloudflareDns.zoneList.loading') }}
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <NuxtLink
        v-for="zone in zones"
        :key="zone.id"
        :to="`/cloudflare-dns/${zone.id}`"
        class="group rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm transition hover:-translate-y-[1px] dark:border-slate-700 dark:bg-slate-900"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-lg font-medium text-slate-900 dark:text-slate-50">{{ zone.name }}</p>
            <p
              class="text-xs"
              :class="isPending(zone.status) ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'"
            >
              {{ zone.plan ?? t('cloudflareDns.zoneList.planUnknown') }} ·
              {{ zone.status ?? t('cloudflareDns.zoneList.statusUnknown') }}
            </p>
          </div>
        </div>

        <div class="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{{ t('cloudflareDns.zoneList.recordCount', { count: zone.recordCount ?? '–' }) }}</span>
          <button
            v-if="moduleRights?.canExport"
            type="button"
            class="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 opacity-0 transition hover:border-brand hover:text-brand group-hover:opacity-100 dark:border-slate-700 dark:text-slate-400"
            :title="t('cloudflareDns.zoneList.export')"
            @click.stop.prevent="$emit('exportZone', zone.id, zone.name)"
          >
            <Icon icon="mdi:download" class="h-3.5 w-3.5" />
          </button>
        </div>
      </NuxtLink>
    </div>

    <!-- Onboard modal -->
    <Teleport to="body">
      <div
        v-if="showOnboard"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <header class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {{ t('cloudflareDns.zoneList.onboard.label') }}
              </p>
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
                {{ t('cloudflareDns.zoneList.onboard.title') }}
              </h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                {{ t('cloudflareDns.zoneList.onboard.subtitle') }}
              </p>
            </div>
            <button class="btn-secondary" type="button" @click="closeOnboard">
              {{ t('common.cancel') }}
            </button>
          </header>

          <div class="space-y-3">
            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">
                {{ t('cloudflareDns.zoneList.onboard.domainLabel') }}
              </label>
              <input
                v-model="zoneName"
                class="input border-2 border-brand/30 bg-white dark:bg-slate-900 focus:border-brand focus:ring-2 focus:ring-brand/30"
                type="text"
                name="zoneName"
                :placeholder="t('cloudflareDns.zoneList.onboard.domainPlaceholder')"
                required
              />
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
              <ul class="list-disc space-y-1 pl-5">
                <li>{{ t('cloudflareDns.zoneList.onboard.bullet1') }}</li>
                <li>{{ t('cloudflareDns.zoneList.onboard.bullet2') }}</li>
                <li>
                  {{ t('cloudflareDns.zoneList.onboard.bullet3.prefix') }}
                  <span class="font-semibold text-amber-600">{{ t('cloudflareDns.zoneList.onboard.bullet3.pending') }}</span>
                  {{ t('cloudflareDns.zoneList.onboard.bullet3.suffix') }}
                </li>
              </ul>
            </div>

            <div
              v-if="createdNameServers.length"
              class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <p class="font-semibold mb-2">
                {{ t('cloudflareDns.zoneList.onboard.createdTitle') }}
                <span v-if="createdZoneName" class="font-mono text-xs text-amber-700 dark:text-amber-100">({{ createdZoneName }})</span>
              </p>
              <p class="text-xs mb-2">
                {{ t('cloudflareDns.zoneList.onboard.createdHint') }}
              </p>
              <ul class="list-disc pl-5 space-y-1">
                <li v-for="ns in createdNameServers" :key="ns" class="font-mono text-sm">{{ ns }}</li>
              </ul>
            </div>

            <div class="flex justify-end gap-2">
              <button class="btn-secondary" type="button" @click="closeOnboard">
                {{ t('common.cancel') }}
              </button>
              <button
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                :disabled="creating || !zoneName"
                @click="createZone"
              >
                <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
                {{ t('cloudflareDns.zoneList.onboard.createAndShow') }}
              </button>
              <button
                v-if="createdZoneId"
                class="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                type="button"
                @click="goToCreatedZone"
              >
                <Icon icon="mdi:arrow-right" class="h-4 w-4" />
                {{ t('cloudflareDns.zoneList.onboard.openZone') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from '#imports'

const props = defineProps<{
  zones: any[]
  moduleRights: {
    canManageZones: boolean
    canExport?: boolean
  }
  loading?: boolean
}>()

const emit = defineEmits<{ refresh: []; exportZone: [zoneId: string, zoneName: string] }>()

const { t } = useI18n()

const zoneName = ref('')
const creating = ref(false)
const showOnboard = ref(false)
const createdNameServers = ref<string[]>([])
const createdZoneId = ref<string | null>(null)
const createdZoneName = ref<string | null>(null)
const router = useRouter()

const closeOnboard = () => {
  showOnboard.value = false
  createdNameServers.value = []
  createdZoneId.value = null
  createdZoneName.value = null
}

const createZone = async () => {
  if (!zoneName.value) return
  creating.value = true
  try {
    const res = await ($fetch as any)('/api/dns/cloudflare/zones', {
      method: 'POST',
      body: { name: zoneName.value }
    }) as { zone?: { id?: string; name?: string; nameServers?: string[] } }
    createdNameServers.value = Array.isArray(res?.zone?.nameServers) ? res.zone?.nameServers ?? [] : []
    createdZoneId.value = res?.zone?.id ?? null
    createdZoneName.value = res?.zone?.name ?? null
    zoneName.value = ''
    emit('refresh')
    if (createdZoneId.value) {
      showOnboard.value = false
      await router.push(`/cloudflare-dns/${createdZoneId.value}`)
      createdNameServers.value = []
      createdZoneId.value = null
      createdZoneName.value = null
    }
  } catch (error) {
    console.error('[cloudflare-dns] kunde inte skapa zon', error)
  } finally {
    creating.value = false
  }
}

const isPending = (status?: string | null) => {
  if (!status) return false
  return status.toLowerCase().includes('pending')
}

const goToCreatedZone = () => {
  if (createdZoneId.value) {
    showOnboard.value = false
    void router.push(`/cloudflare-dns/${createdZoneId.value}`)
    createdNameServers.value = []
    createdZoneId.value = null
    createdZoneName.value = null
  }
}
</script>


