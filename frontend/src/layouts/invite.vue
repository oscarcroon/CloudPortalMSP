<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center bg-slate-50/70 text-slate-900 transition-colors dark:bg-slate-950/80 dark:text-slate-50"
  >
    <div class="absolute right-6 top-6">
      <ThemeToggle />
    </div>

    <NuxtLink
      to="/"
      class="mb-10 flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-200"
    >
      <img :src="currentLogo" alt="Cloud Portal" class="h-16 w-auto" />
      Cloud Portal
    </NuxtLink>

    <main
      class="w-full max-w-4xl rounded-[2.5rem] border border-slate-200/80 bg-white/90 p-10 shadow-2xl shadow-slate-900/5 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-slate-900/40"
    >
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'
import { computed } from 'vue'
import logoLight from '~/assets/images/coreit-logo.svg'
import logoDark from '~/assets/images/coreit-logo-neg.svg'
import ThemeToggle from '~/components/layout/ThemeToggle.vue'

const colorMode = useColorMode()
const currentLogo = computed(() => (colorMode.value === 'dark' ? logoDark : logoLight))
</script>


