<template>
  <div
    class="flex rounded-full border border-slate-200 bg-white/80 p-1 text-xs shadow-sm transition dark:border-slate-700 dark:bg-slate-800/70"
    role="group"
    aria-label="Ändra tema"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="flex items-center rounded-full px-2.5 py-1 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      :class="
        option.value === themeStore.preference
          ? 'bg-brand text-white shadow-sm dark:bg-brand/90'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
      "
      :aria-pressed="option.value === themeStore.preference"
      :aria-label="option.label"
      :title="option.label"
      @click="selectPreference(option.value)"
    >
      <span aria-hidden="true">{{ option.icon }}</span>
      <span class="sr-only">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useThemeStore, type ThemePreference } from '~/stores/theme'

const themeStore = useThemeStore()

const options: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: '◑' },
  { value: 'light', label: 'Ljust', icon: '☼' },
  { value: 'dark', label: 'Mörkt', icon: '☾' }
]

function selectPreference(value: ThemePreference) {
  themeStore.setPreference(value)
}

onMounted(() => {
  themeStore.init()
})
</script>

