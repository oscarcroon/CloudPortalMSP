<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 lg:px-0">
    <header class="flex flex-col gap-2">
      <NuxtLink to="/certificates/orders" class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-brand dark:text-slate-400">
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ $t('certificates.orders.title') }}
      </NuxtLink>
      <h1 class="text-3xl font-semibold text-slate-900 dark:text-slate-50">
        {{ $t('certificates.orders.wizard.title') }}
      </h1>
    </header>

    <!-- Step indicator -->
    <div class="flex items-center gap-2">
      <button
        v-for="(label, i) in stepLabels"
        :key="i"
        class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition"
        :class="i === step ? 'bg-brand text-white' : i < step ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'"
        @click="i < step ? step = i : null"
      >
        <span class="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
          :class="i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-white/20' : ''">
          <Icon v-if="i < step" icon="mdi:check" class="h-3 w-3" />
          <span v-else>{{ i + 1 }}</span>
        </span>
        {{ label }}
      </button>
    </div>

    <!-- Step 1: Credential Set -->
    <section v-if="step === 0" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.step1') }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.selectCredentialSet') }}</p>
      <div v-if="credentialSets.length === 0" class="text-sm text-slate-500">No credential sets available. <NuxtLink to="/certificates/credential-sets" class="text-brand hover:underline">Add one</NuxtLink>.</div>
      <div v-else class="space-y-2">
        <label
          v-for="cs in credentialSets"
          :key="cs.id"
          class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition"
          :class="form.credentialSetId === cs.id ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 hover:border-brand/50'"
        >
          <input v-model="form.credentialSetId" type="radio" :value="cs.id" class="accent-brand" />
          <div>
            <p class="font-medium text-slate-900 dark:text-slate-50">{{ cs.name }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ cs.provider }} · {{ cs.acmeDirectoryUrl }}</p>
          </div>
        </label>
      </div>
    </section>

    <!-- Step 2: Agent -->
    <section v-if="step === 1" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.step2') }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.selectAgent') }}</p>
      <div v-if="agents.length === 0" class="text-sm text-slate-500">No agents available. <NuxtLink to="/certificates/agents" class="text-brand hover:underline">Register one</NuxtLink>.</div>
      <div v-else class="space-y-2">
        <label
          v-for="agent in agents"
          :key="agent.id"
          class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition"
          :class="form.agentId === agent.id ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 hover:border-brand/50'"
        >
          <input v-model="form.agentId" type="radio" :value="agent.id" class="accent-brand" />
          <div>
            <p class="font-medium text-slate-900 dark:text-slate-50">{{ agent.name }}</p>
            <div class="flex flex-wrap gap-1 mt-1">
              <span v-for="cap in agent.capabilities?.supports" :key="cap" class="mod-certificates-badge">{{ cap }}</span>
            </div>
          </div>
        </label>
      </div>
    </section>

    <!-- Step 3: Domains -->
    <section v-if="step === 2" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.step3') }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.enterDomains') }}</p>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.primaryDomain') }}</label>
        <input v-model="form.primaryDomain" type="text" required placeholder="example.com" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.sans') }}</label>
        <div v-for="(san, i) in form.sans" :key="i" class="flex items-center gap-2">
          <input v-model="form.sans[i]" type="text" placeholder="www.example.com" class="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
          <button type="button" class="text-red-500 hover:text-red-700" @click="form.sans.splice(i, 1)">
            <Icon icon="mdi:close" class="h-4 w-4" />
          </button>
        </div>
        <button type="button" class="self-start text-sm text-brand hover:underline" @click="form.sans.push('')">
          + {{ $t('certificates.orders.wizard.addSan') }}
        </button>
      </div>
    </section>

    <!-- Step 4: Validation -->
    <section v-if="step === 3" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.step4') }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.selectValidation') }}</p>
      <div class="space-y-2">
        <label
          v-for="method in validationMethods"
          :key="method.value"
          class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition"
          :class="form.validationMethod === method.value ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 hover:border-brand/50'"
        >
          <input v-model="form.validationMethod" type="radio" :value="method.value" class="accent-brand" :disabled="method.disabled" />
          <div>
            <p class="font-medium text-slate-900 dark:text-slate-50" :class="{ 'opacity-50': method.disabled }">{{ method.label }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">{{ method.description }}</p>
          </div>
        </label>
      </div>

      <!-- DNS Provider / Zone selection (only when dns-01 is selected) -->
      <template v-if="form.validationMethod === 'dns-01'">
        <hr class="border-slate-200 dark:border-slate-700" />
        <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.dnsProvider') }}</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ $t('certificates.orders.wizard.selectDnsProvider') }}</p>

        <div class="space-y-2">
          <!-- Manual option (always available) -->
          <label
            class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition"
            :class="form.dnsProvider === 'manual' ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 hover:border-brand/50'"
          >
            <input v-model="form.dnsProvider" type="radio" value="manual" class="accent-brand" />
            <div>
              <p class="font-medium text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.dnsProviderManual') }}</p>
            </div>
          </label>

          <!-- Portal-managed zones grouped by provider -->
          <template v-for="providerGroup in dnsProviderGroups" :key="providerGroup.key">
            <div v-if="providerGroup.status === 'not_configured'" class="rounded-lg border border-slate-200 p-3 opacity-60 dark:border-slate-700">
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ providerGroup.label }}</p>
              <p class="text-xs text-slate-400 dark:text-slate-500">{{ providerGroup.message || $t('certificates.orders.wizard.dnsNotConfigured') }}</p>
            </div>
            <template v-else>
              <div v-for="zone in providerGroup.zones" :key="`${providerGroup.key}-${zone.id}`">
                <label
                  class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition"
                  :class="form.dnsProvider === providerGroup.key && form.dnsZoneId === zone.id ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 hover:border-brand/50'"
                >
                  <input
                    type="radio"
                    :checked="form.dnsProvider === providerGroup.key && form.dnsZoneId === zone.id"
                    class="accent-brand"
                    @change="selectDnsZone(providerGroup.key, zone.id, zone.name)"
                  />
                  <div>
                    <p class="font-medium text-slate-900 dark:text-slate-50">{{ zone.name }}</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">{{ providerGroup.label }} · {{ $t('certificates.orders.wizard.dnsAutoDesc') }}</p>
                  </div>
                </label>
              </div>
            </template>
          </template>
        </div>
      </template>
    </section>

    <!-- Step 5: Installation -->
    <section v-if="step === 4" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.step5') }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.selectInstallation') }}</p>
      <div class="space-y-2">
        <label
          v-for="target in installationTargets"
          :key="target.value"
          class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition"
          :class="form.installationTarget === target.value ? 'border-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 hover:border-brand/50'"
        >
          <input v-model="form.installationTarget" type="radio" :value="target.value" class="accent-brand" :disabled="target.disabled" />
          <div>
            <p class="font-medium text-slate-900 dark:text-slate-50" :class="{ 'opacity-50': target.disabled }">{{ target.label }}</p>
          </div>
        </label>
      </div>
      <div class="flex items-center gap-4 pt-2">
        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input v-model="form.autoRenew" type="checkbox" class="rounded border-slate-300" />
          {{ $t('certificates.orders.wizard.autoRenew') }}
        </label>
        <div class="flex items-center gap-2">
          <label class="text-xs text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.renewDaysBefore') }}:</label>
          <input v-model.number="form.renewDaysBefore" type="number" min="1" max="90" class="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50" />
        </div>
      </div>
    </section>

    <!-- Step 6: Review -->
    <section v-if="step === 5" class="mod-certificates-panel space-y-4">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.step6') }}</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300">{{ $t('certificates.orders.wizard.reviewOrder') }}</p>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt class="text-slate-500 dark:text-slate-400">Credential Set</dt>
        <dd class="font-medium text-slate-900 dark:text-slate-50">{{ selectedCredentialSet?.name }}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Agent</dt>
        <dd class="font-medium text-slate-900 dark:text-slate-50">{{ selectedAgent?.name }}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Primary Domain</dt>
        <dd class="font-medium text-slate-900 dark:text-slate-50">{{ form.primaryDomain }}</dd>
        <dt v-if="filteredSans.length" class="text-slate-500 dark:text-slate-400">SANs</dt>
        <dd v-if="filteredSans.length" class="font-medium text-slate-900 dark:text-slate-50">{{ filteredSans.join(', ') }}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Validation</dt>
        <dd class="font-medium text-slate-900 dark:text-slate-50">{{ form.validationMethod }}</dd>
        <template v-if="form.validationMethod === 'dns-01' && form.dnsProvider !== 'manual'">
          <dt class="text-slate-500 dark:text-slate-400">{{ $t('certificates.orders.wizard.dnsProvider') }}</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ selectedDnsProviderLabel }}</dd>
          <dt class="text-slate-500 dark:text-slate-400">{{ $t('certificates.orders.wizard.dnsZone') }}</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ form.dnsZoneName }}</dd>
        </template>
        <template v-else-if="form.validationMethod === 'dns-01'">
          <dt class="text-slate-500 dark:text-slate-400">{{ $t('certificates.orders.wizard.dnsProvider') }}</dt>
          <dd class="font-medium text-slate-900 dark:text-slate-50">{{ $t('certificates.orders.wizard.dnsProviderManual') }}</dd>
        </template>
        <dt class="text-slate-500 dark:text-slate-400">Installation</dt>
        <dd class="font-medium text-slate-900 dark:text-slate-50">{{ form.installationTarget }}</dd>
        <dt class="text-slate-500 dark:text-slate-400">Auto-Renew</dt>
        <dd class="font-medium text-slate-900 dark:text-slate-50">{{ form.autoRenew ? `Yes (${form.renewDaysBefore}d before)` : 'No' }}</dd>
      </dl>
    </section>

    <p v-if="submitError" class="text-sm text-red-600 dark:text-red-400">{{ submitError }}</p>

    <!-- Navigation -->
    <div class="flex items-center justify-between">
      <button
        v-if="step > 0"
        class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-100"
        @click="step--"
      >
        <Icon icon="mdi:arrow-left" class="h-4 w-4" />
        {{ $t('certificates.common.back') }}
      </button>
      <div v-else />
      <button
        v-if="step < 5"
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        :disabled="!canProceed"
        @click="step++"
      >
        {{ $t('certificates.common.next') }}
        <Icon icon="mdi:arrow-right" class="h-4 w-4" />
      </button>
      <button
        v-else
        class="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        :disabled="submitting"
        @click="submitOrder"
      >
        <Icon v-if="submitting" icon="mdi:loading" class="h-4 w-4 animate-spin" />
        {{ submitting ? $t('certificates.orders.wizard.submitting') : $t('certificates.orders.wizard.submit') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const router = useRouter()

const step = ref(0)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const credentialSets = ref<any[]>([])
const agents = ref<any[]>([])
const dnsZonesData = ref<{ zones: any[]; providers: any[] }>({ zones: [], providers: [] })

const form = reactive({
  credentialSetId: '',
  agentId: '',
  primaryDomain: '',
  sans: [] as string[],
  validationMethod: 'http-01',
  dnsProvider: 'manual',
  dnsZoneId: '',
  dnsZoneName: '',
  installationTarget: 'iis',
  autoRenew: true,
  renewDaysBefore: 30
})

const stepLabels = [
  'Credentials', 'Agent', 'Domains', 'Validation', 'Installation', 'Review'
]

const selectedCredentialSet = computed(() => credentialSets.value.find(cs => cs.id === form.credentialSetId))
const selectedAgent = computed(() => agents.value.find(a => a.id === form.agentId))
const agentCapabilities = computed(() => selectedAgent.value?.capabilities?.supports ?? [])
const filteredSans = computed(() => form.sans.filter(s => s.trim()))

const isWildcard = computed(() => form.primaryDomain.startsWith('*.') || form.sans.some(s => s.startsWith('*.')))

const validationMethods = computed(() => [
  {
    value: 'http-01',
    label: 'HTTP-01',
    description: 'Place a file on your web server for validation.',
    disabled: isWildcard.value
  },
  {
    value: 'dns-01',
    label: 'DNS-01',
    description: 'Add a TXT record to your DNS zone. Required for wildcards.',
    disabled: !agentCapabilities.value.includes('dns-01') && form.agentId !== ''
  }
])

const installationTargets = computed(() => [
  { value: 'iis', label: 'IIS', disabled: !agentCapabilities.value.includes('iis') && form.agentId !== '' },
  { value: 'pfx', label: 'PFX File', disabled: !agentCapabilities.value.includes('pfx') && form.agentId !== '' },
  { value: 'centralssl', label: 'IIS Central SSL', disabled: !agentCapabilities.value.includes('centralssl') && form.agentId !== '' },
  { value: 'manual', label: 'Manual', disabled: false }
])

// DNS provider groups for the zone selector UI
const dnsProviderGroups = computed(() => {
  const providers = dnsZonesData.value.providers
  const zones = dnsZonesData.value.zones

  return providers.map(p => ({
    key: p.key,
    label: p.label,
    status: p.status,
    message: p.message,
    zones: zones.filter(z => z.provider === p.key)
  }))
})

const selectedDnsProviderLabel = computed(() => {
  const provider = dnsZonesData.value.providers.find(p => p.key === form.dnsProvider)
  return provider?.label ?? form.dnsProvider
})

const canProceed = computed(() => {
  switch (step.value) {
    case 0: return !!form.credentialSetId
    case 1: return !!form.agentId
    case 2: return !!form.primaryDomain.trim()
    case 3:
      if (!form.validationMethod) return false
      // If dns-01, require a DNS provider selection
      if (form.validationMethod === 'dns-01') return !!form.dnsProvider
      return true
    case 4: return !!form.installationTarget
    default: return true
  }
})

function selectDnsZone(provider: string, zoneId: string, zoneName: string) {
  form.dnsProvider = provider
  form.dnsZoneId = zoneId
  form.dnsZoneName = zoneName
}

/**
 * Auto-select the best matching DNS zone by longest suffix match.
 * E.g. domain "www.sub.example.com" matches zone "sub.example.com" over "example.com".
 */
function autoSelectDnsZone() {
  const domain = form.primaryDomain.replace(/^\*\./, '').toLowerCase()
  if (!domain) return

  const zones = dnsZonesData.value.zones
  if (zones.length === 0) return

  let bestMatch: { provider: string; id: string; name: string } | null = null
  let bestLength = 0

  for (const z of zones) {
    const zoneName = z.name.toLowerCase()
    if (domain === zoneName || domain.endsWith(`.${zoneName}`)) {
      if (zoneName.length > bestLength) {
        bestLength = zoneName.length
        bestMatch = { provider: z.provider, id: z.id, name: z.name }
      }
    }
  }

  if (bestMatch) {
    form.dnsProvider = bestMatch.provider
    form.dnsZoneId = bestMatch.id
    form.dnsZoneName = bestMatch.name
  }
}

// Force DNS-01 for wildcards
watch(isWildcard, (val) => {
  if (val && form.validationMethod === 'http-01') {
    form.validationMethod = 'dns-01'
  }
})

// Pre-select default validation from credential set
watch(() => form.credentialSetId, (id) => {
  const cs = credentialSets.value.find(c => c.id === id)
  if (cs?.defaultValidationMethod) {
    form.validationMethod = cs.defaultValidationMethod
  }
})

// Reset DNS provider when switching away from dns-01
watch(() => form.validationMethod, (val) => {
  if (val !== 'dns-01') {
    form.dnsProvider = 'manual'
    form.dnsZoneId = ''
    form.dnsZoneName = ''
  }
})

// Auto-select zone when domains change and dns-01 is selected
watch([() => form.primaryDomain, () => form.validationMethod], () => {
  if (form.validationMethod === 'dns-01' && dnsZonesData.value.zones.length > 0) {
    autoSelectDnsZone()
  }
})

const submitOrder = async () => {
  submitting.value = true
  submitError.value = null
  try {
    const body: Record<string, any> = {
      credentialSetId: form.credentialSetId,
      agentId: form.agentId,
      primaryDomain: form.primaryDomain.trim(),
      subjectAlternativeNames: filteredSans.value,
      validationMethod: form.validationMethod,
      installationTarget: form.installationTarget,
      autoRenew: form.autoRenew,
      renewDaysBefore: form.renewDaysBefore
    }

    // Include validationMeta for dns-01 with provider info
    if (form.validationMethod === 'dns-01') {
      body.validationMeta = {
        dnsProvider: form.dnsProvider,
        zoneId: form.dnsZoneId || undefined,
        zoneName: form.dnsZoneName || undefined
      }
    }

    const res = await $fetch<any>('/api/certificates/orders', {
      method: 'POST',
      body
    })
    router.push(`/certificates/orders/${res.id}`)
  } catch (err: any) {
    submitError.value = err?.data?.message ?? 'Failed to create order'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const [csRes, agRes, dnsRes] = await Promise.all([
    $fetch<any>('/api/certificates/credential-sets').catch(() => ({ credentialSets: [] })),
    $fetch<any>('/api/certificates/agents').catch(() => ({ agents: [] })),
    $fetch<any>('/api/certificates/dns-zones').catch(() => ({ zones: [], providers: [] }))
  ])
  credentialSets.value = (csRes.credentialSets ?? []).filter((cs: any) => cs.isActive)
  agents.value = (agRes.agents ?? []).filter((a: any) => a.status === 'active')
  dnsZonesData.value = {
    zones: dnsRes.zones ?? [],
    providers: dnsRes.providers ?? []
  }
})
</script>
