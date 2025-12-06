<template>
  <section class="mod-cloudflare-dns-panel space-y-4">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Zoner</p>
        <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">Cloudflare-zoner</h2>
      </div>
      <div v-if="moduleRights?.canManageZones" class="flex flex-col gap-2 md:flex-row md:items-center">
        <button
          type="button"
          class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
          @click="showOnboard = true"
        >
          <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
          Skapa ny DNS zon
        </button>
      </div>
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
            <p
              class="text-xs"
              :class="isPending(zone.status) ? 'text-amber-600 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'"
            >
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

    <!-- Onboard modal -->
    <Teleport to="body">
      <div
        v-if="showOnboard"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6"
      >
        <div class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <header class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Onboarding</p>
              <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">Skapa ny DNS zon</h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                Vi guidar dig genom att lägga till domänen. Peka namnservrar hos din registrar, propagation kan ta upp
                till 24 timmar.
              </p>
            </div>
            <button class="btn-secondary" type="button" @click="closeOnboard">Stäng</button>
          </header>

          <div class="space-y-3">
            <div class="grid gap-2">
              <label class="text-xs font-medium text-slate-600 dark:text-slate-300">Domän</label>
              <input
                v-model="zoneName"
                class="input border-2 border-brand/30 bg-white dark:bg-slate-900 focus:border-brand focus:ring-2 focus:ring-brand/30"
                type="text"
                name="zoneName"
                placeholder="example.com"
                required
              />
            </div>

            <div class="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
              <ul class="list-disc space-y-1 pl-5">
                <li>Ändra namnservrar hos din domänregistrar till de Cloudflare ger (visas efter skapandet).</li>
                <li>Propagation kan ta upp till 24 timmar efter namnbyte.</li>
                <li>Du ser status som <span class="font-semibold text-amber-600">pending</span> på översikten tills DNS är aktivt.</li>
              </ul>
            </div>

            <div
              v-if="createdNameServers.length"
              class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-600 dark:bg-amber-500/10 dark:text-amber-100"
            >
              <p class="font-semibold mb-2">
                Zon skapad
                <span v-if="createdZoneName" class="font-mono text-xs text-amber-700 dark:text-amber-100">({{ createdZoneName }})</span>
              </p>
              <p class="text-xs mb-2">Använd dessa namnservrar hos din registrar:</p>
              <ul class="list-disc pl-5 space-y-1">
                <li v-for="ns in createdNameServers" :key="ns" class="font-mono text-sm">{{ ns }}</li>
              </ul>
            </div>

            <div class="flex justify-end gap-2">
              <button class="btn-secondary" type="button" @click="closeOnboard">Stäng</button>
              <button
                class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                :disabled="creating || !zoneName"
                @click="createZone"
              >
                <Icon icon="mdi:plus-circle-outline" class="h-4 w-4" />
                Skapa och visa namnservrar
              </button>
              <button
                v-if="createdZoneId"
                class="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/60"
                type="button"
                @click="goToCreatedZone"
              >
                <Icon icon="mdi:arrow-right" class="h-4 w-4" />
                Öppna zonen
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
    const res = await $fetch<{ zone?: { id?: string; name?: string; nameServers?: string[] } }>('/api/dns/cloudflare/zones', {
      method: 'POST',
      body: { name: zoneName.value }
    })
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


