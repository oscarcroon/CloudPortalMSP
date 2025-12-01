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
      class="flex items-center rounded-full px-2.5 py-1 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="
        option.value === colorMode.preference
          ? 'text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
      "
      :style="
        option.value === colorMode.preference
          ? {
              backgroundColor: accentColor,
              outlineColor: accentColor
            }
          : {
              outlineColor: accentColor
            }
      "
      :aria-pressed="option.value === colorMode.preference"
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
import { computed } from 'vue'
import { useColorMode } from '#imports'
import { useAuth } from '~/composables/useAuth'

type ThemePreference = 'system' | 'light' | 'dark'

const colorMode = useColorMode<ThemePreference>()
const auth = useAuth()

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

const options: Array<{ value: ThemePreference; label: string; icon: string }> = [
  { value: 'system', label: 'System', icon: '◑' },
  { value: 'light', label: 'Ljust', icon: '☼' },
  { value: 'dark', label: 'Mörkt', icon: '☾' }
]

function selectPreference(value: ThemePreference) {
  colorMode.preference = value
}
</script>

