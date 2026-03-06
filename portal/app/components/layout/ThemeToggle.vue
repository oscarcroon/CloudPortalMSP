<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    :aria-label="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    :title="isDark ? t('theme.switchToLight') : t('theme.switchToDark')"
    @click="toggle"
    @mouseenter="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = accentColor; el.style.color = accentColor }"
    @mouseleave="(e: MouseEvent) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = ''; el.style.color = '' }"
  >
    <Icon v-if="isDark" icon="mdi:white-balance-sunny" class="h-5 w-5" />
    <Icon v-else icon="mdi:weather-night" class="h-5 w-5" />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useColorMode, useI18n } from '#imports'
import { Icon } from '@iconify/vue'
import { useAuth } from '~/composables/useAuth'

const { t } = useI18n()
const colorMode = useColorMode()
const auth = useAuth()

const accentColor = computed(() => {
  return auth.branding.value?.activeTheme.accentColor || '#1C6DD0'
})

const isDark = computed(() => colorMode.value === 'dark')

function toggle() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}
</script>
