<template>
  <div class="relative rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
    <div class="flex items-center justify-between border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ label }}</span>
      <button
        class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-slate-500 transition hover:text-brand dark:text-slate-400"
        @click="copy"
      >
        <Icon :icon="copied ? 'mdi:check' : 'mdi:content-copy'" class="h-3.5 w-3.5" />
        {{ copied ? 'Copied!' : 'Copy' }}
      </button>
    </div>
    <pre class="overflow-x-auto p-3 text-xs text-slate-800 dark:text-slate-200"><code>{{ code }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = defineProps<{
  label: string
  code: string
}>()

const copied = ref(false)

const copy = async () => {
  await navigator.clipboard.writeText(props.code)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>
