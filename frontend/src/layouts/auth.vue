<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50"
  >
    <div class="absolute right-6 top-6">
      <ThemeToggle />
    </div>
    <NuxtLink
      to="/"
      class="mb-10 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-200"
    >
      <img :src="currentLogo" alt="Cloud Portal" class="h-8 w-auto" />
      Cloud Portal
    </NuxtLink>
    <main
      class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-white/5"
    >
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import logoLight from '~/assets/images/coreit-logo.svg'
import logoDark from '~/assets/images/coreit-logo-neg.svg'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'
import { useThemeStore } from '~/stores/theme'

const themeStore = useThemeStore()
const currentLogo = computed(() => (themeStore.isDark ? logoDark : logoLight))
</script>

