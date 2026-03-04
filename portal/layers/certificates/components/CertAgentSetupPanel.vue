<template>
  <div :class="inline ? '' : 'w-full max-w-2xl'">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-50">
        {{ $t('certificates.agents.setup.title') }}
      </h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {{ $t('certificates.agents.setup.subtitle') }}
      </p>
    </div>

    <div class="space-y-4">
      <!-- Step 1: Agent Token -->
      <details open class="mod-certificates-panel group">
        <summary class="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">1</span>
          {{ $t('certificates.agents.setup.step1Title') }}
          <Icon icon="mdi:chevron-down" class="ml-auto h-5 w-5 transition group-open:rotate-180" />
        </summary>
        <div class="mt-3 space-y-3">
          <div v-if="token" class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              <Icon icon="mdi:alert-outline" class="inline h-4 w-4" />
              {{ $t('certificates.agents.setup.step1NewToken') }}
            </p>
            <div class="mt-2 flex items-start gap-2">
              <code class="flex-1 block break-all rounded bg-slate-100 p-2 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {{ token }}
              </code>
              <button
                class="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
                @click="copyToClipboard(token!)"
              >
                <Icon icon="mdi:content-copy" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div v-else class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <Icon icon="mdi:information-outline" class="inline h-4 w-4" />
              {{ $t('certificates.agents.setup.step1ExistingToken') }}
            </p>
          </div>
        </div>
      </details>

      <!-- Step 2: Download & Install -->
      <details open class="mod-certificates-panel group">
        <summary class="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">2</span>
          {{ $t('certificates.agents.setup.step2Title') }}
          <Icon icon="mdi:chevron-down" class="ml-auto h-5 w-5 transition group-open:rotate-180" />
        </summary>
        <div class="mt-3 space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ $t('certificates.agents.setup.step2Desc') }}
          </p>
          <div class="space-y-2">
            <SetupCodeBlock label="Build the agent" :code="buildCommand" />
            <SetupCodeBlock label="Copy files to server" :code="copyCommand" />
            <SetupCodeBlock label="Install as Windows service" :code="serviceCreateCommand" />
          </div>
          <a
            :href="`/api/certificates/agents/${agentId}/install-script`"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-100"
            download
          >
            <Icon icon="mdi:download" class="h-3.5 w-3.5" />
            {{ $t('certificates.agents.setup.downloadScript') }}
          </a>
        </div>
      </details>

      <!-- Step 3: Configure -->
      <details open class="mod-certificates-panel group">
        <summary class="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">3</span>
          {{ $t('certificates.agents.setup.step3Title') }}
          <Icon icon="mdi:chevron-down" class="ml-auto h-5 w-5 transition group-open:rotate-180" />
        </summary>
        <div class="mt-3 space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ $t('certificates.agents.setup.step3Desc') }}
          </p>
          <div class="flex gap-2 border-b border-slate-200 dark:border-slate-700">
            <button
              class="px-3 py-1.5 text-xs font-medium transition"
              :class="configTab === 'json' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'"
              @click="configTab = 'json'"
            >
              {{ $t('certificates.agents.setup.step3TabJson') }}
            </button>
            <button
              class="px-3 py-1.5 text-xs font-medium transition"
              :class="configTab === 'env' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'"
              @click="configTab = 'env'"
            >
              {{ $t('certificates.agents.setup.step3TabEnv') }}
            </button>
          </div>
          <SetupCodeBlock v-if="configTab === 'json'" label="appsettings.json" :code="appSettingsJson" />
          <SetupCodeBlock v-else label="Environment variables" :code="envVarsCommand" />
        </div>
      </details>

      <!-- Step 4: Install simple-acme -->
      <details open class="mod-certificates-panel group">
        <summary class="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">4</span>
          {{ $t('certificates.agents.setup.step4Title') }}
          <Icon icon="mdi:chevron-down" class="ml-auto h-5 w-5 transition group-open:rotate-180" />
        </summary>
        <div class="mt-3 space-y-2">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ $t('certificates.agents.setup.step4Desc') }}
          </p>
          <a
            href="https://simple-acme.com"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            <Icon icon="mdi:open-in-new" class="h-3.5 w-3.5" />
            {{ $t('certificates.agents.setup.step4Link') }}
          </a>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ $t('certificates.agents.setup.step4Path') }}
          </p>
        </div>
      </details>

      <!-- Step 5: Start & Verify -->
      <details open class="mod-certificates-panel group">
        <summary class="flex cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
          <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">5</span>
          {{ $t('certificates.agents.setup.step5Title') }}
          <Icon icon="mdi:chevron-down" class="ml-auto h-5 w-5 transition group-open:rotate-180" />
        </summary>
        <div class="mt-3 space-y-3">
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ $t('certificates.agents.setup.step5Desc') }}
          </p>
          <SetupCodeBlock label="Start the service" :code="startCommand" />
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <p class="text-xs text-blue-800 dark:text-blue-200">
              <Icon icon="mdi:information-outline" class="inline h-3.5 w-3.5" />
              {{ $t('certificates.agents.setup.step5Note') }}
            </p>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import SetupCodeBlock from './SetupCodeBlock.vue'

const props = defineProps<{
  agentId: string
  agentName: string
  token: string | null
  portalBaseUrl: string
  inline?: boolean
}>()

const configTab = ref<'json' | 'env'>('json')

const tokenPlaceholder = props.token ?? '<YOUR_AGENT_TOKEN>'

const buildCommand = `dotnet publish -c Release -o publish`

const copyCommand = `# Copy the published files to the target server
robocopy .\\publish C:\\Services\\CertAgent /MIR /XF appsettings.json`

const serviceCreateCommand = `sc.exe create CertAgent binPath= "C:\\Services\\CertAgent\\CertAgent.exe" start= delayed-auto DisplayName= "CertAgent - ${props.agentName}"
sc.exe failure CertAgent reset= 86400 actions= restart/5000/restart/10000/restart/30000`

const appSettingsJson = JSON.stringify({
  Logging: {
    LogLevel: {
      Default: 'Information',
      'Microsoft.Hosting.Lifetime': 'Information'
    }
  },
  AgentOptions: {
    PortalBaseUrl: props.portalBaseUrl,
    AgentToken: tokenPlaceholder,
    HeartbeatIntervalSeconds: 60,
    PollIntervalSeconds: 30,
    WacsPath: 'C:\\simple-acme\\wacs.exe'
  }
}, null, 2)

const envVarsCommand = `[System.Environment]::SetEnvironmentVariable("AgentOptions__PortalBaseUrl", "${props.portalBaseUrl}", "Machine")
[System.Environment]::SetEnvironmentVariable("AgentOptions__AgentToken", "${tokenPlaceholder}", "Machine")
[System.Environment]::SetEnvironmentVariable("AgentOptions__HeartbeatIntervalSeconds", "60", "Machine")
[System.Environment]::SetEnvironmentVariable("AgentOptions__PollIntervalSeconds", "30", "Machine")
[System.Environment]::SetEnvironmentVariable("AgentOptions__WacsPath", "C:\\simple-acme\\wacs.exe", "Machine")`

const startCommand = `sc.exe start CertAgent

# Verify status
sc.exe query CertAgent`

const copyToClipboard = async (text: string) => {
  await navigator.clipboard.writeText(text)
}
</script>
