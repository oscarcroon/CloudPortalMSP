<template>
  <section class="mod-windows-dns-panel">
    <!-- Collapsed Header (always visible) -->
    <button
      type="button"
      class="flex w-full items-center justify-between text-left"
      @click="expanded = !expanded"
    >
      <div class="flex items-center gap-3">
        <Icon
          icon="mdi:dns"
          class="h-5 w-5 text-slate-400 dark:text-slate-500"
        />
        <div>
          <h3 class="text-sm font-medium text-slate-900 dark:text-slate-50">
            {{ $t('windowsDns.zoneInfo.title') }}
          </h3>
          <p v-if="parsedSoa && !expanded" class="text-xs text-slate-500 dark:text-slate-400">
            {{ parsedSoa.primaryNs }} · Serial {{ parsedSoa.serial }}
          </p>
        </div>
      </div>
      <Icon
        :icon="expanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
        class="h-5 w-5 text-slate-400 transition-transform dark:text-slate-500"
      />
    </button>

    <!-- Expanded Content -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[500px]"
      leave-from-class="opacity-100 max-h-[500px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="expanded" class="mt-4 overflow-hidden">
        <div v-if="soaRecord && parsedSoa" class="space-y-3">
          <!-- SOA Fields Grid -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <!-- Primary NS -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.primaryNs') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ parsedSoa.primaryNs }}
              </span>
            </div>

            <!-- Responsible Party -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.responsibleParty') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ parsedSoa.responsibleParty }}
              </span>
              <span v-if="parsedSoa.responsiblePartyEmail" class="text-xs text-slate-500 dark:text-slate-400">
                ({{ parsedSoa.responsiblePartyEmail }})
              </span>
            </div>

            <!-- Serial -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.serial') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ parsedSoa.serial }}
              </span>
            </div>

            <!-- TTL from record -->
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.ttl') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ formatDuration(soaRecord.ttl ?? 0) }}
              </span>
            </div>
          </div>

          <!-- Timing Values -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.refresh') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ formatDuration(parsedSoa.refresh) }}
                <span class="text-xs text-slate-400">({{ parsedSoa.refresh }}s)</span>
              </span>
            </div>

            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.retry') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ formatDuration(parsedSoa.retry) }}
                <span class="text-xs text-slate-400">({{ parsedSoa.retry }}s)</span>
              </span>
            </div>

            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.expire') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ formatDuration(parsedSoa.expire) }}
                <span class="text-xs text-slate-400">({{ parsedSoa.expire }}s)</span>
              </span>
            </div>

            <div class="flex flex-col gap-0.5">
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                {{ $t('windowsDns.zoneInfo.minimumTtl') }}
              </span>
              <span class="font-mono text-sm text-slate-900 dark:text-slate-50">
                {{ formatDuration(parsedSoa.minimum) }}
                <span class="text-xs text-slate-400">({{ parsedSoa.minimum }}s)</span>
              </span>
            </div>
          </div>

          <!-- Raw Details (if parsing failed or has extra data) -->
          <div v-if="!parsedSoa.isValid || parsedSoa.extra.length > 0" class="mt-2">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              @click.stop="showRaw = !showRaw"
            >
              <Icon :icon="showRaw ? 'mdi:chevron-down' : 'mdi:chevron-right'" class="h-4 w-4" />
              {{ $t('windowsDns.zoneInfo.details') }}
            </button>
            <div v-if="showRaw" class="mt-2 rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <pre class="whitespace-pre-wrap break-all">{{ parsedSoa.raw }}</pre>
            </div>
          </div>
        </div>

        <!-- No SOA record found -->
        <div v-else class="text-sm text-slate-500 dark:text-slate-400">
          {{ $t('windowsDns.zoneInfo.notFound') }}
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { parseSoaContent, formatDuration } from '@windows-dns/lib/parse-soa'

const props = defineProps<{
  zoneName?: string
  soaRecord?: {
    id?: string
    name?: string
    type?: string
    content?: string
    ttl?: number
  } | null
}>()

const expanded = ref(false)
const showRaw = ref(false)

const parsedSoa = computed(() => {
  if (!props.soaRecord?.content) return null
  return parseSoaContent(props.soaRecord.content)
})
</script>

<style scoped>
.mod-windows-dns-panel {
  @apply rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80;
}
</style>

